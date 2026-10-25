import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import YAML from 'yaml';
import test from 'node:test';

const rootPackage = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const rootTypeScriptConfig = JSON.parse(
  await readFile(new URL('../../tsconfig.json', import.meta.url), 'utf8'),
);
const workerConfig = await readFile(
  new URL('../../apps/admin-worker/wrangler.toml', import.meta.url),
  'utf8',
);
const adminDeployWorkflow = await readFile(
  new URL('../../.github/workflows/deploy-admin-worker.yml', import.meta.url),
  'utf8',
);

test('Phase 0 exposes independent workspace build and test entry points', async () => {
  assert.equal(rootPackage.scripts['build:astro'], 'pnpm content:validate && astro build');
  assert.equal(rootPackage.scripts['build:admin'], 'pnpm --filter @gcake/admin build');
  assert.equal(rootPackage.scripts['build:worker'], 'pnpm --filter @gcake/admin-worker build');
  assert.equal(rootPackage.scripts['build:workspaces'], 'pnpm --filter "./apps/**" --filter "./packages/**" build');

  for (const relativePath of [
    '../../apps/admin/package.json',
    '../../apps/admin-worker/package.json',
    '../../packages/admin-contract/package.json',
    '../../packages/publishing-contract/package.json',
  ]) {
    const manifest = JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
    assert.equal(typeof manifest.scripts?.build, 'string', `${manifest.name} requires a build command`);
    assert.equal(typeof manifest.scripts?.test, 'string', `${manifest.name} requires a test command`);
  }
});

test('Astro checks exclude generated workspace build output', () => {
  assert.deepEqual(rootTypeScriptConfig.exclude, [
    'dist',
    'apps/*/dist',
    'packages/*/dist',
  ]);
});

test('preview Worker serves the built Admin as a same-origin SPA while runtime routes reach the Worker', () => {
  assert.match(workerConfig, /\[assets\]/);
  assert.match(workerConfig, /directory\s*=\s*"\.\.\/admin\/dist"/);
  assert.match(workerConfig, /not_found_handling\s*=\s*"single-page-application"/);
  assert.match(workerConfig, /run_worker_first\s*=\s*\[\s*"\/api\/\*"\s*,\s*"\/health"\s*\]/);
});

