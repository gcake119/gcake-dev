// Run after an Astro build of the six-part fixture; no extra build in test:public.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
const completed = process.env.SERIES_EXPECT_COMPLETED !== 'false';
const finalSlug = completed ? 'ithome-2026-tech-blog-boundary' : 'ithome-2026-publishing-in-production';
test('series completion agrees across homepage, listing, detail and latest article', async () => {
  for (const route of ['index.html', 'series/index.html', 'series/ithome-2026-extensions/index.html']) {
    const { document } = parseHTML(await readFile(`dist/${route}`, 'utf8'));
    const entry = route.includes('extensions/') ? document.querySelector('.series-hero') : [...document.querySelectorAll('.reading-series')].find(x => x.textContent.includes('2026 鐵人賽幕後'));
    assert.ok(entry, route);
    assert.equal(entry.querySelector('.series-label')!.textContent.trim(), completed ? '已完結' : '連載中', route);
    assert.equal(entry.querySelector('.series-period')!.textContent.includes('至今'), !completed, route);
    if (route.includes('extensions/')) assert.equal(document.querySelectorAll('.chapter-posts li').length, completed ? 6 : 4);
  }
  const { document } = parseHTML(await readFile(`dist/posts/${finalSlug}/index.html`, 'utf8'));
  assert.equal(document.querySelector('.article-reading__state')!.textContent.includes('最後一篇'), completed);
  assert.equal(document.querySelector('[data-ending-next]'), null);
  if (!completed) assert.ok(!document.querySelector('[data-article-reading]')!.textContent.includes('從「可以 fork」'));
});
