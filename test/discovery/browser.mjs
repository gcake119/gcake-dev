// Bounded DOM acceptance. Owns its server and temporary output; no source fixtures.
import { chromium } from 'playwright';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='output/playwright/discovery';await mkdir(out,{recursive:true});
const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const server=spawn('pnpm',['exec','astro','preview','--ignore-lock','--host','127.0.0.1','--port',String(port)],{stdio:'pipe',detached:true});
const exited=new Promise(resolve=>server.once('exit',resolve));
let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
let browser,passed=false,unexpectedRemote=0,semanticContractRequests=0,generationRequests=0,observedCorpusId;const origin=`http://127.0.0.1:${port}`,base=origin+'/gcake-dev';
async function shutdown(){if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);if(server.exitCode===null){try{process.kill(-server.pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}await exited;}}}
async function interrupted(){try{await browser?.close();await shutdown();await writeFile(out+'/server.log',log);await writeFile(out+'/result.json',JSON.stringify({passed:false,interrupted:true,base}));}finally{process.exit(130);}}
process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,channel:"chrome"});const page=await browser.newPage();page.on('request',request=>{const u=new URL(request.url());if(u.hostname==='search.invalid'){semanticContractRequests++;if(u.pathname!=='/v1/search')generationRequests++;}else if(u.protocol.startsWith('http')&&u.origin!==origin)unexpectedRemote++;});
 await page.goto(base+'/search/?q=AI');await page.locator('#search-results li').first().waitFor();
 assert.equal(await page.locator('input[name=q]').count(),1);assert.equal(await page.locator('.search-privacy').count(),0);assert.equal(await page.getByRole('heading',{name:'搜尋結果',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'查看系列總覽 →',exact:true}).count(),0);assert.equal(await page.locator('select').count(),0,'Reader search should expose no filter or mode dropdowns');assert.equal(await page.locator('#search-suggestions').count(),0);assert.equal(await page.locator('#search-suggestions a').count(),0,'Search should show articles without vocabulary suggestions');assert.ok(await page.locator('#search-results .series-label a').count()>0);observedCorpusId=await page.evaluate(async()=>{const r=await fetch(document.querySelector('#search-results').dataset.manifest);return (await r.json()).corpusId;});
 await page.getByLabel('搜尋文章',{exact:true}).fill('測試');await page.getByRole('button',{name:'搜尋',exact:true}).click();await page.waitForURL(/q=/);await page.locator('#search-results li').first().waitFor();
 await page.goto(base+'/search/?q=AI&topic=unknown&series=unknown&sort=newest');await page.locator('#search-results li').first().waitFor();assert.equal(new URL(page.url()).searchParams.has('topic'),false);assert.equal(new URL(page.url()).searchParams.has('series'),false);assert.equal(new URL(page.url()).searchParams.has('sort'),false);
 const shared=page.url();await page.reload();assert.equal(page.url(),shared);await page.goBack();
 for(const width of [1280,390,320])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/search/?q=AI');await page.locator('#search-results li').first().waitFor();await page.evaluate(t=>{document.documentElement.dataset.theme=t;localStorage.setItem('gcake-theme',t);},theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/search-${width}-${theme}.png`,fullPage:true});
  await page.locator('#search-results a').first().click();await page.locator('.prose').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/article-${width}-${theme}.png`,fullPage:true});if(await page.locator('.article-connections').count()){await page.locator('.article-connections').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/connections-${width}-${theme}.png`});}
 }
 for(const width of [1280,390,320])for(const theme of ['light','dark']){await page.setViewportSize({width,height:900});await page.goto(base+'/posts/ithome-2026-astro-choice/');await page.evaluate(t=>{document.documentElement.dataset.theme=t;localStorage.setItem('gcake-theme',t);},theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/local-article-${width}-${theme}.png`,fullPage:true});if(await page.locator('.article-connections').count()){await page.locator('.article-connections').first().scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/local-connections-${width}-${theme}.png`});}}
 await page.goto(base+'/search/?q=zzq-no-public-article-987654321');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('找不到相關文章'));assert.ok(!(await page.locator('#search-status').textContent()).includes('建議'));assert.equal(await page.locator('#search-results li').count(),0);
 await page.goto(base+'/search/?q='+encodeURIComponent('<img src=x onerror="window.evil=1">'));await page.waitForFunction(()=>!document.querySelector('#search-status').textContent.includes('搜尋中'));assert.equal(await page.evaluate(()=>window.evil),undefined);
 await page.goto(base+'/search/?q='+encodeURIComponent('中'.repeat(201)));await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('200'));
 await page.goto(base+'/search/?q=AI&mode=semantic');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('關鍵字'));assert.ok(await page.locator('#search-results li').count()>0);

 // Connectivity recovery preserves the same query and filters.
 let failIndex=true;await page.route('**/discovery-manifest.json',async route=>{if(failIndex){failIndex=false;await route.abort();}else await route.continue();});
 await page.goto(base+'/search/?q=AI&series=ithome-2026');await page.getByRole('button',{name:'重試',exact:true}).waitFor();await page.getByRole('button',{name:'重試',exact:true}).click();await page.locator('#search-results li').first().waitFor();assert.equal(new URL(page.url()).searchParams.has('series'),false);await page.unroute('**/discovery-manifest.json');
 await page.goto(base+'/search/?q=AI');await page.locator('#search-results li').first().waitFor();await page.getByRole('link',{name:'下一頁',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('page'),'2');await page.goBack();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('第 1 頁'));
 // Every remote response is an offline interception, and never a model call.
 const mode=async value=>page.evaluate(value=>{const u=new URL(location.href);u.searchParams.set('mode',value);history.pushState(null,'',u);dispatchEvent(new PopStateEvent('popstate'));},value);
 let remoteRequests=0;await page.route('https://search.invalid/v1/search',async route=>{remoteRequests++;await route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({fallback:'keyword'})});});
 await page.evaluate(()=>document.querySelector('#search-results').dataset.semantic='https://search.invalid/v1/search');await mode('semantic');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('關鍵字結果'));assert.ok(await page.locator('#search-results li').count()>0);assert.equal(remoteRequests,1);
 await page.unroute('https://search.invalid/v1/search');
 let releaseOld;const oldPending=new Promise(resolve=>releaseOld=resolve);await page.route('https://search.invalid/v1/search',async route=>{await oldPending;await route.fulfill({status:503,body:'{}'}).catch(()=>{});});
 await mode('lexical');await mode('semantic');await mode('lexical');releaseOld();await page.waitForFunction(()=>!document.querySelector('#search-status').textContent.includes('搜尋中'));assert.equal(new URL(page.url()).searchParams.get('mode'),'lexical');assert.ok(!(await page.locator('#search-status').textContent()).includes('依意思搜尋結果'));await page.unroute('https://search.invalid/v1/search');
 // Successful semantic contracts are local interceptions; provider titles/links are never trusted.
 const fixture=await page.evaluate(async()=>{const m=await (await fetch(document.querySelector('#search-results').dataset.manifest)).json();const c=await (await fetch(m.assets.index.href)).json();const passages=await (await fetch(m.assets.passages.href)).json();return {c,passages};});
 await page.goto(base+'/search/?q=AI');await page.locator('#search-results li').first().waitFor();
 await page.evaluate(()=>document.querySelector('#search-results').dataset.semantic='https://search.invalid/v1/search');
 let malformed=true;
 await page.route('https://search.invalid/v1/search',async route=>{const input=route.request().postDataJSON();const allowed=fixture.c.articles.filter(a=>(!input.topic||a.topics.includes(input.topic))&&(!input.series||a.series===input.series));const requestedPage=Math.max(1,Math.min(input.page,Math.ceil(allowed.length/10)));const rows=allowed.slice((requestedPage-1)*10,requestedPage*10).map(a=>({articleId:a.articleId,passageId:fixture.passages.find(p=>p.articleId===a.articleId)?.passageId,title:'<img src=x onerror=evil()>',readingHref:'https://evil.invalid/',excerpt:'fabricated'}));const row=rows[0];await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({corpusId:fixture.c.corpusId,mode:'hybrid',total:malformed?-1:allowed.length,page:requestedPage,results:malformed?[row,row]:rows})});});
 await mode('semantic');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('關鍵字結果'));
 assert.ok((await page.locator('#search-status').textContent()).includes('關鍵字結果'),'Invalid remote count/duplicates must preserve keyword results');
 malformed=false;await page.getByRole('button',{name:'重試',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('依意思搜尋結果'));
 assert.equal(await page.locator('#search-results li').count(),10);assert.ok(!(await page.locator('#search-results').textContent()).includes('fabricated'));assert.ok(!(await page.locator('#search-results a').first().getAttribute('href')).startsWith('https://evil.invalid'));
 await page.getByRole('link',{name:'下一頁',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('第 2 頁'));assert.equal(new URL(page.url()).searchParams.get('page'),'2');await page.goBack();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('第 1 頁'));
 const sentBeforeTyping=semanticContractRequests;await page.getByLabel('搜尋文章',{exact:true}).fill('typed but not submitted');assert.equal(semanticContractRequests,sentBeforeTyping);
 assert.equal(await page.locator('select').count(),0);assert.equal(await page.locator('#clear-filters').count(),0);
 for(const width of [390,320])for(const theme of ['light','dark']){await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/semantic-${width}-${theme}.png`,fullPage:true});}
 await page.unroute('https://search.invalid/v1/search');
 for(const code of [409,503]){await page.route('https://search.invalid/v1/search',route=>route.fulfill({status:code,body:'{}'}));await mode('semantic');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('關鍵字結果'));assert.ok(await page.locator('#search-results li').count()>0);await page.unroute('https://search.invalid/v1/search');}
 // A changed release must replace, rather than reuse, withdrawn lexical fallback.
 const withdrawnTitle=await page.locator('#search-results h2 a').first().innerText();
 const withdrawn=fixture.c.articles.find(a=>a.title===withdrawnTitle);assert.ok(withdrawn);
 const nextId='1'.repeat(64),nextIndex={...fixture.c,corpusId:nextId,articles:fixture.c.articles.filter(a=>a.articleId!==withdrawn.articleId)};
 const nextPassages=fixture.passages.filter(p=>p.articleId!==withdrawn.articleId);
 const nextIndexUrl=base+'/discovery/'+nextId+'/index.json',nextPassagesUrl=base+'/discovery/'+nextId+'/passages.json';
 let refreshUnavailable=false;
 await page.route('**/discovery-manifest.json',route=>route.fulfill(refreshUnavailable?{status:503,body:'{}'}:{status:200,contentType:'application/json',body:JSON.stringify({corpusId:nextId,assets:{index:{href:nextIndexUrl},passages:{href:nextPassagesUrl}}})}));
 await page.route(nextIndexUrl,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(nextIndex)}));
 await page.route(nextPassagesUrl,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(nextPassages)}));
 await page.route('https://search.invalid/v1/search',route=>route.fulfill({status:409,body:'{}'}));
 const beforeConflict=semanticContractRequests;await mode('semantic');await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('關鍵字結果'));
 assert.ok(!(await page.locator('#search-results').innerText()).includes(withdrawnTitle),'Withdrawn title must disappear after current-release fallback');
 assert.ok(await page.locator('#search-results li').count()>0);assert.equal(semanticContractRequests,beforeConflict+1,'Recovery must not retry inference');
 refreshUnavailable=true;await page.getByRole('button',{name:'重試',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('搜尋暫時無法載入'));
 assert.equal(await page.locator('#search-results li').count(),0);assert.equal(await page.locator('#search-pagination a').count(),0);assert.equal(await page.getByLabel('搜尋文章',{exact:true}).inputValue(),'AI');
 await page.unroute('**/discovery-manifest.json');await page.unroute(nextIndexUrl);await page.unroute(nextPassagesUrl);await page.unroute('https://search.invalid/v1/search');
 await page.goto(base+'/search/?q=AI');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.className),'skip-link');
 const nojs=await browser.newContext({javaScriptEnabled:false});const p=await nojs.newPage();await p.goto(base+'/search/');assert.ok(await p.locator('noscript a').count()>0);await nojs.close();

 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const cold=[];for(let i=0;i<5;i++){await cdp.send('Network.clearBrowserCache');const start=performance.now();await page.goto(base+'/search/?q=AI');await page.locator('#search-results li').first().waitFor();cold.push(performance.now()-start);}
 const warm=[];for(let i=0;i<20;i++){const ms=await page.evaluate(i=>{const u=new URL(location.href);u.searchParams.set('q',i%2?'AI':'測試');const start=performance.now();history.pushState(null,'',u);dispatchEvent(new PopStateEvent('popstate'));const count=document.querySelectorAll('#search-results li').length;if(!count)throw new Error('Benchmark returned no work');return performance.now()-start;},i);warm.push(ms);}
 const summary=a=>{const sorted=[...a].sort((a,b)=>a-b);return {n:a.length,median:sorted[Math.floor(a.length/2)],p95:sorted[Math.ceil(a.length*.95)-1],max:sorted.at(-1),min:sorted[0]};};
 await writeFile(out+'/latency.json',JSON.stringify({environment:'local Chrome, CPU throttle 4x, 320px, existing 33-article corpus, no network shaping',scope:'cold navigation includes local HTTP and rendering; warm runs synchronous lexical/rank/DOM with corpus resident',limitations:'Shared host load is high; no comparative speedup, provider latency, global or cost claim',cold:summary(cold),warm:summary(warm),coldSamples:cold,warmSamples:warm,successfulResults:25,errors:0},null,2));
 assert.equal(unexpectedRemote,0);assert.equal(generationRequests,0);passed=true;
}finally{await browser?.close();await shutdown();await writeFile(out+'/server.log',log);let stillRunning=false;try{stillRunning=(await fetch(base+'/',{signal:AbortSignal.timeout(500)})).ok;}catch{}await writeFile(out+'/result.json',JSON.stringify({passed,base,viewports:[1280,390,320],themes:['light','dark'],corpusId:observedCorpusId,providerCalls:unexpectedRemote,semanticContractRequests,generationRequests,serverStopped:!stillRunning,serverPid:server.pid},null,2));assert.equal(stillRunning,false,'Owned preview listener must be closed');}
