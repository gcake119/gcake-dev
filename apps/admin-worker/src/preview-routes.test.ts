import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import { createPhase1Handler, type OAuthClient } from './router';

const oauth: OAuthClient = { authorizationUrl: () => '', exchangeCode: async () => '', fetchIdentity: async () => ({ githubUserId: '119', login: 'owner' }) };

test('formal preview route requires owner CSRF and forwards exact base plus unsaved draft', async () => {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, { now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf' });
  const inputs: unknown[] = [];
  const handle = createPhase1Handler({
    oauth, sessions, allowedGitHubUserIds: new Set(['119']), oauthStateSecret: 'secret', now: () => 1_001,
    previews: {
      create: async (input) => {
        inputs.push(input);
        return { id: 'preview-a', repository: input.repository, postSlug: input.slug, baseRevision: input.baseRevision, draftHash: 'hash', status: 'ready', url: 'https://preview.test/a', createdAt: '2026-09-28T00:00:00Z', updatedAt: '2026-09-28T00:00:01Z', expiresAt: '2026-09-28T01:00:00Z' };
      },
      get: async () => undefined,
    },
  });
  const missingCsrf = await handle(new Request('https://admin.test/api/v1/previews', { method: 'POST', headers: { cookie: 'gcake_session=session', 'content-type': 'application/json' }, body: '{}' }));
  assert.equal(missingCsrf.status, 403);
  const response = await handle(new Request('https://admin.test/api/v1/previews', {
    method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({ repository: 'gcake119/gcake-dev', slug: 'post', baseRevision: 'commit-a', draft: '# unsaved' }),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(inputs, [{ repository: 'gcake119/gcake-dev', slug: 'post', baseRevision: 'commit-a', draft: '# unsaved' }]);
});
