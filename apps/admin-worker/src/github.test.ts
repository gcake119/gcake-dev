import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GITHUB_APP_PERMISSIONS,
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
