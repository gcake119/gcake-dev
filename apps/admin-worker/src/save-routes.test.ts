import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import { RepositoryConflictError } from './git-writes';
import { InvalidSeriesError } from './series-validation';
import {
  createPhase1Handler,
  type GitHubContentWriter,
  type OAuthClient,
  type SeriesWriteValidator,
} from './router';

const noOAuth: OAuthClient = {
  authorizationUrl: () => '',
  exchangeCode: async () => '',
  fetchIdentity: async () => ({ githubUserId: '119', login: 'gcake119' }),
};

async function handler(
  writer: GitHubContentWriter,
  seriesValidator: SeriesWriteValidator = {
    validateAndSerialize: (manifest) => ({
      path: `src/content/series/${manifest.slug}.yaml`,
      yaml: `slug: ${manifest.slug}\n`,
    }),
  },
) {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'gcake119' }, sessions, {
    now: () => 1_000,
    randomToken: () => 'session',
    randomCsrfToken: () => 'csrf',
  });
  return createPhase1Handler({
    oauth: noOAuth,
    sessions,
    githubWrites: writer,
    seriesValidator,
    allowedGitHubUserIds: new Set(['119']),
    oauthStateSecret: 'secret',
    now: () => 1_001,
  });
}

test('series route validates before Git writes and returns actionable issues', async () => {
  let calls = 0;
  const handle = await handler({
    save: async () => { calls += 1; return { commitSha: 'commit', paths: [] }; },
    deletePost: async () => ({ kind: 'confirmation-required' }),
  }, {
    validateAndSerialize: () => { throw new InvalidSeriesError(['sections[0].posts[0] 找不到文章。']); },
  });
  const response = await handle(new Request('https://admin.test/api/v1/series/ai-camp', {
    method: 'POST',
    headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedBlobSha: 'series-old',
      expectedBaseCommitSha: 'commit-old',
      manifest: { slug: 'ai-camp', title: 'AI Camp', sections: [] },
    }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVALID_SERIES',
      message: '系列資料未通過驗證。',
      details: { issues: ['sections[0].posts[0] 找不到文章。'] },
    },
  });
  assert.equal(calls, 0);
});

test('series route saves exactly one canonical YAML file with optimistic revisions', async () => {
  const requests: Parameters<GitHubContentWriter['save']>[0][] = [];
  const handle = await handler({
    save: async (request) => {
      requests.push(request);
      return { commitSha: 'commit-new', paths: request.files.map((file) => file.path) };
    },
    deletePost: async () => ({ kind: 'confirmation-required' }),
  }, {
    validateAndSerialize: () => ({ path: 'src/content/series/ai-camp.yaml', yaml: 'slug: ai-camp\nsections: []\n' }),
  });
  const response = await handle(new Request('https://admin.test/api/v1/series/ai-camp', {
    method: 'POST',
    headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedBlobSha: 'series-old',
      expectedBaseCommitSha: 'commit-old',
      manifest: { slug: 'ai-camp', title: 'AI Camp', sections: [] },
    }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(requests, [{
    expectedBaseCommitSha: 'commit-old',
    message: 'Update series ai-camp',
    files: [{
      path: 'src/content/series/ai-camp.yaml',
      expectedBlobSha: 'series-old',
      source: 'slug: ai-camp\nsections: []\n',
    }],
  }]);
});

test('coherent article-plus-series save validates YAML before one Git transaction', async () => {
  const requests: Parameters<GitHubContentWriter['save']>[0][] = [];
  const handle = await handler({
    save: async (request) => {
      requests.push(request);
      return { commitSha: 'commit-new', paths: request.files.map((file) => file.path) };
    },
    deletePost: async () => ({ kind: 'confirmation-required' }),
  }, {
    validateAndSerialize: (manifest) => ({
      path: `src/content/series/${manifest.slug}.yaml`,
      yaml: `slug: ${manifest.slug}\nstatus: active\nsections: []\n`,
    }),
  });
  const response = await handle(new Request('https://admin.test/api/v1/posts/new-post', {
    method: 'POST',
    headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedBaseCommitSha: 'commit-old', message: 'Update article and series',
      files: [
        { path: 'src/content/posts/new-post.md', expectedBlobSha: 'post-old', source: 'post source' },
        { path: 'src/content/series/ai-camp.yaml', expectedBlobSha: 'series-old', source: 'slug: ai-camp\nstatus: active\nsections: []\n' },
      ],
    }),
  }));
  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.files.map((file) => file.path), [
    'src/content/posts/new-post.md', 'src/content/series/ai-camp.yaml',
  ]);
});

test('save route returns 409 revision details and never hides an optimistic conflict', async () => {
  let calls = 0;
  const handle = await handler({
    save: async () => {
      calls += 1;
      throw new RepositoryConflictError(
        'ARTICLE_CONFLICT', 'src/content/posts/post.md', 'old', 'new', 'commit-new',
      );
    },
    deletePost: async () => ({ kind: 'confirmation-required' }),
  });
  const response = await handle(new Request('https://admin.test/api/v1/posts/post', {
    method: 'POST',
    headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedBaseCommitSha: 'commit-old',
      message: 'Update post',
      files: [{ path: 'src/content/posts/post.md', expectedBlobSha: 'old', source: 'draft' }],
    }),
  }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'ARTICLE_CONFLICT',
      message: 'GitHub 上的內容已更新，未覆蓋較新的版本。',
      details: { currentBlobSha: 'new', currentCommitSha: 'commit-new' },
    },
  });
  assert.equal(calls, 1);
});

test('write routes require CSRF before invoking repository writes', async () => {
  let calls = 0;
  const handle = await handler({
    save: async () => { calls += 1; return { commitSha: 'commit', paths: [] }; },
    deletePost: async () => { calls += 1; return { kind: 'deleted', commitSha: 'commit' }; },
  });
  const response = await handle(new Request('https://admin.test/api/v1/posts/post', {
    method: 'POST',
    headers: { cookie: 'gcake_session=session', 'content-type': 'application/json' },
    body: '{}',
  }));
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});

test('delete route reports references and cannot delete without explicit confirmation', async () => {
  const handle = await handler({
    save: async () => ({ commitSha: 'commit', paths: [] }),
    deletePost: async (input) => input.confirmed
      ? { kind: 'blocked', seriesReferences: ['ai-camp'] }
      : { kind: 'confirmation-required' },
  });
  const request = (confirmed: boolean) => new Request('https://admin.test/api/v1/posts/post', {
    method: 'DELETE',
    headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' },
    body: JSON.stringify({ expectedBlobSha: 'blob', expectedBaseCommitSha: 'commit', confirmed }),
  });
  assert.equal((await handle(request(false))).status, 400);
  const referenced = await handle(request(true));
  assert.equal(referenced.status, 409);
  assert.equal((await referenced.json()).error.code, 'REFERENCED_RESOURCE');
});
