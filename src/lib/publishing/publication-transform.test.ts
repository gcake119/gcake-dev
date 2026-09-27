import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createPortablePublication } from './publication-transform';

const fixture = (name: string) => fs.readFile(path.resolve('test/fixtures/publishing', name), 'utf8');

test('full mode preserves portable Markdown and records assets', async () => {
  const publication = createPortablePublication({
    slug: 'portable-markdown',
    source: await fixture('full.md'),
    sourceRevision: 'abc123',
  });

  assert.equal(publication.distributionMode, 'full');
  assert.match(publication.body, /complete portable article/);
  assert.match(publication.body, /https:\/\/gcake119.github.io\/gcake-dev\/posts\/portable-markdown\//);
  assert.deepEqual(publication.assets, [{ source: './diagram.png', alt: 'Diagram' }]);
  assert.equal(publication.canonicalUrl, 'https://gcake119.github.io/gcake-dev/posts/portable-markdown/');
  assert.equal(publication.publishedAt, '2026-10-10T00:00:00.000Z');
});

test('interactive-summary uses only the authored fallback and canonical link', async () => {
  const source = await fixture('interactive.mdx');
  const publication = createPortablePublication({
    slug: 'interactive',
    source,
    sourceRevision: 'def456',
  });

  assert.equal(publication.distributionMode, 'interactive-summary');
  assert.match(publication.body, /source-controlled fallback/);
  assert.match(publication.body, /https:\/\/gcake119.github.io\/gcake-dev\/posts\/interactive\//);
  assert.doesNotMatch(publication.body, /<Demo|import Demo/);
  assert.deepEqual(publication.assets, [{ source: 'https://example.com/static-result.png', alt: 'Static result' }]);
});

test('interactive-summary rejects source without an authored fallback', async () => {
  const source = await fixture('invalid-interactive.mdx');
  assert.throws(() => createPortablePublication({
    slug: 'invalid-interactive',
    source,
    sourceRevision: 'ghi789',
  }), /fallback/);
});

test('full mode rejects MDX constructs instead of delegating improvisation to adapters', async () => {
  const source = (await fixture('interactive.mdx')).replace('mode: interactive-summary', 'mode: full');
  assert.throws(() => createPortablePublication({ slug: 'unsafe-full', source, sourceRevision: 'jkl012' }), /interactive-summary/);
});
