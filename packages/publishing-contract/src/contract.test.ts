import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROVIDER_WRITE_FLAGS,
  SOURCE_OF_TRUTH,
  assertProviderWriteEnabled,
} from './index';

test('Publishing ownership remains explicit across GitHub, R2, and D1', () => {
  assert.deepEqual(SOURCE_OF_TRUTH, {
    editorial: 'github',
    media: 'r2',
    runtime: 'd1',
  });
});

test('Provider writes default off and fail closed for Paragraph and Substack', () => {
  assert.deepEqual(DEFAULT_PROVIDER_WRITE_FLAGS, {
    paragraph: false,
    substack: false,
  });
  assert.throws(
    () => assertProviderWriteEnabled('paragraph', DEFAULT_PROVIDER_WRITE_FLAGS),
    /explicitly enabled/,
  );
  assert.throws(
    () => assertProviderWriteEnabled('substack', DEFAULT_PROVIDER_WRITE_FLAGS),
    /explicitly enabled/,
  );
});
