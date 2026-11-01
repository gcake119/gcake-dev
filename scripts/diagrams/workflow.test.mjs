import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render, check } from './workflow.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'gcake-diagrams-'));
  try {
    for (const dir of ['docs/diagrams/nested', 'public/diagrams', 'src/content/posts', 'scripts/diagrams']) await mkdir(join(root, dir), { recursive: true });
    for (const file of ['package.json', 'pnpm-lock.yaml', 'docs/diagrams/mermaid-config.json', 'scripts/diagrams/workflow.mjs']) await writeFile(join(root, file), '{}');
    await writeFile(join(root, 'docs/diagrams/nested/example.mmd'), 'flowchart TB\n A[作者] --> B[讀者]');
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const fake = async (_input, output) => writeFile(output, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>Mermaid version／作者</text></svg>');
test('selected nested conversion and failed batch preserve valid output and manifest', () => fixture(async root => {
  await render(root, 'docs/diagrams/nested/example.mmd', fake);
  const svg = await readFile(join(root, 'public/diagrams/nested/example.svg'));
  const manifest = await readFile(join(root, 'public/diagrams/manifest.json'));
  await writeFile(join(root, 'docs/diagrams/z-invalid.mmd'), 'invalid');
  await assert.rejects(render(root, undefined, async (input, output) => { if ((await readFile(input, 'utf8')) === 'invalid') throw new Error('parse error'); await fake(input, output); }), /invalid.mmd.*parse error/s);
  assert.deepEqual(await readFile(join(root, 'public/diagrams/nested/example.svg')), svg);
  assert.deepEqual(await readFile(join(root, 'public/diagrams/manifest.json')), manifest);
  await assert.rejects(render(root, '../outside.mmd', fake), /docs\/diagrams/);
}));
test('browser-free checks catch source, SVG, configuration drift, missing and orphan outputs', () => fixture(async root => {
  await render(root, undefined, fake);
  await check(root);
  for (const file of ['docs/diagrams/nested/example.mmd', 'public/diagrams/nested/example.svg', 'docs/diagrams/mermaid-config.json', 'pnpm-lock.yaml']) {
    const original = await readFile(join(root, file));
    await writeFile(join(root, file), Buffer.concat([original, Buffer.from(' changed')]));
    await assert.rejects(check(root), /regenerate/i);
    await writeFile(join(root, file), original);
  }
  await writeFile(join(root, 'public/diagrams/orphan.svg'), '<svg/>');
  await assert.rejects(check(root), /orphan/);
  await rm(join(root, 'public/diagrams/orphan.svg'));
  await rm(join(root, 'public/diagrams/nested/example.svg'));
  await assert.rejects(check(root), /example.svg/);
}));
test('Markdown and MDX references, alt text, fences and built bytes are checked', () => fixture(async root => {
  await render(root, undefined, fake);
  const article = join(root, 'src/content/posts/example.mdx');
  await writeFile(article, '![架構][diagram]\n\n[diagram]: /gcake-dev/diagrams/nested/example.svg');
  await check(root);
  for (const body of ['![](/gcake-dev/diagrams/nested/example.svg)', '![架構](/gcake-dev/diagrams/missing.svg)', '```mermaid\nflowchart TB\n```']) {
    await writeFile(article, body);
    await assert.rejects(check(root), /example.mdx/);
  }
  await writeFile(article, '![架構](/gcake-dev/diagrams/nested/example.svg)');
  await assert.rejects(check(root, true), /built/);
  await mkdir(join(root, 'dist/diagrams/nested'), { recursive: true });
  await writeFile(join(root, 'dist/diagrams/nested/example.svg'), await readFile(join(root, 'public/diagrams/nested/example.svg')));
  await check(root, true);
}));
test('empty source batch does not invoke renderer', () => fixture(async root => {
  await render(root, undefined, fake);
  await rm(join(root, 'docs/diagrams/nested/example.mmd'));
  await rm(join(root, 'public/diagrams/nested/example.svg'));
  await render(root, undefined, () => { throw new Error('browser launched'); });
  await check(root);
}));
