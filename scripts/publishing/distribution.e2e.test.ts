import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { buildDistributionBundle } from './prepare-distribution';
import { articleFromBundle } from './run-distribution';
import { SqliteD1Database } from './sqlite-d1';
import { D1PublicationRepository } from '../../apps/admin-worker/src/publication-operations';
import { DistributionCoordinator } from '../../apps/admin-worker/src/distribution-coordinator';
import { PlaywrightSubstackAdapter, type SubstackUiContract } from './substack-browser';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');

test('Markdown → Substack → D1 → public readback with browser draft updates, images and failure recovery', { timeout: 120_000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcake-distribution-e2e-'));
  const db = new DatabaseSync(path.join(dir, 'runtime.sqlite'));
  let state = { title: '', html: '', canonical: '', date: '', published: false };
  let creates = 0, publishes = 0, sends = 0, dateSaves = 0, dateSaveFails = true, canonicalMismatch = false, wrongEditorLink = false, loginExpired = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const data = async () => { let body = ''; for await (const chunk of req) body += chunk; return JSON.parse(body); };
    const json = (value: unknown) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
    const html = (value: string) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(value); };
    if (url.pathname === '/image.png') { res.setHeader('content-type', 'image/png'); res.end(pixel); return; }
    if (url.pathname === '/save') { const body = await data(); await new Promise(resolve => setTimeout(resolve, body.html === state.html ? 50 : 300)); state = { ...state, ...body }; return json({ ok: true }); }
    if (url.pathname === '/save-date') { dateSaves++; const body = await data(); if (dateSaveFails) { res.writeHead(500); res.end('date save failed'); return; } state.date = body.date; return json({ ok: true }); }
    if (url.pathname === '/publish') { const body = await data(); publishes++; if (body.email) sends++; state.published = true; state.date = new Date().toISOString(); return json({ ok: true }); }
    if (url.pathname === '/create') { creates++; res.writeHead(302, { location: '/publish/post/1' }); res.end(); return; }
    if (url.pathname === '/publish/home') return html(loginExpired ? '<h2>Sign in to Fixture</h2><input aria-label="Email">' : '<button onclick="location.href=\'/create\'">Create</button>');
    if (url.pathname === '/publish/posts') return html(`<h1>Posts</h1>${creates ? `<a href="/publish/post/1">${escape(state.title)}</a>` : ''}`);
    if (url.pathname === '/publish/post/1') return html(`<input aria-label="Title" id="title" value="${escape(state.title)}"><div role="textbox" aria-label="Body" contenteditable="true" id="body">${state.html}</div><input aria-label="Canonical" id="canonical" value="${escape(state.canonical)}"><button onclick="document.getElementById('date-settings').hidden=false">Settings</button><div id="date-settings" hidden><input aria-label="Date" id="date" value="${escape(state.date)}"><button onclick="saveDate()">Save date</button></div><button id="saved">Saved</button><button onclick="document.getElementById('dialog').hidden=false">Continue</button><a aria-label="Public article" href="${wrongEditorLink ? '/p/other' : '/p/demo'}">Public article</a><div role="dialog" id="dialog" hidden><label><input id="email" type="checkbox" checked>Send email</label><button onclick="publish()">Publish now</button></div><script>
      let timer; function save(){saved.hidden=true;clearTimeout(timer);timer=setTimeout(async()=>{await fetch('/save',{method:'POST',body:JSON.stringify({title:title.value,html:body.innerHTML,canonical:canonical.value,date:date.value})});saved.hidden=false},0)}
      for(const id of ['title','body','canonical'])document.getElementById(id).addEventListener('input',save);
      body.addEventListener('paste',e=>{e.preventDefault();body.innerHTML=e.clipboardData.getData('text/html');save()});
      async function saveDate(){await fetch('/save-date',{method:'POST',body:JSON.stringify({date:date.value})});document.getElementById('date-settings').hidden=true}
      async function publish(){await fetch('/publish',{method:'POST',body:JSON.stringify({email:email.checked})});location.href='/p/demo'}
    </script>`);
    if (url.pathname === '/p/demo' && state.published) return html(`<link rel="canonical" href="${canonicalMismatch ? 'https://wrong.example/' : origin + '/p/demo'}"><h1>${escape(state.title)}</h1><time datetime="${state.date}"></time><article>${state.html}</article>`);
    res.writeHead(404); res.end('not found');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  try {
    db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql', import.meta.url), 'utf8'));
    db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0006_distribution_checkpoints.sql', import.meta.url), 'utf8'));
    const repository = new D1PublicationRepository(new SqliteD1Database(db));
    const ui: SubstackUiContract = { version: 1, origin, reviewedAt: '2026-10-11T00:00:00Z', publishingCapabilitiesVerified: true, discoveryVerified: true, homePath: '/publish/home', postsPath: '/publish/posts', editPath: '/publish/post/{id}', create: { role: 'button', name: 'Create' }, title: { role: 'textbox', name: 'Title' }, body: { role: 'textbox', name: 'Body' }, saved: { role: 'button', name: 'Saved' }, publicationPolicy: 'full-mirror', displayedDateFormat: 'iso', settings: { role: 'button', name: 'Settings' }, settingsDone: { role: 'button', name: 'Save date' }, publishedAt: { role: 'textbox', name: 'Date' }, continue: { role: 'button', name: 'Continue' }, email: { role: 'checkbox', name: 'Send email' }, confirmPublish: { role: 'button', name: 'Publish now' }, publicLink: { role: 'link', name: 'Public article' }, draftLinks: 'a[href^="/publish/post/"]', scanComplete: { role: 'heading', name: 'Posts' }, publicBody: 'article', publicTitle: 'body > h1', publicDate: 'time' };
    const adapter = new PlaywrightSubstackAdapter(await context.newPage(), ui, true);
    const coordinator = new DistributionCoordinator(repository, adapter);
    const source = `---\ntitle: Demo\nstatus: published\npublishedAt: 2026-09-28\n---\n# Article\n\nHello **world** [link](https://example.com/).\n\n![Photo](${origin}/image.png)\n`;
    await fs.writeFile(path.join(dir, 'demo.md'), source);
    let article = articleFromBundle(await buildDistributionBundle('demo', dir));
    const approve = (target: 'substack') => ({ target, slug: 'demo', sourceRevision: article.sourceRevision, approved: true as const, newsletter: 'skip' as const, ...(target === 'substack' ? { substackPolicy: 'full-mirror' as const } : {}) });
    const prepared = await coordinator.run(article, 'substack', 'prepare', approve('substack'));
    assert.equal(prepared.status, 'prepare_ready', JSON.stringify({ prepared, state, dom: await context.pages()[0].locator('#body').evaluate(element => ({ text: (element as HTMLElement).innerText, images: Array.from(element.querySelectorAll('img')).map(i => ({src:i.src,alt:i.alt,loaded:i.complete,width:i.naturalWidth})) })) }));
    assert.equal(creates, 1); assert.equal(publishes, 0);
    // Update same remote draft using a new Git source revision.
    await fs.writeFile(path.join(dir, 'demo.md'), source.replace('Hello **world**', 'Updated **world**'));
    article = articleFromBundle(await buildDistributionBundle('demo', dir));
    const updated = await coordinator.run(article, 'substack', 'prepare', approve('substack'));
    assert.equal(updated.status, 'prepare_ready', JSON.stringify(updated));
    assert.equal(creates, 1);
    const uncertain = await coordinator.run(article, 'substack', 'publish', approve('substack'));
    assert.equal(uncertain.status, 'uncertain');
    assert.equal(publishes, 1, JSON.stringify(uncertain)); assert.equal(sends, 0); assert.equal(dateSaves, 1, JSON.stringify(uncertain));
    assert.equal((await repository.runtime.checkpoint('demo', 'substack'))?.operation, 'metadata');
    assert.equal(state.canonical, '');
    // New coordinator/repository model process restart; only anonymous public readback occurs.
    const restartedRepository = new D1PublicationRepository(new SqliteD1Database(db));
    const restarted = new DistributionCoordinator(restartedRepository, adapter);
    const readOnly = await restarted.run(article, 'substack', 'retry');
    assert.equal(readOnly.status, 'uncertain'); assert.equal(dateSaves, 1); assert.equal(publishes, 1);
    dateSaveFails = false;
    canonicalMismatch = true;
    const wrongArticle = await restarted.run(article, 'substack', 'finalize', approve('substack'));
    assert.equal(wrongArticle.status, 'uncertain'); assert.equal(dateSaves, 1);
    canonicalMismatch = false;
    wrongEditorLink = true;
    const wrongIdentity = await restarted.run(article, 'substack', 'finalize', approve('substack'));
    assert.equal(wrongIdentity.status, 'uncertain'); assert.equal(dateSaves, 1);
    wrongEditorLink = false;
    const recovered = await restarted.run(article, 'substack', 'finalize', approve('substack'));
    assert.equal(dateSaves, 2);
    assert.equal(Date.parse(state.date), Date.parse(article.publishedAt!));
    assert.equal(recovered.status, 'verified', JSON.stringify(recovered));
    await restarted.run(article, 'substack', 'publish', approve('substack'));
    assert.equal(publishes, 1); assert.equal(creates, 1); assert.equal(sends, 0);
    loginExpired = true;
    await assert.rejects(() => adapter.preflight(), /SUBSTACK_LOGIN_REQUIRED/);
    const missingCapability = new PlaywrightSubstackAdapter(await context.newPage(), { ...ui, publishingCapabilitiesVerified: false }, true);
    await assert.rejects(() => missingCapability.checkPublish({ id: '1', url: origin + '/p/demo' }, article), /CAPABILITY_UNVERIFIED/);
    await context.pages()[0].screenshot({ path: path.join(dir, 'fixture-public.png'), fullPage: true });
  } finally {
    await context.close(); await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); db.close(); await fs.rm(dir, { recursive: true, force: true });
  }
});
