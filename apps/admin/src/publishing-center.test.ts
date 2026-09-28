import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Publishing Center discloses controlled Paragraph evidence without broadening newsletter or general writes', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');
  assert.match(source, /受控 cohort 已完成建立、更新、公開與 canonical 驗證/);
  assert.match(source, /其他文章仍預設只允許準備/);
  assert.match(source, /電子報未獲核准/);
  assert.match(source, /https:\/\/paragraph\.com\/@gcake\/gcake-cms-production-gate-20260928/);
  assert.doesNotMatch(source, /寄送 Paragraph 電子報/);
});
