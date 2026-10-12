import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Publishing Center exposes only current Pages and Substack targets', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');
  assert.match(source, /<strong>Substack<\/strong>/);
  assert.match(source, /<strong>GitHub Pages<\/strong>/);
  assert.doesNotMatch(source, /Paragraph|paragraph\.com/);
});
