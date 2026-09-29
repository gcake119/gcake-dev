import assert from 'node:assert/strict';
import test from 'node:test';
import { requestSlugSuggestion } from './slug-suggestion';

test('empty title does not send a request', async () => {
  let calls = 0;
  const result = await requestSlugSuggestion('   ', 'http://127.0.0.1:4319', async () => {
    calls += 1;
    return Response.json({ slug: 'unused-slug-value' });
  });
  assert.deepEqual(result, { kind: 'empty-title' });
  assert.equal(calls, 0);
});

test('returns a safe suggestion without invoking any CMS save endpoint', async () => {
  const urls: string[] = [];
  const result = await requestSlugSuggestion('標題', 'http://127.0.0.1:4319/', async (url) => {
    urls.push(String(url));
    return Response.json({ slug: 'semantic-technical-article' });
  });
  assert.deepEqual(result, { kind: 'suggested', slug: 'semantic-technical-article' });
  assert.deepEqual(urls, ['http://127.0.0.1:4319/api/slug-suggestions']);
  assert.equal(urls.some((url) => url.startsWith('/api/v1/posts')), false);
});

test('invalid, unavailable, or unconfigured responses preserve manual editing', async () => {
  assert.deepEqual(await requestSlugSuggestion('標題', '', async () => Response.json({ slug: 'unused' })), { kind: 'unavailable' });
  assert.deepEqual(await requestSlugSuggestion('標題', 'http://local', async () => Response.json({ error: {} }, { status: 503 })), { kind: 'unavailable' });
  assert.deepEqual(await requestSlugSuggestion('標題', 'http://local', async () => Response.json({ slug: 'INVALID VALUE' })), { kind: 'unavailable' });
});
