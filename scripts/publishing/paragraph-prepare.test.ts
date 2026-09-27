import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareParagraphDryRun } from './paragraph-prepare';

test('Paragraph prepare resolves nested posts through the shared transform without writing', async (t) => {
  const postsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-paragraph-'));
  t.after(() => fs.rm(postsDir, { recursive: true, force: true }));
  await fs.mkdir(path.join(postsDir, 'series'), { recursive: true });
  await fs.copyFile('test/fixtures/publishing/full.md', path.join(postsDir, 'series', 'dry-run.md'));

  const result = await prepareParagraphDryRun('dry-run', postsDir);
  assert.equal(result.publication.slug, 'dry-run');
  assert.match(result.publication.sourceRevision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.plan.externalWriteEnabled, false);
  assert.equal(result.plan.newsletter, 'skip');
});
