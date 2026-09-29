import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
