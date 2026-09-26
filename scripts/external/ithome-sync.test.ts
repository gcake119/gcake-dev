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

test('completion freezes 30 verified posts without any source requests; corruption fails closed', async () => {
  const { resumeOrSync } = await import('./ithome-sync');
  const entries = Array.from({length:30}, (_, i) => {
    const body = markdown.replace('day: 1\n', `day: ${i + 1}\n`);
    return { day: i + 1, slug: `day-${String(i + 1).padStart(2,'0')}`, markdown: body, sha256: createHash('sha256').update(body).digest('hex') };
  });
  const completed = { ...manifest, sourceBuiltAt: manifest.builtAt, publicationState: 'completed', posts: entries };
  let requests=0;
  const offline = async () => { requests++; throw new Error('source offline'); };
  assert.equal((await resumeOrSync(completed, offline)).posts.length, 30);
  assert.equal(requests, 0);
  await assert.rejects(resumeOrSync({...completed,posts:entries.slice(1)},offline));
  await assert.rejects(resumeOrSync({...completed,posts:entries.map((p,i)=>i===0?{...p,markdown:'corrupted'}:p)},offline));
  assert.equal(requests, 0);
});
test('ongoing series still synchronizes the deployed source', async () => {
  const { resumeOrSync } = await import('./ithome-sync');
  const prior = { ...manifest, sourceBuiltAt: manifest.builtAt, posts: [] };
  let requests=0;
  const result = await resumeOrSync(prior,async url=> { requests++; return url.endsWith('blog-sync.json') ? JSON.stringify(manifest) : markdown; });
  assert.equal(result.posts.length,1);
  assert.equal(requests,2);
});
