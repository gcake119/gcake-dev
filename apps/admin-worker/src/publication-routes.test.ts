import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import { createPhase1Handler, type OAuthClient } from './router';

const oauth: OAuthClient = { authorizationUrl: () => '', exchangeCode: async () => '', fetchIdentity: async () => ({ githubUserId: '119', login: 'owner' }) };

test('saving content never invokes publication operations and explicit operation names one target', async () => {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, { now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf' });
  const operations: unknown[] = [];
  const handle = createPhase1Handler({
    oauth, sessions, allowedGitHubUserIds: new Set(['119']), oauthStateSecret: 'secret', now: () => 1_001,
    githubWrites: { save: async () => ({ commitSha: 'new', paths: [] }), deletePost: async () => ({ kind: 'confirmation-required' }) },
    publications: {
      states: async () => [],
      operate: async (input) => { operations.push(input); return { ...input, status: 'prepare_ready', updatedAt: 'now' }; },
    },
  });
  await handle(new Request('https://admin.test/api/v1/posts/demo', { method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' }, body: JSON.stringify({ expectedBaseCommitSha: 'base', message: 'save', files: [] }) }));
  assert.equal(operations.length, 0);
  const response = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', { method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' }, body: JSON.stringify({ sourceRevision: 'base', target: 'paragraph', operation: 'prepare' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(operations, [{ postSlug: 'demo', sourceRevision: 'base', target: 'paragraph', operation: 'prepare' }]);
});

test('newsletter route requires a separate irreversible intent key before reaching operations', async () => {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, { now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf' });
  const operations: unknown[] = [];
  const handle = createPhase1Handler({
    oauth, sessions, allowedGitHubUserIds: new Set(['119']), oauthStateSecret: 'secret', now: () => 1_001,
    publications: {
      states: async () => [],
      operate: async (input) => { operations.push(input); return { ...input, status: 'failed', updatedAt: 'now' }; },
    },
  });
  const headers = { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' };
  const missingIntent = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', {
    method: 'POST', headers,
    body: JSON.stringify({ sourceRevision: 'base', target: 'paragraph', operation: 'newsletter' }),
  }));
  assert.equal(missingIntent.status, 400);
  assert.equal(operations.length, 0);

  const explicitIntent = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', {
    method: 'POST', headers,
    body: JSON.stringify({
      sourceRevision: 'base', target: 'paragraph', operation: 'newsletter',
      newsletterIntentKey: 'newsletter-demo-base', explicitIrreversibleIntent: true,
    }),
  }));
  assert.equal(explicitIntent.status, 200);
  assert.deepEqual(operations, [{
    postSlug: 'demo', sourceRevision: 'base', target: 'paragraph', operation: 'newsletter',
    newsletterIntentKey: 'newsletter-demo-base', explicitIrreversibleIntent: true,
  }]);
});
