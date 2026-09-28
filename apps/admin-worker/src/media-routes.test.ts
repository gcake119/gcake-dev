import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import { MediaValidationError, type MediaRecord } from './media';
import { createPhase1Handler, type MediaApi, type OAuthClient } from './router';

const noOAuth: OAuthClient = {
  authorizationUrl: () => '', exchangeCode: async () => '',
  fetchIdentity: async () => ({ githubUserId: '119', login: 'owner' }),
};

const record: MediaRecord = {
  id: 'asset', key: 'posts/post/2026/09/asset-screen.png',
  url: 'https://media.gcake.dev/posts/post/2026/09/asset-screen.png', mime: 'image/png',
  width: 1200, height: 800, size: 4, hash: 'hash', createdAt: '2026-09-28T00:00:00.000Z',
};

async function handler(media: MediaApi) {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, {
    now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf',
  });
  return createPhase1Handler({
    oauth: noOAuth, sessions, media, allowedGitHubUserIds: new Set(['119']),
    oauthStateSecret: 'secret', now: () => 1_001,
  });
}

function fakeMedia(overrides: Partial<MediaApi> = {}): MediaApi {
  return {
    list: async () => [record], upload: async () => record, replace: async () => ({ ...record, id: 'new' }),
    usages: async () => [], delete: async () => ({ kind: 'deleted' }), ...overrides,
  };
}

test('authenticated media list exposes operational metadata without article copy', async () => {
  const handle = await handler(fakeMedia());
  const response = await handle(new Request('https://admin.test/api/v1/media', { headers: { cookie: 'gcake_session=session' } }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.media[0].url, record.url);
  assert.equal('alt' in payload.media[0], false);
  assert.equal('caption' in payload.media[0], false);
});

test('PNG upload requires CSRF and passes server-computed metadata to service', async () => {
  let received: Parameters<MediaApi['upload']>[0] | undefined;
  const handle = await handler(fakeMedia({ upload: async (input) => { received = input; return record; } }));
  const form = new FormData();
  form.set('slug', 'post'); form.set('width', '1200'); form.set('height', '800');
  form.set('file', new File([new Uint8Array([137, 80, 78, 71])], 'screen.png', { type: 'image/png' }));
  const response = await handle(new Request('https://admin.test/api/v1/media', {
    method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf' }, body: form,
  }));
  assert.equal(response.status, 201);
  assert.equal(received?.mime, 'image/png');
  assert.equal(received?.hash.length, 64);
});

test('invalid media fails with stable code and no successful response', async () => {
  const handle = await handler(fakeMedia({
    upload: async () => { throw new MediaValidationError('MEDIA_TYPE_NOT_ALLOWED', '僅支援 WebP、PNG 與 SVG。'); },
  }));
  const form = new FormData();
  form.set('slug', 'post'); form.set('width', '1'); form.set('height', '1');
  form.set('file', new File(['x'], 'bad.gif', { type: 'image/gif' }));
  const response = await handle(new Request('https://admin.test/api/v1/media', {
    method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf' }, body: form,
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'MEDIA_TYPE_NOT_ALLOWED');
});

test('used media deletion reports repository usages instead of deleting', async () => {
  const handle = await handler(fakeMedia({ delete: async () => ({ kind: 'blocked', usages: ['src/content/posts/a.md'] }) }));
  const response = await handle(new Request('https://admin.test/api/v1/media/asset', {
    method: 'DELETE', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({ confirmed: true }),
  }));
  assert.equal(response.status, 409);
  assert.deepEqual((await response.json()).error.details.usages, ['src/content/posts/a.md']);
});
