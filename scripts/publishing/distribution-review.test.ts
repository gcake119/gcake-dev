import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewDigest } from './run-distribution';
import { renderedArticle } from './substack-browser';
const article = { slug: 'demo', sourceRevision: 'r', title: 'Demo', body: '# Hello\n\n[原文](https://gcake119.github.io/gcake-dev/posts/demo/)', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/demo/', publishedAt: '2026-09-28T00:00:00Z', assets: [], description: undefined };
test('review digest binds content, title, canonical, date, source revision and named platform', () => {
  const digest = reviewDigest(article, 'substack');
  for (const field of ['body', 'title', 'canonicalUrl', 'publishedAt', 'sourceRevision'] as const) assert.notEqual(reviewDigest({ ...article, [field]: article[field] + '-changed' }, 'substack'), digest);
  assert.notEqual(reviewDigest({...article, substackDatePrecision: 'minute'}, 'substack'), digest);
});
test('HTML scripts and event handlers never enter browser clipboard', () => {
  for (const body of ['<script>alert(1)</script>', '<img src="https://example.com/photo.png" onerror="alert(1)">', '[click](javascript:alert%281%29)']) assert.throws(() => renderedArticle({ ...article, body }), /SUBSTACK_UNSUPPORTED/);
});

test('Substack mirror review invalidates earlier canonical-strict receipts', async () => {
  const { createHash } = await import('node:crypto');
  const earlier = 'sha256:' + createHash('sha256').update(JSON.stringify({ article, target: 'substack', newsletter: 'skip' })).digest('hex');
  assert.notEqual(reviewDigest(article, 'substack'), earlier);
});