test('production Admin deployment migrates before deploy and verifies health', () => {
  assert.match(adminDeployWorkflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(adminDeployWorkflow, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(adminDeployWorkflow, /d1 migrations apply CMS_DB --env production --remote/);
  assert.match(adminDeployWorkflow, /deploy --env production/);
  assert.match(adminDeployWorkflow, /steps\.deploy\.outputs\.deployment-url/);
  assert.match(adminDeployWorkflow, /\/health/);
  assert.doesNotMatch(adminDeployWorkflow, /deploy-pages/);
});

test('main pull requests receive full local gates without deployment authority', async () => {
  const directory = new URL('../../.github/workflows/', import.meta.url);
  const workflows = await Promise.all((await readdir(directory)).filter((name) => /\.ya?ml$/.test(name))
    .map(async (name) => YAML.parse(await readFile(new URL(name, directory), 'utf8'))));
  const validation = workflows.filter((workflow) => workflow.on?.pull_request?.branches?.includes('main'));
  assert.ok(validation.length > 0, 'main pull requests require a validation workflow');
  assert.ok(validation.some((workflow) => Object.entries(workflow.jobs).some(([id, job]: [string, any]) => (job.name ?? id) === 'validate')), 'protected main requires the validate check context');
  const commands = validation.flatMap((workflow) => Object.values(workflow.jobs).flatMap((job: any) => job.steps.map((step: any) => step.run ?? ''))).join('\n');
  for (const gate of ['pnpm test', 'pnpm check', 'pnpm build:all', 'pnpm release:dry-run'])
    assert.ok(commands.split('\n').includes(gate), `PR validation must run ${gate}`);
  for (const workflow of validation) {
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    assert.equal(workflow.on.pull_request.paths, undefined, 'all PR changes require gates');
    assert.equal(workflow.on.pull_request_target, undefined);
    const text = JSON.stringify(workflow);
    assert.doesNotMatch(text, /secrets\.|deploy-pages|wrangler-action|--remote|release-orchestrate/);
    for (const job of Object.values(workflow.jobs) as any[]) {
      assert.equal(job.permissions, undefined);
      assert.equal(job.environment, undefined);
    }
  }
});


for (const name of ['deploy-admin-worker.yml', 'deploy-pages.yml']) {
  test(`${name} preserves its approved triggers and deploys only on main`, async () => {
    const workflow = YAML.parse(await readFile(new URL('../../.github/workflows/' + name, import.meta.url), 'utf8'));
    assert.deepEqual(Object.keys(workflow.on).sort(), ['workflow_dispatch'], name);
    for (const [name, job] of Object.entries(workflow.jobs) as [string, any][]) {
      if (name === 'secret-check' || name === 'secret-check-preflight') {
        assert.equal(workflow.permissions.contents, 'read');
        assert.match(job.if, /workflow_dispatch/);
        assert.match(job.if, /inputs.mode == 'secret-check'/);
        assert.match(job.if, /refs\/heads\/feat\/editorial-release-queue/);
        continue;
      }
      assert.match(job.if, /(?:^| && )github.ref == 'refs\/heads\/main'$/, name);
    }
  });
}


test('production and preview deployment retain verified OAuth client and owner configuration', () => {
  for (const environment of ['production', 'preview']) {
    const section = workerConfig.split(`[env.${environment}.vars]`)[1].split('\n[')[0];
    assert.match(section, /GITHUB_OAUTH_CLIENT_ID\s*=\s*"[^"\s]+"/);
    assert.match(section, /GITHUB_OWNER_USER_IDS\s*=\s*"\d+(,\d+)*"/);
    assert.match(section, /RELEASE_WRITE_ENABLED\s*=\s*"false"/);
  }
});

test('editorial release deploys only newly committed revisions with isolated Pages permissions', async () => {
  const workflow = YAML.parse(await readFile(new URL('../../.github/workflows/editorial-release.yml',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(workflow.on).sort(),['schedule','workflow_dispatch']);
  assert.equal(workflow.jobs.release.if,"github.ref == 'refs/heads/main' && vars.RELEASE_AUTOMATION_ENABLED == 'true'");
  assert.equal(workflow.jobs.release.outputs.release_sha,'${{ steps.release.outputs.release_sha }}');
  assert.equal(workflow.jobs.build.if,"needs.release.outputs.release_sha != ''");
  assert.equal(workflow.jobs.build.needs,'release');
  const checkout=workflow.jobs.build.steps.find((s:any)=>s.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref,'${{ needs.release.outputs.release_sha }}');
  assert.equal(checkout.with['persist-credentials'],false);
  assert.ok(workflow.jobs.build.steps.some((s:any)=>s.run==='pnpm install --frozen-lockfile'));
  assert.ok(workflow.jobs.build.steps.some((s:any)=>s.run==='pnpm build'));
  assert.ok(workflow.jobs.build.steps.some((s:any)=>s.run==='pnpm content:restore:ithome'));
  assert.doesNotMatch(JSON.stringify(workflow.jobs.build),/content:sync|wrangler|--remote/);
  assert.deepEqual(workflow.permissions,{contents:'read'});
  assert.equal(workflow.jobs.release.permissions,undefined);
  assert.equal(workflow.jobs.build.permissions,undefined);
  assert.deepEqual(workflow.jobs.deploy.permissions,{contents:'read',pages:'write','id-token':'write'});
  assert.deepEqual(workflow.jobs.deploy.needs,['release','build']);
  assert.equal(workflow.jobs.deploy.if,"needs.release.outputs.release_sha != ''");
  assert.equal(workflow.jobs.deploy.environment.name,'github-pages');
  assert.deepEqual(workflow.jobs.deploy.concurrency,{group:'pages','cancel-in-progress':false});
});

test('main PR validation selects each shared gate once and retains editorial rehearsal', async () => {
  const directory = new URL('../../.github/workflows/', import.meta.url);
  const workflows = await Promise.all((await readdir(directory)).filter((name) => /\.ya?ml$/.test(name))
    .map(async (name) => YAML.parse(await readFile(new URL(name, directory), 'utf8'))));
  const selected = workflows.filter((workflow) => workflow.on?.pull_request?.branches?.includes('main'));
  assert.equal(selected.length, 1, 'one PR must select one complete validation workflow');
  const workflow = selected[0];
  assert.equal(workflow.env.EDITORIAL_RELEASE_ENABLED, 'false');
  assert.equal(workflow.env.HERMES_RSS_NOTIFY_ENABLED, 'false');
  const commands = Object.values(workflow.jobs).flatMap((job: any) => {
    assert.notEqual(job['continue-on-error'], true);
    return job.steps.flatMap((step: any) => {
      assert.notEqual(step['continue-on-error'], true);
      return (step.run ?? '').split('\n').map((line: string) => line.trim());
    });
  });
  for (const gate of ['pnpm install --frozen-lockfile', 'bash scripts/ci/prepare-validation.sh browser',
    'pnpm test', 'pnpm check', 'pnpm build:all', 'pnpm release:dry-run', 'pnpm editorial:rehearse']) {
    assert.equal(commands.filter((command) => command === gate).length, 1, `${gate} must run once`);
  }
});

test('complete tests select the release queue once without removing its coverage', () => {
  const groups = rootPackage.scripts.test.match(/pnpm test:[\w-]+/g) ?? [];
  const selectedTests = groups.flatMap((command: string) =>
    rootPackage.scripts[command.replace('pnpm ', '')].split(/\s+/).filter((argument: string) => argument.endsWith('.test.ts')));
  assert.equal(selectedTests.filter((path: string) => path === 'src/lib/publishing/release-queue.test.ts').length, 1);
});

test('editorial validation retains main and manual entrypoints without feature push or PR duplication', async () => {
  const workflow = YAML.parse(await readFile(new URL('../../.github/workflows/validate-editorial.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.on.pull_request, undefined);
});
