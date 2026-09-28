import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import {
  createPhase1Handler,
  type GitHubContentReader,
  type OAuthClient,
} from './router';

const noOAuth: OAuthClient = {
  authorizationUrl: () => 'https://github.test/login',
  exchangeCode: async () => {
    throw new Error('not used');
  },
  fetchIdentity: async () => {
    throw new Error('not used');
  },
};

async function authorizedHandler(github: GitHubContentReader) {
  const sessions = new InMemorySessionStore();
  await createCmsSession(
    { githubUserId: '119', login: 'gcake119' },
    sessions,
    {
      now: () => 1_000,
      randomToken: () => 'owner-session',
      randomCsrfToken: () => 'csrf-token',
    },
  );
  return createPhase1Handler({
    oauth: noOAuth,
    sessions,
    github,
    allowedGitHubUserIds: new Set(['119']),
    oauthStateSecret: 'state-secret',
    now: () => 1_001,
  });
}

test('authorized owner browses repository-derived posts with blob and commit SHAs', async () => {
  const calls: string[] = [];
  const github: GitHubContentReader = {
    listPosts: async () => {
      calls.push('listPosts');
      return [{
        slug: 'phase-one',
        path: 'src/content/posts/phase-one.md',
        title: 'Phase one',
        status: 'draft',
        blobSha: 'blob-list',
        commitSha: 'commit-list',
      }];
    },
    getPost: async (slug) => {
      calls.push(`getPost:${slug}`);
      return {
        slug,
        path: `src/content/posts/${slug}.md`,
        source: '---\ntitle: Phase one\n---\nBody',
        frontmatter: { title: 'Phase one', status: 'draft' },
        body: 'Body',
        baseBlobSha: 'blob-detail',
        baseCommitSha: 'commit-detail',
      };
    },
    listSeries: async () => [],
    getSeries: async () => undefined,
    getLatestDeployment: async () => undefined,
  };
  const handle = await authorizedHandler(github);
  const headers = { cookie: 'gcake_session=owner-session' };

  const listResponse = await handle(new Request('https://admin.test/api/v1/posts', { headers }));
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), {
    posts: [{
      slug: 'phase-one',
      path: 'src/content/posts/phase-one.md',
      title: 'Phase one',
      status: 'draft',
      blobSha: 'blob-list',
      commitSha: 'commit-list',
    }],
  });

  const detailResponse = await handle(new Request(
    'https://admin.test/api/v1/posts/phase-one',
    { headers },
  ));
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.baseBlobSha, 'blob-detail');
  assert.equal(detail.baseCommitSha, 'commit-detail');
  assert.equal(detail.source.includes('Body'), true);
  assert.deepEqual(calls, ['listPosts', 'getPost:phase-one']);
});

test('content routes reject unauthenticated requests before calling GitHub', async () => {
  let githubCalls = 0;
  const github: GitHubContentReader = {
    listPosts: async () => {
      githubCalls += 1;
      return [];
    },
    getPost: async () => undefined,
    listSeries: async () => [],
    getSeries: async () => undefined,
    getLatestDeployment: async () => undefined,
  };
  const handle = await authorizedHandler(github);

  const response = await handle(new Request('https://admin.test/api/v1/posts'));
  assert.equal(response.status, 401);
  assert.equal(githubCalls, 0);
});

test('authorized owner browses repository-derived series with base SHAs', async () => {
  const github: GitHubContentReader = {
    listPosts: async () => [],
    getPost: async () => undefined,
    listSeries: async () => [{
      slug: 'agent-camp',
      path: 'src/content/series/agent-camp.yaml',
      source: 'title: Agent Camp',
      baseBlobSha: 'series-list-blob',
      baseCommitSha: 'series-list-commit',
    }],
    getSeries: async (slug) => ({
      slug,
      path: `src/content/series/${slug}.yaml`,
      source: 'title: Agent Camp',
      baseBlobSha: 'series-detail-blob',
      baseCommitSha: 'series-detail-commit',
    }),
    getLatestDeployment: async () => undefined,
  };
  const handle = await authorizedHandler(github);
  const headers = { cookie: 'gcake_session=owner-session' };

  const list = await handle(new Request('https://admin.test/api/v1/series', { headers }));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).series[0].baseBlobSha, 'series-list-blob');

  const detail = await handle(new Request(
    'https://admin.test/api/v1/series/agent-camp',
    { headers },
  ));
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).baseCommitSha, 'series-detail-commit');
});
