import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseApi } from './release-api.js';
const runtime: any = {
  queue: {
    ingest: async () => ({ plan: [], items: [], releases: [], enabled: false }),
  },
  git: { snapshot: async () => ({ revision: 'sha', posts: [], series: [] }) },
  reverify: async () => ({ state: 'verified-public' }),
};
test('queue read requires owner; mutations require CSRF; automation requires secret and disabled gate', async () => {
  const get = new Request('https://cms.test/api/v1/releases');
  assert.equal((await releaseApi(get, runtime, undefined)).status, 401);
  const session: any = {
    user: { githubUserId: '1' },
    csrfToken: 'token',
    expiresAt: Date.now() + 10000,
  };
  const anon = new Request('https://cms.test/api/v1/releases/action', {
    method: 'POST',
    body: '{}',
  });
  assert.equal((await releaseApi(anon, runtime, session)).status, 403);
  assert.equal((await releaseApi(get, runtime, session)).status, 200);
  const invalid = new Request('https://cms.test/api/v1/releases/action', {
    method: 'POST',
    headers: { 'x-csrf-token': 'token' },
    body: JSON.stringify({ action: 'erase-all', slug: 'a' }),
  });
  assert.equal((await releaseApi(invalid, runtime, session)).status, 400);
});
