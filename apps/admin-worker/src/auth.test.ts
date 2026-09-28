import assert from 'node:assert/strict';
import test from 'node:test';
import {
  D1SessionStore,
  InMemorySessionStore,
  authorizeOwner,
  consumeOAuthState,
  createCmsSession,
  createOAuthState,
  requireCsrf,
} from './auth';

const owner = {
  githubUserId: '119',
  login: 'gcake119',
  avatarUrl: 'https://avatars.example/119',
};

test('immutable GitHub user ID allowlist rejects every other authenticated user', () => {
  assert.deepEqual(authorizeOwner(owner, new Set(['119'])), owner);
  assert.throws(
    () => authorizeOwner({ ...owner, githubUserId: '404' }, new Set(['119'])),
    /FORBIDDEN/,
  );
});

test('OAuth state is bounded, signed, and can only be consumed once', async () => {
  const state = await createOAuthState({
    secret: 'test-oauth-secret',
    now: () => 1_000,
    randomToken: () => 'oauth-random',
  });

  assert.match(state.cookie, /HttpOnly/);
  assert.match(state.cookie, /Secure/);
  assert.match(state.cookie, /SameSite=Lax/);
  assert.equal(
    await consumeOAuthState(state.value, state.cookieValue, {
      secret: 'test-oauth-secret',
      now: () => 1_001,
    }),
    true,
  );
  assert.equal(
    await consumeOAuthState(state.value, state.cookieValue, {
      secret: 'test-oauth-secret',
      now: () => 1_001,
    }),
    false,
  );
});

test('authorized login stores only a session-token hash and returns a secure cookie', async () => {
  const store = new InMemorySessionStore();
  const session = await createCmsSession(owner, store, {
    now: () => 10_000,
    randomToken: () => 'raw-session-token',
    randomCsrfToken: () => 'csrf-token',
  });

  assert.match(session.cookie, /HttpOnly/);
  assert.match(session.cookie, /Secure/);
  assert.match(session.cookie, /SameSite=Lax/);
  assert.doesNotMatch(session.cookie, /csrf-token/);
  assert.equal(store.containsRawToken('raw-session-token'), false);

  const stored = await store.findByRawToken('raw-session-token');
  assert.equal(stored?.user.githubUserId, '119');
  assert.equal(stored?.csrfToken, 'csrf-token');
});

test('D1 sessions persist only a hash and resolve the owner from the raw cookie', async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  let current: { sql: string; values: unknown[] };
  const database = {
    prepare(sql: string) {
      current = { sql, values: [] };
      return {
        bind(...values: unknown[]) { current.values = values; return this; },
        async run() { calls.push({ ...current, values: [...current.values] }); return {}; },
        async first<T>() {
          calls.push({ ...current, values: [...current.values] });
          return {
            id: 'session-1', github_user_id: '119', github_login: 'gcake119',
            github_avatar_url: null, token_hash: current.values[0], csrf_token: 'csrf-token',
            expires_at: 20_000,
          } as T;
        },
      };
    },
  };
  const store = new D1SessionStore(database);

  const created = await createCmsSession(owner, store, {
    now: () => 10_000,
    randomToken: () => 'raw-session-token',
    randomCsrfToken: () => 'csrf-token',
  });
  const found = await store.findByRawToken('raw-session-token');

  assert.match(calls[0]!.sql, /INSERT INTO cms_sessions/);
  assert.equal(JSON.stringify(calls).includes('raw-session-token'), false);
  assert.equal(found?.user.githubUserId, '119');
  assert.equal(found?.csrfToken, 'csrf-token');
  assert.match(created.cookie, /gcake_session=raw-session-token/);
});

test('state-changing requests require the session CSRF token', () => {
  const session = {
    id: 'session-1',
    user: owner,
    tokenHash: 'hash',
    csrfToken: 'csrf-token',
    expiresAt: 20_000,
  };

  assert.doesNotThrow(() => requireCsrf(
    new Request('https://admin.example/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': 'csrf-token' },
    }),
    session,
  ));
  assert.throws(
    () => requireCsrf(new Request('https://admin.example/api/v1/auth/logout', { method: 'POST' }), session),
    /FORBIDDEN/,
  );
});
