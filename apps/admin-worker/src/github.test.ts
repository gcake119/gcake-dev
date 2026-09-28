import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  GITHUB_APP_PERMISSIONS,
  GitHubAppInstallationTokenProvider,
  GitHubAppReadClient,
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
        { path: 'src/content/series/notes.yaml', type: 'blob', sha: 'series-blob' },
      ],
    }],
    ['/repos/gcake119/gcake-dev/git/blobs/post-blob', {
      encoding: 'base64',
      content: Buffer.from('---\ntitle: Hello\nstatus: draft\n---\nBody').toString('base64'),
    }],
    ['/repos/gcake119/gcake-dev/git/blobs/series-blob', {
      encoding: 'base64',
      content: Buffer.from('slug: notes\ntitle: Notes').toString('base64'),
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
    blobSha: 'post-blob', commitSha: 'commit-main',
  }]);
  assert.equal((await client.getPost('hello'))?.body, 'Body');
  assert.equal((await client.listSeries())[0]?.source, 'slug: notes\ntitle: Notes');
  assert.equal((await client.getSeries('notes'))?.baseCommitSha, 'commit-main');
  assert.deepEqual(await client.getLatestDeployment(), {
    state: 'deployed', commitSha: 'commit-main', startedAt: '2026-09-28T01:00:00Z',
    completedAt: '2026-09-28T01:05:00Z',
    url: 'https://github.com/gcake119/gcake-dev/actions/runs/1',
  });
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
