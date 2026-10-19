import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Publishing Center source excludes the retired Paragraph integration', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Paragraph|paragraph\.com/);
});
