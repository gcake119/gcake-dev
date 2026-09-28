import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const exec = promisify(execFile);
const repository = join(dirname(fileURLToPath(import.meta.url)), '../..');
const originalPackage = await readFile(join(repository, 'package.json'));
const originalHash = createHash('sha256').update(originalPackage).digest('hex');
const isolated = await mkdtemp(join(tmpdir(), 'gcake-formal-preview-'));

try {
  await cp(repository, isolated, {
    recursive: true,
    filter: (source) => !['.git', '.astro', '.playwright-cli', 'dist', 'node_modules'].includes(source.split('/').at(-1) ?? ''),
  });
  await symlink(join(repository, 'node_modules'), join(isolated, 'node_modules'), 'dir');
  const slug = 'formal-preview-unsaved-fixture';
  await writeFile(join(isolated, 'src/components/PreviewBadge.vue'), `<template><strong data-preview-vue>Unsaved Vue island</strong></template>\n`);
  await writeFile(join(isolated, 'src/content/posts', `${slug}.mdx`), `---
title: Unsaved formal preview fixture
status: published
publishedAt: 2026-09-28
description: Built from isolated unsaved source.
---
import PreviewBadge from '../../components/PreviewBadge.vue';

# Unsaved formal preview

This source exists only inside the preview package.

<PreviewBadge client:load />
`);
  await exec('pnpm', ['build:astro'], { cwd: isolated, env: { ...process.env, NO_COLOR: '1' }, maxBuffer: 20_000_000 });
  const output = await readFile(join(isolated, 'dist/posts', slug, 'index.html'), 'utf8');
  assert.match(output, /Unsaved formal preview/);
  assert.match(output, /Unsaved Vue island/);
  assert.equal(createHash('sha256').update(await readFile(join(repository, 'package.json'))).digest('hex'), originalHash);
  console.log(JSON.stringify({ provider: 'isolated-source-package', built: true, canonicalMutation: false, slug }));
} finally {
  await rm(isolated, { recursive: true, force: true });
}
