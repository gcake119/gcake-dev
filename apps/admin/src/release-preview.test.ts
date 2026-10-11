import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewRequests } from './release-preview.js';
test('changing article or date ignores a late preview response', async () => {
  const requests = createPreviewRequests();
  let finish!: (value: string) => void;
  const old = requests.run(() => new Promise<string>((resolve) => { finish = resolve; }));
  requests.invalidate();
  finish('old article/date');
  assert.equal(await old, undefined);
});
test('latest preview wins even when requests complete out of order', async () => {
  const requests = createPreviewRequests();
  let finish!: (value: string) => void;
  const old = requests.run(() => new Promise<string>((resolve) => { finish = resolve; }));
  assert.equal(await requests.run(async () => 'latest'), 'latest');
  finish('old');
  assert.equal(await old, undefined);
});
