import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  GITHUB_APP_PERMISSIONS,
  GitHubAppInstallationTokenProvider,
  GitHubAppReadClient,
  GitHubAppWriteClient,
} from './github';

test('GitHub App boundary is pinned to the approved repository and least privileges', () => {
  assert.deepEqual(GITHUB_APP_PERMISSIONS, {
    repository: 'gcake119/gcake-dev',
    metadata: 'read',
    contents: 'read-write',
    actions: 'read',
    actionsWrite: false,
  });
});

test('installation token remains server-side and Phase 1 performs GET only', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new GitHubAppReadClient({
    installationTokens: {
      create: async () => 'server-installation-token',
    },
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json({
        full_name: 'gcake119/gcake-dev',
        default_branch: 'main',
        private: false,
      });
    },
  });

  const repository = await client.getRepository();

  assert.deepEqual(repository, {
    fullName: 'gcake119/gcake-dev',
    defaultBranch: 'main',
    private: false,
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.init?.method, 'GET');
  assert.equal(new Headers(requests[0]?.init?.headers).get('authorization'), 'Bearer server-installation-token');
  assert.equal(JSON.stringify(repository).includes('server-installation-token'), false);
  assert.equal('writeFile' in client, false);
  assert.equal('dispatchWorkflow' in client, false);
});

test('GitHub App installation provider signs a short-lived JWT and exchanges it server-side', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const privateKey = await createTestPrivateKey();
  const provider = new GitHubAppInstallationTokenProvider({
    appId: '12345',
    installationId: '67890',
    privateKey,
    now: () => 1_000_000,
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      return Response.json({ token: 'installation-token', expires_at: '2030-01-01T00:00:00Z' });
    },
  });

  assert.equal(await provider.create(), 'installation-token');
  assert.equal(await provider.create(), 'installation-token');
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, 'https://api.github.com/app/installations/67890/access_tokens');
  assert.equal(requests[0]?.init?.method, 'POST');
  const authorization = new Headers(requests[0]?.init?.headers).get('authorization');
  assert.match(authorization ?? '', /^Bearer [^.]+\.[^.]+\.[^.]+$/);
  assert.equal(JSON.stringify(requests).includes(privateKey), false);
});

test('GitHub App installation provider accepts GitHub-generated PKCS#1 private keys', async () => {
  const privateKey = createTestPkcs1PrivateKey();
  const provider = new GitHubAppInstallationTokenProvider({
    appId: '12345',
    installationId: '67890',
    privateKey,
    now: () => 1_000_000,
    fetch: async () => Response.json({
      token: 'installation-token', expires_at: '2030-01-01T00:00:00Z',
    }),
  });

  assert.equal(await provider.create(), 'installation-token');
});

