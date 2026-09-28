import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readProviderWriteFlags } from './bindings';

test('Missing production flags keep every provider write disabled', () => {
  assert.deepEqual(readProviderWriteFlags({}), {
    paragraph: false,
    substack: false,
  });
});

test('Invalid provider write flags fail closed instead of silently enabling writes', () => {
  assert.throws(
    () => readProviderWriteFlags({ PARAGRAPH_WRITE_ENABLED: 'yes' }),
    /PARAGRAPH_WRITE_ENABLED/,
  );
});

test('Wrangler local and preview bindings use separate non-production resources', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.match(config, /database_name = "gcake-cms-development"/);
  assert.match(config, /bucket_name = "gcake-media-development"/);
  assert.match(config, /database_name = "gcake-cms-preview"/);
  assert.match(config, /bucket_name = "gcake-media-preview"/);
  assert.match(config, /\[env\.production\.vars\][\s\S]*PARAGRAPH_WRITE_ENABLED = "false"/);
  assert.doesNotMatch(config, /\[\[env\.production\.(d1_databases|r2_buckets)\]\]/);
});
