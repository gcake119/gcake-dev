import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HEALTH_CONTRACT_VERSION,
  isApiErrorResponse,
  isSessionResponse,
  type ApiErrorResponse,
  type CreateSeriesRequest,
  type DeleteSeriesRequest,
  type SessionResponse,
  type UpdateSeriesRequest,
} from './index';

test('Admin API contract has a stable Phase 0 version', () => {
  assert.equal(HEALTH_CONTRACT_VERSION, 'v1');
});

test('Series lifecycle mutation contracts carry repository revisions', () => {
  const create: CreateSeriesRequest = { title: 'Agents', slug: 'agents', expectedBaseCommitSha: 'commit-a' };
  const update: UpdateSeriesRequest = {
    manifest: { slug: 'agents', title: 'Agent Workflows', sections: [] },
    expectedBlobSha: 'series-a', expectedBaseCommitSha: 'commit-a',
  };
  const remove: DeleteSeriesRequest = {
    expectedBlobSha: 'series-a', expectedBaseCommitSha: 'commit-a', confirmed: true,
  };
  assert.equal(create.expectedBaseCommitSha, 'commit-a');
  assert.equal(update.expectedBlobSha, 'series-a');
  assert.equal(remove.confirmed, true);
});

test('Phase 1 API errors use a stable shared envelope', () => {
  const error: ApiErrorResponse = {
    error: {
      code: 'UNAUTHENTICATED',
      message: '請先登入。',
      retryable: false,
    },
  };
  assert.equal(isApiErrorResponse(error), true);
  assert.equal(isApiErrorResponse({ error: { code: '', message: '' } }), false);
});

test('Session contract exposes owner identity and CSRF token without provider credentials', () => {
  const session: SessionResponse = {
    authenticated: true,
    user: {
      githubUserId: '119',
      login: 'gcake119',
    },
    csrfToken: 'csrf-token',
  };
  assert.equal(isSessionResponse(session), true);
  assert.equal('installationToken' in session, false);
  assert.equal(isSessionResponse({ authenticated: false }), true);
});
