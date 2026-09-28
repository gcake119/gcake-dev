import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceName } from './index';

test('Worker runtime has an independent entry point', () => {
  assert.equal(serviceName, 'gcake-admin-worker');
});