test('GitHub read client returns repository-derived posts, series, and deployment state', async () => {
  const responses = new Map<string, unknown>([
    ['/repos/gcake119/gcake-dev', { full_name: 'gcake119/gcake-dev', default_branch: 'main', private: false }],
    ['/repos/gcake119/gcake-dev/branches/main', {
      commit: { sha: 'commit-main', commit: { tree: { sha: 'tree-main' } } },
    }],
    ['/repos/gcake119/gcake-dev/git/trees/tree-main?recursive=1', {
      tree: [
        { path: 'src/content/posts/hello.md', type: 'blob', sha: 'post-blob' },
        { path: 'src/content/posts/standalone.md', type: 'blob', sha: 'standalone-blob' },
        { path: 'src/content/series/notes.yaml', type: 'blob', sha: 'series-blob' },
      ],
    }],
    ['/repos/gcake119/gcake-dev/git/blobs/post-blob', {
      encoding: 'base64',
      content: Buffer.from('---\ntitle: Hello\nstatus: draft\n---\nBody').toString('base64'),
    }],
    ['/repos/gcake119/gcake-dev/git/blobs/standalone-blob', {
      encoding: 'base64',
      content: Buffer.from('---\ntitle: Standalone\nstatus: draft\n---\nBody').toString('base64'),
    }],
    ['/repos/gcake119/gcake-dev/git/blobs/series-blob', {
      encoding: 'base64',
      content: Buffer.from('slug: notes\ntitle: Notes\nsections:\n  - id: start\n    title: Start\n    status: active\n    posts:\n      - slug: hello\n        status: draft\n').toString('base64'),
    }],
    ['/repos/gcake119/gcake-dev/actions/runs?branch=main&per_page=1', {
      workflow_runs: [{
        head_sha: 'commit-main', status: 'completed', conclusion: 'success',
        run_started_at: '2026-09-28T01:00:00Z', updated_at: '2026-09-28T01:05:00Z',
        html_url: 'https://github.com/gcake119/gcake-dev/actions/runs/1',
      }],
    }],
  ]);
  const client = new GitHubAppReadClient({
    installationTokens: { create: async () => 'server-installation-token' },
    fetch: async (input) => {
      const path = new URL(String(input)).pathname + new URL(String(input)).search;
      const value = responses.get(path);
      return value ? Response.json(value) : Response.json({}, { status: 404 });
    },
  });

  assert.deepEqual(await client.listPosts(), [{
    slug: 'hello', path: 'src/content/posts/hello.md', title: 'Hello', status: 'draft',
    series: [{ slug: 'notes', title: 'Notes', sectionId: 'start', position: 0 }], blobSha: 'post-blob', commitSha: 'commit-main',
  }, {
    slug: 'standalone', path: 'src/content/posts/standalone.md', title: 'Standalone', status: 'draft',
    series: [], blobSha: 'standalone-blob', commitSha: 'commit-main',
  }]);
  assert.deepEqual((await client.getPost('hello'))?.series, [{ slug: 'notes', title: 'Notes', sectionId: 'start', position: 0 }]);
  assert.deepEqual((await client.getPost('standalone'))?.series, []);
  assert.deepEqual((await client.listSeries()).map(({ slug, title, postCount }) => ({ slug, title, postCount })), [{
    slug: 'notes', title: 'Notes', postCount: 1,
  }]);
  assert.match((await client.listSeries())[0]?.source ?? '', /slug: notes[\s\S]*slug: hello/);
  assert.equal((await client.getSeries('notes'))?.baseCommitSha, 'commit-main');
  assert.deepEqual(await client.getLatestDeployment(), {
    state: 'deployed', commitSha: 'commit-main', startedAt: '2026-09-28T01:00:00Z',
    completedAt: '2026-09-28T01:05:00Z',
    url: 'https://github.com/gcake119/gcake-dev/actions/runs/1',
  });
});

test('GitHub write client creates one optimistic Git Data commit and advances the branch without force', async () => {
  const requests: Array<{ path: string; method: string; body?: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    requests.push({ path: url.pathname + url.search, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === '/repos/gcake119/gcake-dev' && method === 'GET') return Response.json({ default_branch: 'main' });
    if (url.pathname.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'base-commit' } });
    if (url.pathname.includes('/contents/src/content/series/new-series.yaml')) return Response.json({}, { status: 404 });
    if (url.pathname.endsWith('/git/commits/base-commit')) return Response.json({ tree: { sha: 'base-tree' } });
    if (url.pathname.endsWith('/git/blobs')) return Response.json({ sha: 'new-blob' });
    if (url.pathname.endsWith('/git/trees')) return Response.json({ sha: 'new-tree' });
    if (url.pathname.endsWith('/git/commits')) return Response.json({ sha: 'new-commit' });
    if (url.pathname.endsWith('/git/refs/heads/main')) return Response.json({ object: { sha: 'new-commit' } });
    return Response.json({}, { status: 500 });
  };
  const reader = new GitHubAppReadClient({ installationTokens: { create: async () => 'token' }, fetch: fetcher });
  const writer = new GitHubAppWriteClient({ installationTokens: { create: async () => 'token' }, fetch: fetcher, reader });

  assert.deepEqual(await writer.save({
    expectedBaseCommitSha: 'base-commit', message: 'Create series new-series',
    files: [{ path: 'src/content/series/new-series.yaml', source: 'slug: new-series\nsections: []\n' }],
  }), { commitSha: 'new-commit', paths: ['src/content/series/new-series.yaml'] });
  assert.deepEqual(requests.find((request) => request.path.endsWith('/git/trees'))?.body, {
    base_tree: 'base-tree', tree: [{ path: 'src/content/series/new-series.yaml', mode: '100644', type: 'blob', sha: 'new-blob' }],
  });
  assert.deepEqual(requests.find((request) => request.method === 'PATCH')?.body, { sha: 'new-commit', force: false });
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

function createTestPkcs1PrivateKey(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ format: 'pem', type: 'pkcs1' }).toString();
}
