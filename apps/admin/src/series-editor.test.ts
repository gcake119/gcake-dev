import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addSeriesSection,
  addSeriesPost,
  createSeriesManifest,
  moveSeriesPost,
  moveSeriesSection,
  parseSeriesManifest,
  removeEmptySeriesSection,
  serializeSeriesManifest,
  seriesDeleteConfirmation,
  updateSeriesMetadata,
  updateSeriesSection,
} from './series-editor';

test('reordering is local UI state and preserves every post', () => {
  const original = parseSeriesManifest('slug: demo\ntitle: Demo\nstatus: active\nsections:\n  - id: one\n    title: One\n    status: active\n    posts:\n      - slug: a\n        status: planned\n      - slug: b\n        status: planned\n');
  const moved = moveSeriesPost(original, 'one', 1, -1);
  assert.deepEqual(moved.sections[0]?.posts.map((post) => post.slug), ['b', 'a']);
  assert.deepEqual(original.sections[0]?.posts.map((post) => post.slug), ['a', 'b']);
});

test('adding a section creates the next unique chapter without mutating the source manifest', () => {
  const original = parseSeriesManifest('slug: demo\ntitle: Demo\nstatus: active\nsections:\n  - id: chapter-1\n    title: One\n    status: active\n    posts: []\n  - id: chapter-3\n    title: Three\n    status: planned\n    posts: []\n');

  const updated = addSeriesSection(original);

  assert.equal(updated.sections.at(-1)?.id, 'chapter-2');
  assert.equal(updated.sections.at(-1)?.title, '新章節');
  assert.equal(updated.sections.at(-1)?.status, 'planned');
  assert.deepEqual(updated.sections.at(-1)?.posts, []);
  assert.equal(original.sections.length, 2);
});

test('section details, order, and empty-section removal are editable without losing posts', () => {
  const original = parseSeriesManifest('slug: demo\ntitle: Demo\nstatus: active\nsections:\n  - id: one\n    title: One\n    status: active\n    posts:\n      - slug: a\n        status: planned\n  - id: two\n    title: Two\n    status: planned\n    posts: []\n');

  const edited = updateSeriesSection(original, 'one', { id: 'chapter-1', title: '第一章', status: 'completed' });
  const moved = moveSeriesSection(edited, 1, -1);
  const protectedManifest = removeEmptySeriesSection(moved, 'chapter-1');
  const removed = removeEmptySeriesSection(protectedManifest, 'two');

  assert.deepEqual(edited.sections[0], {
    id: 'chapter-1', title: '第一章', status: 'completed', posts: [{ slug: 'a', status: 'planned' }],
  });
  assert.deepEqual(moved.sections.map((section) => section.id), ['two', 'chapter-1']);
  assert.equal(protectedManifest.sections.length, 2);
  assert.deepEqual(removed.sections.map((section) => section.id), ['chapter-1']);
  assert.equal(original.sections[0]?.id, 'one');
});

test('a standalone post can be added through the manifest without article frontmatter fields', () => {
  const original = parseSeriesManifest('slug: demo\ntitle: Demo\nstatus: active\nsections:\n  - id: one\n    title: One\n    status: active\n    posts: []\n');
  const updated = addSeriesPost(original, 'one', { slug: 'standalone', status: 'draft' });
  const yaml = serializeSeriesManifest(updated);

  assert.deepEqual(updated.sections[0]?.posts, [{ slug: 'standalone', status: 'draft' }]);
  assert.match(yaml, /slug: standalone/);
  assert.doesNotMatch(yaml, /frontmatter|section:|order:/);
});

test('new series defaults are canonical and contain no articles', () => {
  assert.deepEqual(createSeriesManifest('Agent Workflows', 'agent-workflows'), {
    slug: 'agent-workflows', title: 'Agent Workflows', status: 'planned', featured: false,
    editorial: { currentPost: undefined, nextPost: undefined },
    source: { type: 'local' }, canonical: { mode: 'local' }, sections: [],
  });
});

test('series title and slug edits preserve membership, order, and unknown fields', () => {
  const original = parseSeriesManifest('slug: old-series\ntitle: Old\nstatus: active\ncustom: keep\neditorial:\n  currentPost: one\nsections:\n  - id: start\n    title: Start\n    status: active\n    posts:\n      - slug: one\n        status: draft\n      - slug: two\n        status: planned\n');
  const updated = updateSeriesMetadata(original, { title: 'New', slug: 'new-series' });
  assert.equal(updated.title, 'New');
  assert.equal(updated.slug, 'new-series');
  assert.equal(updated.custom, 'keep');
  assert.deepEqual(updated.editorial, { currentPost: 'one' });
  assert.deepEqual(updated.sections[0]?.posts.map((post) => post.slug), ['one', 'two']);
});

test('series deletion confirmation explicitly says articles remain', () => {
  assert.match(seriesDeleteConfirmation('Agent Workflows', 3), /不會刪除 3 篇文章/);
  assert.match(seriesDeleteConfirmation('Empty', 0), /不會刪除文章/);
});
