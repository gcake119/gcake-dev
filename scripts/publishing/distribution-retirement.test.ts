import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DistributionCoordinator } from '../../apps/admin-worker/src/distribution-coordinator';
import { InMemoryPublicationRepository, PublicationOperations } from '../../apps/admin-worker/src/publication-operations';
import { buildDistributionBundle } from './prepare-distribution';
import { main } from './run-distribution';

const article = { slug: 'retirement', sourceRevision: 'revision-1', title: 'Retirement', body: 'Full body', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/retirement/', publishedAt: '2026-10-01T00:00:00Z', assets: [] };

test('retired target is rejected before CLI source reads or provider access', async () => {
  await assert.rejects(main(['dry-run', 'missing-source', 'paragraph'], undefined, '/nonexistent-retirement-source'), /DISTRIBUTION_USAGE|DISTRIBUTION_TARGET_UNSUPPORTED/);
});
test('coordinator rejects a retired target without reading or writing state', async () => {
  let reads = 0;
  const repo = new InMemoryPublicationRepository();
  repo.listStates = async () => { reads++; return []; };
  const coordinator = new DistributionCoordinator(repo, undefined);
  await assert.rejects(coordinator.dryRun(article, 'paragraph' as never), /DISTRIBUTION_TARGET_UNSUPPORTED/);
  assert.equal(reads, 0);
  assert.equal(repo.states.length, 0);
});
test('publishing center hides retired state while repository preserves identity', async () => {
  const repo = new InMemoryPublicationRepository();
  const historical = { postSlug: article.slug, target: 'paragraph' as const, sourceRevision: article.sourceRevision, status: 'verified' as const, remoteId: 'retained-id', updatedAt: 'now' };
  await repo.putState(historical);
  await repo.putState({ ...historical, target: 'substack', remoteId: 'substack-id' });
  const states = await new PublicationOperations(repo).readStates(article.slug, article.sourceRevision);
  assert.deepEqual(states.map(s => s.target), ['substack']);
  assert.deepEqual(repo.states.find(s => s.remoteId === 'retained-id'), historical);
});
test('preparation produces only a Substack target and retains its remote identity', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-retirement-'));
  try {
    await fs.writeFile(path.join(dir, 'retirement.md'), '---\ntitle: Retirement\nstatus: published\npublishedAt: 2026-10-01T00:00:00Z\n---\nFull body.\n');
    const bundle = await buildDistributionBundle('retirement', dir, { substack: 'retained-substack' });
    assert.deepEqual(Object.keys(bundle.targets), ['substack']);
    assert.equal(bundle.targets.substack.remoteId, 'retained-substack');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
