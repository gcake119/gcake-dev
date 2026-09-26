import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { listLocalPostFiles, localPostSlugFromEntry, resolveLocalPostFile } from './local-posts';

test('local post slug ignores parent folders', () => {
  assert.equal(
    localPostSlugFromEntry('ithome-2026-extensions/ithome-2026-chatgpt-writing-workflow.md'),
    'ithome-2026-chatgpt-writing-workflow',
  );
  assert.equal(localPostSlugFromEntry('system-design/cache.mdx'), 'cache');
});

test('local post discovery is recursive', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-posts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(path.join(root, 'series-a'), { recursive: true });
  await fs.writeFile(path.join(root, 'series-a', 'nested.md'), '# nested');
  await fs.writeFile(path.join(root, 'standalone.mdx'), '# standalone');
  await fs.writeFile(path.join(root, 'ignore.txt'), 'ignore');

  const files = await listLocalPostFiles(root);
  assert.deepEqual(files.map((file) => file.slug).sort(), ['nested', 'standalone']);
  assert.equal(await resolveLocalPostFile(root, 'nested'), path.join(root, 'series-a', 'nested.md'));
});

test('duplicate basenames are rejected when resolving a slug', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-posts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(path.join(root, 'series-a'), { recursive: true });
  await fs.mkdir(path.join(root, 'series-b'), { recursive: true });
  await fs.writeFile(path.join(root, 'series-a', 'same.md'), '# a');
  await fs.writeFile(path.join(root, 'series-b', 'same.mdx'), '# b');

  await assert.rejects(() => resolveLocalPostFile(root, 'same'), /Duplicate local post slug/);
});
