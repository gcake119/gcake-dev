import assert from 'node:assert/strict';
import test from 'node:test';
import type { PostSummary, SeriesSource } from '@gcake/admin-contract';
import { createStandaloneSource, filterPostsBySeries, standalonePosts, updatePostTitle } from './post-series';

const posts: readonly PostSummary[] = [
  { slug: 'standalone', path: 'src/content/posts/standalone.md', title: '單篇文章', status: 'draft', series: [], blobSha: 'one', commitSha: 'commit' },
  { slug: 'chapter', path: 'src/content/posts/chapter.md', title: '系列文章', status: 'ready', series: [{ slug: 'demo', title: '示範系列', sectionId: 'start', position: 0 }], blobSha: 'two', commitSha: 'commit' },
];

const series: readonly SeriesSource[] = [{
  slug: 'demo', path: 'src/content/series/demo.yaml', baseBlobSha: 'series', baseCommitSha: 'commit',
  source: 'slug: demo\ntitle: 示範系列\nstatus: active\nsections:\n  - id: start\n    title: 開始\n    status: active\n    posts:\n      - slug: chapter\n        status: ready\n',
}];

test('content list can identify and filter standalone posts', () => {
  assert.deepEqual(filterPostsBySeries(posts, 'standalone').map((post) => post.slug), ['standalone']);
  assert.deepEqual(filterPostsBySeries(posts, 'demo').map((post) => post.slug), ['chapter']);
  assert.deepEqual(filterPostsBySeries(posts, 'all').map((post) => post.slug), ['standalone', 'chapter']);
});

test('series editor offers only posts absent from every manifest', () => {
  assert.deepEqual(standalonePosts(posts, series).map((post) => post.slug), ['standalone']);
});

test('new post source is standalone and contains no permanent article-type or series fields', () => {
  const source = createStandaloneSource('新的單篇文章');
  assert.match(source, /title: 新的單篇文章/);
  assert.match(source, /status: draft/);
  assert.doesNotMatch(source, /series:|section:|order:|standalone:/);
});

test('editing an article title updates only the frontmatter title', () => {
  const source = '---\ntitle: 舊標題\nstatus: draft\n---\n\n# 舊標題仍可出現在正文\n';
  const updated = updatePostTitle(source, '新的：標題');

  assert.match(updated, /^---\ntitle: 新的：標題\nstatus: draft\n---/);
  assert.match(updated, /# 舊標題仍可出現在正文/);
});
