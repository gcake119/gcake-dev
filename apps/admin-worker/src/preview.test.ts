import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryPreviewStore, PreviewBuildError, PreviewOrchestrator, expirePreviews } from './preview';

const draft = '# Unsaved MDX\n\n<Demo />\n';

test('formal preview binds base revision and draft hash through queued, running, ready lifecycle', async () => {
  const store = new InMemoryPreviewStore();
  const events: string[] = [];
  const orchestrator = new PreviewOrchestrator({
    store,
    source: { reconstruct: async (revision) => revision === 'base-a' ? { root: '/isolated/base-a', cleanup: async () => { events.push('cleanup'); } } : undefined },
    provider: { build: async (input) => { events.push(`build:${input.sourceRoot}:${input.slug}`); return { url: 'https://preview.test/job-a/' }; } },
    id: () => 'job-a', now: () => new Date('2026-09-28T00:00:00Z'), lifetimeMs: 60_000,
  });
  const result = await orchestrator.create({ repository: 'gcake119/gcake-dev', slug: 'draft', baseRevision: 'base-a', draft });
  assert.equal(result.status, 'ready');
  assert.equal(result.baseRevision, 'base-a');
  assert.match(result.draftHash, /^[a-f0-9]{64}$/);
  assert.equal(result.url, 'https://preview.test/job-a/');
  assert.deepEqual(store.history.map((job) => job.status), ['queued', 'running', 'ready']);
  assert.deepEqual(events, ['build:/isolated/base-a:draft', 'cleanup']);
});

test('unreconstructable base fails actionably and never substitutes current source', async () => {
  const store = new InMemoryPreviewStore();
  let builds = 0;
  const orchestrator = new PreviewOrchestrator({
    store,
    source: { reconstruct: async () => undefined },
    provider: { build: async () => { builds += 1; return { url: 'unexpected' }; } },
    id: () => 'job-failed', now: () => new Date('2026-09-28T00:00:00Z'), lifetimeMs: 60_000,
  });
  await assert.rejects(
    orchestrator.create({ repository: 'gcake119/gcake-dev', slug: 'draft', baseRevision: 'missing', draft }),
    (error: unknown) => error instanceof PreviewBuildError && error.code === 'PREVIEW_BUILD_FAILED',
  );
  assert.equal(builds, 0);
  assert.deepEqual(store.history.map((job) => job.status), ['queued', 'failed']);
});

test('expiry makes preview unavailable and cleanup is scoped to preview artifacts', async () => {
  const store = new InMemoryPreviewStore();
  await store.put({ id: 'old', repository: 'repo', postSlug: 'post', baseRevision: 'base', draftHash: 'hash', status: 'ready', url: 'https://preview.test/old', createdAt: '2026-09-28T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z', expiresAt: '2026-09-28T00:01:00Z' });
  const removed: string[] = [];
  await expirePreviews(store, { remove: async (id) => { removed.push(id); } }, new Date('2026-09-28T00:02:00Z'));
  assert.equal((await store.get('old'))?.status, 'expired');
  assert.deepEqual(removed, ['old']);
});
