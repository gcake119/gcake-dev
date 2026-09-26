import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectSnapshot } from './ithome-sync';
const markdown = '---\nday: 1\ntitle: Day one\npublishDate: 2026-09-09\ndraft: false\n---\nBody';
const manifest = { schemaVersion: 1, source: 'gcake119/ithome-2026', revision: 'a'.repeat(40), builtAt: '2026-09-09T16:00:00.000Z', publicationState: 'active', posts: [{ day: 1, slug: 'day-01', sha256: createHash('sha256').update(markdown).digest('hex') }] };
test('follows deployed public set and pins the revision even across midnight', async () => {
  const snapshot = await collectSnapshot(manifest, async url => { assert.ok(url.includes('/' + 'a'.repeat(40) + '/')); return markdown; });
  assert.equal(snapshot.posts.length, 1);
  assert.equal(snapshot.publicationState, 'active');
});
test('rejects incomplete fetch, corrupted body and inconsistent manifests', async () => {
  await assert.rejects(collectSnapshot(manifest, async () => { throw new Error('HTTP 503'); }));
  await assert.rejects(collectSnapshot(manifest, async () => markdown + 'changed'), /hash mismatch/);
  await assert.rejects(collectSnapshot({ ...manifest, posts: [...manifest.posts, ...manifest.posts] }, async () => markdown));
  await assert.rejects(collectSnapshot({ ...manifest, publicationState: 'completed' }, async () => markdown));
});
test('draft content cannot enter the public snapshot', async () => {
  const draft = markdown.replace('draft: false', 'draft: true');
  await assert.rejects(collectSnapshot({ ...manifest, posts: [{ ...manifest.posts[0], sha256: createHash('sha256').update(draft).digest('hex') }] }, async () => draft), /Invalid public/);
});
