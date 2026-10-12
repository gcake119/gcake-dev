import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPagesPublication } from './pages-publication';
import { buildDistributionBundle } from './prepare-distribution';
import { main } from './run-distribution';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
const source=`---\ntitle: Trial\nstatus: published\npublishedAt: '2026-09-28'\n---\n# Heading\n\nExact body [link](https://example.com/).\n\n![Photo](https://gcake119.github.io/gcake-dev/photo.png)\n`;
async function fixture(run:(bundle:Awaited<ReturnType<typeof buildDistributionBundle>>,dir:string)=>Promise<void>){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-pages-gate-'));try {const posts=path.join(dir,'src/content/posts');await fs.mkdir(posts,{recursive:true});await fs.writeFile(path.join(posts,'trial.md'),source);await run(await buildDistributionBundle('trial',posts),dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}
const html=(canonical:string)=>`<link rel="canonical" href="${canonical}"><header class="article-header"><h1>Trial</h1><div class="article-meta"><time datetime="2026-09-27T16:00:00Z"></time></div></header><div class="prose"><h1>Heading</h1><p>Exact body <a href="https://example.com/">link</a>.</p><p><img src="/gcake-dev/photo.png" alt="Photo"></p></div>`;
test('CLI reports a withdrawn original as ineligible, not as a platform outage',()=>{
 assert.equal(boundedDistributionError(new Error('UNPUBLISHED_POST_NOT_DISTRIBUTABLE')),'DISTRIBUTION_SOURCE_NOT_PUBLISHED');
 assert.equal(boundedDistributionError(new Error('PAGES_PUBLIC_HTTP_FAILED')),'PAGES_PUBLIC_HTTP_FAILED');
 assert.equal(boundedDistributionError(new Error('UNATTENDED_POLICY_REQUIRED')),'UNATTENDED_POLICY_REQUIRED');
});
test('public origin must match full Markdown, canonical, title, date, links and loaded images',async()=>fixture(async bundle=>{
 const good:typeof fetch=async url=>String(url).endsWith('photo.png')?new Response('image',{headers:{'content-type':'image/png'}}):new Response(html(bundle.canonicalUrl));
 assert.equal((await assertPagesPublication(bundle,good)).sourceRevision,bundle.sourceRevision);
 for(const changed of [html(bundle.canonicalUrl).replace('Exact body','Stale body'),html('https://wrong.example/'),html(bundle.canonicalUrl).replace('2026-09-27','2026-09-26'),html(bundle.canonicalUrl).replace('alt="Photo"','alt="wrong"'),html(bundle.canonicalUrl).replace('https://example.com/','https://wrong.example/')]){
  await assert.rejects(assertPagesPublication(bundle,(async url=>String(url).endsWith('photo.png')?good(url):new Response(changed)) as typeof fetch),/PAGES_PUBLIC/);
 }
 await assert.rejects(assertPagesPublication(bundle,(async()=>new Response('missing',{status:404})) as typeof fetch),/PAGES_PUBLIC_HTTP/);
 await assert.rejects(assertPagesPublication(bundle,(async url=>String(url).endsWith('photo.png')?new Response('missing',{status:404}):new Response(html(bundle.canonicalUrl))) as typeof fetch),/PAGES_PUBLIC/);
}));
test('withdrawn current Markdown prevents historical dry run and no platform or D1 is opened',async()=>fixture(async (_bundle,dir)=>{
 await fs.writeFile(path.join(dir,'src/content/posts/trial.md'),source.replace('status: published','status: ready'));
 await assert.rejects(main(['dry-run','trial','substack','--mode','controlled-trial','--source-root',dir,'--out',path.join(dir,'review.json')]),/UNPUBLISHED_POST/);
 await assert.rejects(fs.access(path.join(dir,'review.json')));
}));
