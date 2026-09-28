import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
