import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Run after pnpm build: verify the HTML readers actually receive.
async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(path.join(directory, entry.name))
    : Promise.resolve(entry.name.endsWith('.html') ? [path.join(directory, entry.name)] : [])));
  return nested.flat();
}

function subscription(html: string) {
  const sections = html.match(/<section\b[^>]*class="[^"]*subscription[^"]*"[\s\S]*?<\/section>/g) ?? [];
  assert.equal(sections.length, 1, 'one subscription entry per page');
  const section = sections[0];
  assert.match(section, /aria-labelledby="subscription-heading"/);
  assert.match(section, /id="subscription-heading"/);
  assert.match(section, /href="https:\/\/gcakedev\.substack\.com\/subscribe"/);
  assert.match(section, /href="\/gcake-dev\/rss\.xml"/);
  assert.match(section, /電子報（Substack）/);
  assert.match(section, /RSS/);
  assert.equal((section.match(/<a\b/g) ?? []).length, 2);
  assert.doesNotMatch(section, /Paragraph|<script|<form|<iframe/);
  return section;
}

test('homepage offers newsletter and RSS near the latest posts', async () => {
  const html = await fs.readFile('dist/index.html', 'utf8');
  const section = subscription(html);
  assert.match(section, /持續追蹤新的技術文章/);
  assert.ok(html.indexOf(section) > html.indexOf('id="latest-heading"'));
});

test('every built article offers the same subscriptions after its body', async () => {
  const pages = await htmlFiles('dist');
  let articles = 0;
  for (const page of pages) {
    const html = await fs.readFile(page, 'utf8');
    if (!html.includes('class="prose"')) continue;
    articles++;
    const section = subscription(html);
    assert.match(section, /subscription--compact/);
    assert.ok(html.indexOf(section) > html.indexOf('class="prose"'), page);
    const pagination = html.indexOf('class="article-pagination"');
    if (pagination >= 0) assert.ok(html.indexOf(section) < pagination, page);
  }
  assert.ok(articles > 0, 'requires real built article pages');
  assert.match(await fs.readFile('dist/rss.xml', 'utf8'), /<rss\b/);
});
