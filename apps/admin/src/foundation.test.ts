import assert from 'node:assert/strict';
import test from 'node:test';
import { HEALTH_CONTRACT_VERSION } from '@gcake/admin-contract';

test('Admin consumes the shared API contract package', () => {
  assert.equal(HEALTH_CONTRACT_VERSION, 'v1');
});
