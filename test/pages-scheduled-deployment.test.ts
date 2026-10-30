import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import { isPublicPost, parsePublicationTime } from '../src/lib/content/publication';
import { resumeOrSync } from '../scripts/external/ithome-sync';

const root = new URL('../', import.meta.url);
const workflow = parse(await readFile(new URL('.github/workflows/deploy-pages.yml', root), 'utf8'));

const editorial = parse(await readFile(new URL('.github/workflows/editorial-release.yml', root), 'utf8'));

// These job guards use only string comparison and boolean operators, whose
// semantics are identical here and in GitHub's expression evaluator.
function eligible(job: string, event: string, ref: string, mode?: string): boolean {
  const expression = workflow.jobs[job].if;
  assert.match(expression, /^[\w.\s'!=&|()\/-]+$/);
  return Boolean(runInNewContext(expression, {
    github: { event_name: event, ref }, inputs: { mode: mode ?? '' },
  }, { timeout: 100 }));
}

test('legacy automatic Pages triggers are withdrawn without losing manual controls', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.mode.options, ['deploy', 'secret-check']);
  assert.equal(workflow.on.workflow_dispatch.inputs.mode.default, 'deploy');
});

test('manual deployment guards reject unexpected automatic events and isolate Secret acceptance', () => {
  for (const [event, ref, mode, deploy, secret] of [
    ['schedule', 'refs/heads/main', undefined, false, false],
    ['push', 'refs/heads/main', undefined, false, false],
    ['push', 'refs/heads/feature', undefined, false, false],
    ['workflow_dispatch', 'refs/heads/main', 'deploy', true, false],
    ['workflow_dispatch', 'refs/heads/main', 'secret-check', false, false],
    ['workflow_dispatch', 'refs/heads/feat/editorial-release-queue', 'secret-check', false, true],
    ['schedule', 'refs/heads/feat/editorial-release-queue', undefined, false, false],
  ] as const) {
    assert.equal(eligible('build', event, ref, mode), deploy, `${event}/${ref}: build`);
    assert.equal(eligible('deploy', event, ref, mode), deploy, `${event}/${ref}: deploy`);
    for (const job of ['secret-check-preflight', 'secret-check']) {
      assert.equal(eligible(job, event, ref, mode), secret, `${event}/${ref}: ${job}`);
    }
  }
});

test('failed builds and stale main cannot publish and Pages does not distribute or mail', () => {
  assert.equal(workflow.jobs.deploy.needs, 'build');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const steps = workflow.jobs.deploy.steps;
  const gate = steps.findIndex((s: any) => s.name === 'Reject stale artifact after concurrent CMS edit');
  const deploy = steps.findIndex((s: any) => s.uses === 'actions/deploy-pages@v5');
  assert.ok(gate >= 0 && gate < deploy);
  assert.match(steps[gate].run, /test "\$current" = "\$SOURCE_REVISION"/);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  const buildSteps = workflow.jobs.build.steps;
  assert.ok(buildSteps.some((s: any) => s.with?.ref === '${{ github.sha }}' && s.with?.['persist-credentials'] === false));
  assert.ok(buildSteps.some((s: any) => s.run === 'pnpm content:restore:ithome'));
  const commands = [...buildSteps, ...steps].map((s: any) => s.run ?? '').join('\n');
  assert.doesNotMatch(commands, /distribution:|sendNewsletter|newsletter:|editorial:release/);
});

test('publication remains private before the Taipei instant and eligible at the instant', () => {
  const publishedAt = parsePublicationTime('2026-10-15T09:00:00+08:00').instant;
  const before = new Date('2026-10-15T00:59:59Z');
  const due = new Date('2026-10-15T01:00:00Z');
  assert.equal(isPublicPost({ status: 'published', publishedAt }, before), false);
  assert.equal(isPublicPost({ status: 'published', publishedAt }, due), true);
  for (const status of ['draft', 'ready']) assert.equal(isPublicPost({ status, publishedAt }, due), false);
});

test('the saved 30 completed articles validate offline and corruption never falls back', async () => {
  const snapshot = JSON.parse(await readFile(new URL('src/data/external/ithome-2026.generated.json', root), 'utf8'));
  assert.equal(snapshot.publicationState, 'completed');
  assert.equal(snapshot.posts.length, 30);
  let requests = 0;
  const offline = async () => { requests++; throw new Error('Source requests are forbidden after completion'); };
  const restored = await resumeOrSync(snapshot, offline);
  assert.equal(restored.posts.length, 30);
  assert.equal(restored.revision, snapshot.revision);
  await assert.rejects(resumeOrSync({ ...snapshot, posts: snapshot.posts.slice(0, 19) }, offline));
  await assert.rejects(resumeOrSync({ ...snapshot, posts: snapshot.posts.map((p: any, i: number) => i ? p : { ...p, markdown: 'corrupted' }) }, offline), /hash mismatch/);
  assert.equal(requests, 0);
});


test('existing editorial cron and no-op delivery guards remain intact; both builds restore completed content first', () => {
  assert.deepEqual(editorial.on.schedule, [{ cron: '0 23 * * 0,3' }, { cron: '7 * * * *' }]);
  assert.equal(editorial.on.push, undefined);
  for (const name of ['build','deploy']) assert.equal(editorial.jobs[name].if, "needs.release.outputs.release_sha != ''");
  for (const w of [workflow, editorial]) {
    const commands = w.jobs.build.steps.map((s:any)=>s.run);
    const restore = commands.indexOf('pnpm content:restore:ithome');
    assert.ok(restore >= 0 && restore < commands.indexOf('pnpm build'), 'completed restoration must precede every Pages build');
    assert.ok(!commands.includes('pnpm content:sync:ithome'), 'retired-source fallback is not a build entry point');
    assert.equal(w.jobs.build['continue-on-error'], undefined);
    assert.equal(w.jobs.build.steps[restore]['continue-on-error'], undefined);
  }
});

// Configuration contract: the real production omission bypassed reader behavior tests.
// Reuse this workflow test to enforce the endpoint boundary; generated HTML is checked separately.
test('both publication builds preserve the existing configured semantic search endpoint', () => {
  for (const w of [workflow, editorial]) {
    const builds = w.jobs.build.steps.filter((step: any) => step.run === 'pnpm build');
    assert.equal(builds.length, 1);
    assert.equal(builds[0].env?.PUBLIC_SEARCH_ENDPOINT, '${{ vars.PUBLIC_SEARCH_ENDPOINT }}');
  }
});
