import assert from 'node:assert/strict';
import test from 'node:test';
import { moveSeriesPost, parseSeriesManifest } from './series-editor';

test('reordering is local UI state and preserves every post', () => {
  const original = parseSeriesManifest('slug: demo\ntitle: Demo\nstatus: active\nsections:\n  - id: one\n    title: One\n    status: active\n    posts:\n      - slug: a\n        status: planned\n      - slug: b\n        status: planned\n');
  const moved = moveSeriesPost(original, 'one', 1, -1);
  assert.deepEqual(moved.sections[0]?.posts.map((post) => post.slug), ['b', 'a']);
  assert.deepEqual(original.sections[0]?.posts.map((post) => post.slug), ['a', 'b']);
});
