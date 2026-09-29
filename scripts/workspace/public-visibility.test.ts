import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path: string): Promise<string> {
  return readFile(new URL(path, root), 'utf8');
}

test('every direct local-post surface uses the shared publication-time predicate', async () => {
  const directConsumers = [
    'src/lib/content/catalog.ts',
    'src/lib/content/series.ts',
    'src/pages/posts/index.astro',
    'src/pages/posts/[...slug].astro',
    'src/pages/topics/index.astro',
    'src/pages/topics/[topic].astro',
    'src/pages/sitemap.xml.ts',
  ];
  for (const path of directConsumers) {
    const value = await source(path);
    assert.match(value, /isPublicPost\(/, `${path} must use isPublicPost`);
    assert.doesNotMatch(value, /status\s*===\s*['"]published['"].*isPublishedDate/s, `${path} must not rebuild the rule`);
  }
});

test('catalog-derived RSS, search, navigation, and series outputs cannot bypass visibility filtering', async () => {
  const catalogConsumers = [
    'src/pages/index.astro',
    'src/pages/rss.xml.ts',
    'src/pages/search-index.json.ts',
    'src/pages/series/index.astro',
    'src/pages/series/[slug].astro',
    'src/pages/posts/[...slug].astro',
  ];
  for (const path of catalogConsumers) {
    assert.match(await source(path), /loadReadingCatalog\(/, `${path} must derive output from the filtered catalog`);
  }
});

test('public post pages derive series membership from manifests and hide sequence UI for standalone posts', async () => {
  const catalog = await source('src/lib/content/catalog.ts');
  const page = await source('src/pages/posts/[...slug].astro');

  assert.doesNotMatch(catalog, /p\.data\.series/);
  assert.match(catalog, /seriesMembership/);
  assert.match(page, /allSeries\.find\(.*articles\.some/);
  assert.match(page, /\{series && <><p class="article-breadcrumb"/);
  assert.match(page, /\{\(previous \|\| next\) && <nav class="article-pagination"/);
});

test('public article pages emit shared structured data', async () => {
  const localPage = await source('src/pages/posts/[...slug].astro');
  const externalPage = await source('src/pages/series/ithome-2026/[post].astro');
  const layout = await source('src/layouts/BaseLayout.astro');

  assert.match(localPage, /articleStructuredData/);
  assert.match(localPage, /breadcrumbStructuredData/);
  assert.match(externalPage, /articleStructuredData/);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /og:title/);
  assert.match(layout, /twitter:card/);
});

test('public Astro and Cloudflare Worker runtimes do not depend on Ollama', async () => {
  const publicFiles = [
    'src/lib/content/catalog.ts',
    'src/pages/index.astro',
    'apps/admin-worker/src/index.ts',
    'apps/admin-worker/src/router.ts',
  ];
  for (const path of publicFiles) {
    const value = await source(path);
    assert.doesNotMatch(value, /ollama|11434|gemma4/i, `${path} must not depend on local AI`);
  }
});
