import assert from 'node:assert/strict';
import test from 'node:test';
import { isHealthResponse } from '@gcake/admin-contract';
import worker, { handleRequest } from './index';

test('GET /health returns the shared healthy payload without production credentials', async () => {
  const response = await handleRequest(new Request('http://local.test/health'), {});

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);

  const payload: unknown = await response.json();
  assert.equal(isHealthResponse(payload), true);
  assert.deepEqual(payload, {
    status: 'ok',
    service: 'gcake-admin-worker',
    contractVersion: 'v1',
  });
});

test('unknown Worker routes return 404 without touching production bindings', async () => {
  const response = await handleRequest(new Request('http://local.test/not-found'), {});
  assert.equal(response.status, 404);
});

test('Worker entrypoint exposes the CMS session route without requiring provider writes', async () => {
  const response = await handleRequest(
    new Request('http://local.test/api/v1/auth/session'),
    {
      CMS_DB: {
        prepare: () => ({
          bind() { return this; },
          async run() { return {}; },
          async first() { return null; },
        }),
      },
      PARAGRAPH_WRITE_ENABLED: 'false',
      SUBSTACK_WRITE_ENABLED: 'false',
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('Worker entrypoint fails closed before OAuth when required secrets are missing', async () => {
  const response = await handleRequest(
    new Request('http://local.test/api/v1/auth/login'),
    {
      CMS_DB: {
        prepare: () => ({
          bind() { return this; },
          async run() { return {}; },
          async first() { return null; },
        }),
      },
      PARAGRAPH_WRITE_ENABLED: 'false',
      SUBSTACK_WRITE_ENABLED: 'false',
    },
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.has('set-cookie'), false);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'RUNTIME_NOT_CONFIGURED',
      message: 'CMS 登入服務尚未完成設定。',
    },
  });
});

test('Worker entrypoint wires GitHub App installation credentials into repository reads', async () => {
  const privateKey = await createTestPrivateKey();
  const response = await handleRequest(
    new Request('http://local.test/api/v1/posts', { headers: { cookie: 'gcake_session=owner-session' } }),
    {
      CMS_DB: {
        prepare: () => ({
          bind() { return this; },
          async run() { return {}; },
          async first<T>() {
            return {
              id: 'session-1', github_user_id: '119', github_login: 'gcake119',
              github_avatar_url: null, token_hash: 'stored-hash', csrf_token: 'csrf-token',
              expires_at: Date.now() + 60_000,
            } as T;
          },
        }),
      },
      GITHUB_APP_ID: '12345',
      GITHUB_APP_INSTALLATION_ID: '67890',
      GITHUB_APP_PRIVATE_KEY: privateKey,
      PARAGRAPH_WRITE_ENABLED: 'false',
      SUBSTACK_WRITE_ENABLED: 'false',
    },
    async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/app/installations/67890/access_tokens') {
        return Response.json({ token: 'installation-token' });
      }
      if (url.pathname === '/repos/gcake119/gcake-dev') {
        return Response.json({ full_name: 'gcake119/gcake-dev', default_branch: 'main', private: false });
      }
      if (url.pathname === '/repos/gcake119/gcake-dev/branches/main') {
        return Response.json({ commit: { sha: 'commit-main', commit: { tree: { sha: 'tree-main' } } } });
      }
      if (url.pathname === '/repos/gcake119/gcake-dev/git/trees/tree-main') {
        return Response.json({ tree: [] });
      }
      return Response.json({}, { status: 404 });
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { posts: [] });
});

test('Cloudflare execution context is not mistaken for the outbound fetch function', async () => {
  const privateKey = await createTestPrivateKey();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/app/installations/67890/access_tokens') {
      return Response.json({ token: 'installation-token' });
    }
    if (url.pathname === '/repos/gcake119/gcake-dev') {
      return Response.json({ full_name: 'gcake119/gcake-dev', default_branch: 'main', private: false });
    }
    if (url.pathname === '/repos/gcake119/gcake-dev/branches/main') {
      return Response.json({ commit: { sha: 'commit-main', commit: { tree: { sha: 'tree-main' } } } });
    }
    if (url.pathname === '/repos/gcake119/gcake-dev/git/trees/tree-main') {
      return Response.json({ tree: [] });
    }
    return Response.json({}, { status: 404 });
  };

  try {
    const response = await worker.fetch(
      new Request('http://local.test/api/v1/posts', { headers: { cookie: 'gcake_session=owner-session' } }),
      {
        CMS_DB: {
          prepare: () => ({
            bind() { return this; },
            async run() { return {}; },
            async first<T>() {
              return {
                id: 'session-1', github_user_id: '119', github_login: 'gcake119',
                github_avatar_url: null, token_hash: 'stored-hash', csrf_token: 'csrf-token',
                expires_at: Date.now() + 60_000,
              } as T;
            },
          }),
        },
        GITHUB_APP_ID: '12345',
        GITHUB_APP_INSTALLATION_ID: '67890',
        GITHUB_APP_PRIVATE_KEY: privateKey,
        PARAGRAPH_WRITE_ENABLED: 'false',
        SUBSTACK_WRITE_ENABLED: 'false',
      },
      { waitUntil() {}, passThroughOnException() {} } as never,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { posts: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function createTestPrivateKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const bytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const base64 = Buffer.from(bytes).toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
}
