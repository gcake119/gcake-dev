import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import test from 'node:test';
import {
  InMemoryPublicationRepository,
  PublicationOperations,
  importLegacyPublicationState,
} from './publication-operations';

test('D1 schema owns operational state but excludes article body, frontmatter, and publishedAt', async () => {
  const sql = await readFile(new URL('../migrations/0003_publication_operations.sql', import.meta.url), 'utf8');
  assert.match(sql, /publication_runs/);
  assert.match(sql, /publication_attempts/);
  assert.match(sql, /publication_target_states/);
  assert.doesNotMatch(sql, /article_body|frontmatter|published_at/i);
});

test('legacy JSON import is idempotent and subsequent writes target only D1 repository', async () => {
  const repository = new InMemoryPublicationRepository();
  const legacy = { version: 2 as const, posts: { demo: { sourceRevision: 'abc', targets: { paragraph: { status: 'published', remoteId: 'remote', needsResync: false, newsletterSent: false } } } } };
  assert.equal(await importLegacyPublicationState(repository, legacy, () => '2026-09-28T00:00:00Z'), 1);
  assert.equal(await importLegacyPublicationState(repository, legacy, () => '2026-09-28T00:01:00Z'), 0);
  assert.equal(repository.states.length, 1);
  assert.equal(repository.migrations.size, 1);
});

test('accepted cutover removes the JSON owner and compatibility module together', async () => {
  await assert.rejects(access(new URL('../../../src/data/publishing/publication-state.json', import.meta.url)));
  await assert.rejects(access(new URL('../../../src/lib/publishing/publication-state.ts', import.meta.url)));
});

test('targets remain independent and verified old revision becomes stale without provider calls', async () => {
  const repository = new InMemoryPublicationRepository();
  await repository.putState({ postSlug: 'demo', target: 'paragraph', sourceRevision: 'abc', status: 'verified', remoteId: 'p', updatedAt: 'now' });
  await repository.putState({ postSlug: 'demo', target: 'github_pages', sourceRevision: 'def', status: 'verified', updatedAt: 'now' });
  const states = await new PublicationOperations(repository).readStates('demo', 'def');
  assert.equal(states.find((state) => state.target === 'paragraph')?.status, 'stale');
  assert.equal(states.find((state) => state.target === 'github_pages')?.status, 'verified');
});

test('explicit prepare keeps Paragraph dry-run and Substack manual without writes', async () => {
  const repository = new InMemoryPublicationRepository();
  const operations = new PublicationOperations(repository);
  const paragraph = await operations.operate({ postSlug: 'demo', sourceRevision: 'abc', target: 'paragraph', operation: 'prepare' });
  const substack = await operations.operate({ postSlug: 'demo', sourceRevision: 'abc', target: 'substack', operation: 'publish' });
  assert.equal(paragraph.status, 'prepare_ready');
  assert.equal(substack.status, 'manual_required');
  assert.equal(repository.states.length, 2);
});

test('one target failure never rolls back another verified target', async () => {
  const repository = new InMemoryPublicationRepository();
  await repository.putState({ postSlug: 'demo', target: 'github_pages', sourceRevision: 'abc', status: 'verified', updatedAt: 'now' });
  const operations = new PublicationOperations(repository);
  await operations.fail('demo', 'substack', 'abc', 'SUBSTACK_NOT_CONFIGURED');
  const states = await operations.readStates('demo', 'abc');
  assert.equal(states.find((state) => state.target === 'github_pages')?.status, 'verified');
  assert.equal(states.find((state) => state.target === 'substack')?.status, 'manual_required');
});
