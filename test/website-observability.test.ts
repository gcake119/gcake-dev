import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { parseHTML } from 'linkedom';

const token = '0123456789abcdef0123456789abcdef';
const beacon = 'https://static.cloudflareinsights.com/beacon.min.js';

function build(outDir: string, enabled: string, configuredToken = token) {
  return spawnSync('node_modules/.bin/astro', ['build', '--outDir', outDir], {
    encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, WEBSITE_ANALYTICS_ENABLED: enabled,
      CLOUDFLARE_WEB_ANALYTICS_TOKEN: configuredToken, GOOGLE_SITE_VERIFICATION: enabled === 'true' ? 'test-verification' : '' },
  });
}

async function htmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? htmlFiles(path.join(root, entry.name))
    : Promise.resolve(entry.name.endsWith('.html') ? [path.join(root, entry.name)] : [])));
  return groups.flat();
}

test('production HTML measures every reading page once and excludes development/preview', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gcake-observability-test-'));
  try {
    const production = path.join(root, 'production');
    const built = build(production, 'true');
    assert.equal(built.status, 0, built.stderr + built.stdout);
    const pages = await htmlFiles(production);
    assert.ok(pages.some(file => file.includes('/posts/')));
    assert.ok(pages.some(file => file.includes('/series/ithome-2026/day-')));
    for (const file of pages) {
      const html = await readFile(file, 'utf8');
      const { document } = parseHTML(html);
      const bootstrap = document.querySelector('#gcake-web-analytics');
      assert.ok(bootstrap, `Missing analytics on ${path.relative(production, file)}`);
      assert.equal(document.querySelectorAll('#gcake-web-analytics').length, 1);
      assert.equal(document.head.querySelectorAll('meta[name="google-site-verification"]').length, 1);
      assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.startsWith('https://gcake119.github.io/'), true);
      runInNewContext(bootstrap.textContent!, { document, location: new URL('https://gcake119.github.io/gcake-dev/posts/example/') });
      runInNewContext(bootstrap.textContent!, { document, location: new URL('https://gcake119.github.io/gcake-dev/posts/example/') });
      const scripts = document.querySelectorAll(`script[src="${beacon}"]`);
      assert.equal(scripts.length, 1);
      assert.equal(scripts[0].getAttribute('type'), 'module');
      assert.equal(JSON.parse(scripts[0].getAttribute('data-cf-beacon')!).token, token);
    }
    const home = await readFile(path.join(production, 'index.html'), 'utf8');
    for (const url of ['http://localhost:4321/gcake-dev/', 'http://127.0.0.1:4321/gcake-dev/',
      'https://preview.example/gcake-dev/', 'https://gcake119.github.io/ithome-2026/',
      'https://gcake119.github.io/gcake-dev-preview/', 'http://gcake119.github.io/gcake-dev/']) {
      const { document } = parseHTML(home);
      runInNewContext(document.querySelector('#gcake-web-analytics')!.textContent!, { document, location: new URL(url) });
      assert.equal(document.querySelectorAll(`script[src="${beacon}"]`).length, 0, url);
    }
    const disabled = path.join(root, 'disabled');
    const ordinary = build(disabled, 'false', '');
    assert.equal(ordinary.status, 0, ordinary.stderr + ordinary.stdout);
    for (const file of await htmlFiles(disabled)) {
      const html = await readFile(file, 'utf8');
      assert.equal(html.includes(beacon), false);
      assert.equal(parseHTML(html).document.querySelector('meta[name="google-site-verification"]'), null);
    }
    for (const invalid of ['', 'malformed-token']) {
      const result = build(path.join(root, 'invalid'), 'true', invalid);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /CLOUDFLARE_WEB_ANALYTICS_TOKEN must be a 32-character hexadecimal token/);
      if (invalid) assert.equal((result.stderr + result.stdout).includes(invalid), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
