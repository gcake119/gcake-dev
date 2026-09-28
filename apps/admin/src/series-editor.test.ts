import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addSeriesSection,
  moveSeriesPost,
  moveSeriesSection,
  parseSeriesManifest,
  removeEmptySeriesSection,
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
