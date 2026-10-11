import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDistributionBundle, writeDistributionBundle } from './prepare-distribution';

const valid = `---
title: Example
description: Testing distribution
status: published
publishedAt: 2026-09-28
---
Hello distribution.
`;

test('prepares both platforms with identical canonical source and writes disabled', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-distribution-'));
  try {
    await fs.writeFile(path.join(dir, 'example.md'), valid);
    const bundle = await buildDistributionBundle('example', dir, { paragraph: 'remote-123' }, () => '2026-10-11T00:00:00Z');
    assert.equal(bundle.newsletter, 'skip');
    assert.equal(bundle.mode, 'dry-run');
    assert.equal(bundle.targets.paragraph.operation, 'update-draft');
    assert.equal(bundle.targets.substack.operation, 'create-draft');
    assert.equal(bundle.targets.substack.externalWriteEnabled, false);
    assert.equal(bundle.targets.paragraph.remoteId, 'remote-123');
    assert.match(bundle.article.markdown, /Hello distribution/);
    assert.match(bundle.article.markdown, /原文與最新版本/);
    assert.ok(bundle.sourceRevision.startsWith('sha256:'));
    const out = await writeDistributionBundle(bundle, path.join(dir, 'handoff'));
    await assert.rejects(() => writeDistributionBundle(bundle, path.dirname(out)), /EEXIST/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('invalid slugs and missing content fail closed', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-distribution-'));
  try {
    await assert.rejects(() => buildDistributionBundle('../secret', dir), /INVALID_POST_SLUG/);
    await assert.rejects(() => buildDistributionBundle('missing', dir), /POST_NOT_FOUND/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('ready posts are not prepared for distribution', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-distribution-'));
  try {
    await fs.writeFile(path.join(dir, 'ready.md'), valid.replace('status: published', 'status: ready'));
    await assert.rejects(() => buildDistributionBundle('ready', dir), /UNPUBLISHED_POST_NOT_DISTRIBUTABLE/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('future posts are never prepared for distribution', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-distribution-'));
  try {
    await fs.writeFile(path.join(dir, 'future.md'), valid.replace('2026-09-28', '2099-09-28'));
    await assert.rejects(() => buildDistributionBundle('future', dir), /FUTURE_POST_NOT_DISTRIBUTABLE/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
