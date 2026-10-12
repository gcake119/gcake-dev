import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { main } from './run-distribution';
import type { openSubstackProfile } from './substack-browser';

test('login opens only the configured dashboard without article source or D1 credentials', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'distribution-login-'));
  const config = path.join(dir, 'config.json');
  await fs.writeFile(config, JSON.stringify({ substack: { writeEnabled: false, profile: path.join(dir, 'profile'), ui: { origin: 'https://gcakedev.substack.com', homePath: '/publish/home' } } }));
  const visited: string[] = [];
  const context = new EventEmitter() as EventEmitter & { newPage: () => Promise<unknown>; close: () => Promise<void> };
  context.newPage = async () => ({ goto: async (url: string) => { visited.push(url); setTimeout(() => context.emit('close'), 0); } });
  context.close = async () => {};
  try {
    await main(['login', 'substack', '--config', config], (async () => context) as unknown as typeof openSubstackProfile);
    assert.deepEqual(visited, ['https://gcakedev.substack.com/publish/home']);
    await assert.rejects(main(['login', 'paragraph', '--config', config]), /DISTRIBUTION_LOGIN_SUBSTACK_ONLY/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
