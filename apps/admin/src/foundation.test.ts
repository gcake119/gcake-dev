import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { HEALTH_CONTRACT_VERSION } from '@gcake/admin-contract';

test('Admin consumes the shared API contract package', () => {
  assert.equal(HEALTH_CONTRACT_VERSION, 'v1');
});

test('given a 320px viewport, the Admin shell does not enforce horizontal overflow', async () => {
  const css = await readFile(new URL('./admin.css', import.meta.url), 'utf8');

  assert.doesNotMatch(css, /body\s*\{[^}]*min-width:\s*320px/);
  assert.match(css, /html,\s*body,\s*#app\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*clip/);
});

test('Admin headings and article preview inherit the project system sans typography', async () => {
  const css = await readFile(new URL('./admin.css', import.meta.url), 'utf8');

  assert.doesNotMatch(css, /Georgia|Noto Serif TC/);
  assert.match(css, /\.public-content\s*\{[^}]*font:\s*1rem\/1\.8\s*inherit/);
});
