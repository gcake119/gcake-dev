import assert from 'node:assert/strict';
import test from 'node:test';
import { isHealthResponse } from '@gcake/admin-contract';
import { handleRequest } from './index';

test('GET /health returns the shared healthy payload without production credentials', async () => {
  const response = await handleRequest(new Request('http://local.test/health'), {});

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);

  const payload: unknown = await response.json();
  assert.equal(isHealthResponse(payload), true);
  assert.deepEqual(payload, {
    status: 'ok',
    service: 'gcake-admin-worker',
    contractVersion: 'v1',
  });
});

test('unknown Worker routes return 404 without touching production bindings', async () => {
  const response = await handleRequest(new Request('http://local.test/not-found'), {});
  assert.equal(response.status, 404);
});
