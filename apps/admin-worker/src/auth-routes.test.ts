import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemorySessionStore } from './auth';
import { createPhase1Handler, type OAuthClient } from './router';

function oauthClient(githubUserId: string): OAuthClient {
  return {
    authorizationUrl: (state) => `https://github.test/login?state=${state}`,
    exchangeCode: async (code) => `oauth-token:${code}`,
    fetchIdentity: async () => ({
      githubUserId,
      login: githubUserId === '119' ? 'gcake119' : 'intruder',
    }),
  };
}

test('mocked OAuth owner callback creates a bounded CMS session without exposing credentials', async () => {
  const sessions = new InMemorySessionStore();
  const handle = createPhase1Handler({
    oauth: oauthClient('119'),
    sessions,
    allowedGitHubUserIds: new Set(['119']),
    oauthStateSecret: 'state-secret',
    now: () => 1_000,
    randomToken: () => 'oauth-state',
    randomSessionToken: () => 'cms-session',
    randomCsrfToken: () => 'csrf-token',
  });

  const login = await handle(new Request('https://admin.test/api/v1/auth/login'));
  const stateCookie = login.headers.get('set-cookie') ?? '';
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('location'), 'https://github.test/login?state=oauth-state');

  const callback = await handle(new Request(
    'https://admin.test/api/v1/auth/callback?code=valid&state=oauth-state',
    { headers: { cookie: stateCookie } },
  ));
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get('set-cookie') ?? '', /gcake_session=cms-session/);

  const session = await handle(new Request('https://admin.test/api/v1/auth/session', {
    headers: { cookie: 'gcake_session=cms-session' },
  }));
  const payload = await session.json();
  assert.deepEqual(payload, {
    authenticated: true,
    user: { githubUserId: '119', login: 'gcake119' },
    csrfToken: 'csrf-token',
  });
  assert.equal(JSON.stringify(payload).includes('oauth-token'), false);
  assert.equal(JSON.stringify(payload).includes('cms-session'), false);
});

test('mocked OAuth rejects a non-owner and creates no authorized session', async () => {
  const sessions = new InMemorySessionStore();
  const handle = createPhase1Handler({
    oauth: oauthClient('404'),
    sessions,
    allowedGitHubUserIds: new Set(['119']),
    oauthStateSecret: 'state-secret',
    now: () => 1_000,
    randomToken: () => 'oauth-state-rejected',
    randomSessionToken: () => 'must-not-be-used',
    randomCsrfToken: () => 'must-not-be-used',
  });

  const login = await handle(new Request('https://admin.test/api/v1/auth/login'));
  const callback = await handle(new Request(
    'https://admin.test/api/v1/auth/callback?code=valid&state=oauth-state-rejected',
    { headers: { cookie: login.headers.get('set-cookie') ?? '' } },
  ));

  assert.equal(callback.status, 403);
  assert.deepEqual(await callback.json(), {
    error: {
      code: 'FORBIDDEN',
      message: '此 GitHub 帳號未獲授權。',
    },
  });
  assert.equal(await sessions.findByRawToken('must-not-be-used'), undefined);
});
