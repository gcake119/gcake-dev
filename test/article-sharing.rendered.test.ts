// Built HTML integration: run after the existing Astro build, outside pre-build test:public.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { parseHTML } from 'linkedom';

async function htmlFiles(dir: string): Promise<string[]> {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? htmlFiles(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []))).flat();
}
test('built public articles have reading-first endings with preserved sharing and ownership', async () => {
  let local = 0, imported = 0, series = 0, standalone = 0;
  for (const file of await htmlFiles('dist')) {
    const { document } = parseHTML(await readFile(file, 'utf8'));
    const prose = document.querySelector('article > .prose'); if (!prose) continue;
    const groups = document.querySelectorAll('[data-article-share]');
    assert.equal(groups.length, 1, file);
    const group = groups[0];
    const reading = document.querySelector('[data-article-reading]');
    assert.ok(reading, `consolidated reading guidance: ${file}`);
    assert.equal(prose.nextElementSibling, reading, file);
    assert.equal(reading!.nextElementSibling, group, file);
    const subscription = document.querySelector('article > .subscription')!;
    assert.ok(subscription, file);
    assert.ok(group.compareDocumentPosition(subscription) & 4, 'sharing precedes subscription');
    assert.equal(subscription.querySelector('h2')?.textContent, '持續讀新的開發筆記');
    assert.equal(document.querySelectorAll('.article-pagination').length, 0);
    assert.ok(![...document.querySelectorAll('article > section h2')].some(x => ['延伸閱讀','相關文章'].includes(x.textContent ?? '')));
    const references = document.querySelector('article > .article-references');
    if (references) {
      assert.equal(references.hasAttribute('open'), false);
      assert.equal(references.querySelector('summary')!.textContent, '參考與引用');
      assert.ok(subscription.compareDocumentPosition(references) & 4, 'subscription precedes references');
    }
    const recLinks = [...reading!.querySelectorAll('[data-ending-recommendation]')].map(x => x.getAttribute('href'));
    const next = reading!.querySelector('[data-ending-next]');
    const previous = reading!.querySelector('[data-ending-previous]');
    assert.ok(recLinks.length <= (next ? 2 : 3));
    assert.equal(new Set(recLinks).size, recLinks.length);
    assert.ok(!recLinks.includes(next?.getAttribute('href') ?? 'absent'));
    assert.ok(!recLinks.includes(previous?.getAttribute('href') ?? 'absent'));
    if (file.endsWith('day-08/index.html')) {
      assert.equal(next!.getAttribute('href'), '/gcake-dev/series/ithome-2026/day-09/');
      assert.ok(previous!.textContent?.includes('Day 7'));
    }
    if (file.endsWith('day-30/index.html')) {
      assert.equal(next, null);
      assert.ok(reading!.textContent?.includes('這個系列已讀到最後一篇'));
    }
    if (!document.querySelector('.article-breadcrumb')) assert.equal(reading!.querySelector('[aria-label="本系列導覽"]'), null);
    const route = file.replace(/^dist/, '').replace(/index.html$/, '');
    // Known manifest fixtures make this independent of the page's breadcrumb:
    // standalone articles have no series controls; the latest public installment
    // links backward without exposing the next ready (unpublished) installment.
    if (route === '/posts/ai-agent-development-workflow/') {
      assert.equal(document.querySelector('.article-breadcrumb'), null);
      assert.equal(reading!.querySelector('[aria-label="本系列導覽"]'), null);
      assert.equal(next, null);
      assert.equal(previous, null);
    }
    if (route === '/posts/ithome-2026-publishing-in-production/') {
      assert.equal(next, null);
      assert.equal(previous!.getAttribute('href'), '/gcake-dev/posts/ithome-2026-astro-choice/');
      assert.equal(reading!.querySelector('.article-reading__overview')!.getAttribute('href'), '/gcake-dev/series/ithome-2026-extensions/');
      assert.ok(reading!.textContent?.includes('目前已讀到最新一篇。'));
      assert.ok(![...reading!.querySelectorAll('a')].some(a => a.getAttribute('href')?.includes('ithome-2026-template-hardening')));
    }
    assert.equal(group.getAttribute('data-url'), `https://gcake119.github.io/gcake-dev${route}`);
    assert.equal(group.getAttribute('data-title'), document.querySelector('h1')!.textContent);
    assert.equal(group.querySelectorAll('[data-copy]').length, 0);
    assert.equal(group.querySelectorAll('button').length, 1);
    assert.equal(group.querySelector('[data-share] svg')!.getAttribute('aria-hidden'), 'true');
    assert.equal(group.querySelector('[data-share]')!.textContent, '分享這篇文章');
    assert.equal(group.querySelector('[data-share]')!.hasAttribute('hidden'), true);
    assert.equal(group.querySelector('[data-share-status]')!.getAttribute('role'), 'status');
    assert.equal(group.querySelector('[data-share-status]')!.getAttribute('aria-live'), 'polite');
    const input = group.querySelector('[data-share-recovery] input')!;
    assert.ok(input.hasAttribute('readonly') && input.getAttribute('aria-label'));
    assert.equal(input.getAttribute('value'), group.getAttribute('data-url'));

    assert.ok(group.querySelector('noscript')); assert.equal(group.querySelectorAll('a,iframe,form').length, 0);
    const canonical = document.querySelector('link[rel=canonical]')!.getAttribute('href');
    assert.equal(document.querySelector('meta[property="og:url"]')!.getAttribute('content'), canonical);
    if (route.includes('/series/ithome-2026/')) {
      imported++; const day = route.match(/day-(\d+)/)![1];
      assert.equal(canonical, `https://gcake119.github.io/ithome-2026/day/${day}/`);
      assert.equal([...document.querySelectorAll('.article-meta a')].find(a => a.textContent?.includes('原始版本'))!.getAttribute('href'), canonical);
    } else { local++; if (document.querySelector('.article-breadcrumb')) series++; else standalone++; assert.equal(canonical, group.getAttribute('data-url')); }
  }
  assert.ok(local > 0 && imported === 30 && series > 0 && standalone > 0, 'real built local, local series, and 30 imported articles');
});
