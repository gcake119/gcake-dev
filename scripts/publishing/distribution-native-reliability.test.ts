import test from 'node:test';
import assert from 'node:assert/strict';
import {anonymousSubstackReader} from './substack-attended';
import {assertPublicDomEvidence,type SubstackUiContract} from './substack-browser';
import {PlaywrightSubstackAdapter} from './substack-browser';
import {NativeChromePage} from './macos-chrome-page';
import {ChromeTabBridge} from './macos-chrome';
import {chromium} from 'playwright';
import http from 'node:http';
import vm from 'node:vm';

const url='https://gcakedev.substack.com/p/demo';
const article={slug:'demo',sourceRevision:'r1',title:'Demo',body:'Hello [original](https://example.com/original)',assets:[],canonicalUrl:'https://example.com/original',publishedAt:'2026-10-14T23:00:00Z',substackDatePrecision:'minute' as const};
const ui={publicBody:'article',publicTitle:'h1',publicDate:'time[datetime]'} as SubstackUiContract;
const html=(dates:string)=>`<html><head><link rel="canonical" href="${url}"></head><body><h1>Demo</h1>${dates}<article><p>Hello <a href="https://example.com/original">original</a></p></article></body></html>`;
const verify=async(dates:string)=>{
 const evidence=await anonymousSubstackReader(ui,async()=>new Response(html(dates),{headers:{'content-type':'text/html'}}))({id:'123',url});
 assertPublicDomEvidence(article,evidence,{policy:'full-mirror',remoteUrl:url});
 return evidence;
};
for(const attribute of ['datetime','dateTime','DATETIME'])test(`anonymous same-ID public verification accepts HTML ${attribute} date spelling`,async()=>{
 const evidence=await verify(`<time ${attribute}="2026-10-14T23:00:00.681Z">October 15</time>`);
 assert.equal(evidence.publishedAt,'2026-10-14T23:00:00.681Z');
});
for(const dates of [
 '<time dateTime="2026-10-14T23:01:00Z">October 15</time>',
 '<time dateTime="invalid">October 15</time>',
 '<time>October 15</time>',
 '<time datetime="2026-10-14T23:00:00Z"></time><time dateTime="2026-10-14T23:00:00Z"></time>',
 '<time datetime="2026-10-14T23:00:00Z" dateTime="2026-10-14T23:01:00Z"></time>',
])test(`anonymous verification rejects missing conflicting or wrong-minute dates: ${dates}`,async()=>{
 await assert.rejects(verify(dates),/SUBSTACK_PUBLIC_/);
});

async function nativeFixture(html:string,run:(adapter:PlaywrightSubstackAdapter,page:import('playwright').Page)=>Promise<void>,extra:Partial<SubstackUiContract>={},resolvePublic?: (id:string,origin:string)=>Promise<{id:string;url:string}>) {
 const server=http.createServer((_,res)=>{res.setHeader('content-type','text/html');res.end(html);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try {
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.goto(origin+'/publish/home');
  const native=new NativeChromePage(new ChromeTabBridge({windowId:1,tabId:2,url:page.url()},{read:async()=>({windowId:1,tabId:2,url:page.url()}),execute:async code=>await page.evaluate(code) as string,navigate:async destination=>{await page.goto(destination);}},async()=>{},origin));
  const contract={version:1,origin,reviewedAt:'2026-10-15',publishingCapabilitiesVerified:true,discoveryVerified:true,publicationPolicy:'full-mirror',homePath:'/publish/home',postsPath:'/publish/posts',editPath:'/publish/post/{id}',create:{css:'#create'},title:{css:'#title'},body:{css:'#body'},saved:{css:'#saved'},continue:{css:'#continue'},email:{css:'#email'},appNotification:{css:'#app'},schedule:{css:'#schedule'},confirmPublish:{css:'#publish'},publicLink:{css:'#public'},settings:{css:'#settings'},publishedAt:{css:'#date'},displayedDateFormat:'iso',draftLinks:'a.post',scanComplete:{css:'#complete'},publicBody:'article',publicTitle:'h1',publicDate:'time',...extra} as SubstackUiContract;
  await run(new PlaywrightSubstackAdapter(native.asPage(),contract,true,undefined,undefined,resolvePublic?id=>resolvePublic(id,origin):undefined),page);
 } finally {await browser?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}

test('native discovery waits for the selected list before trusting its totals and scans all three scopes',async()=>{
 const scopes=['published','draft','scheduled'] as const;
 const content=`<div>${scopes.map(state=>`<button id="${state}" role="tab" aria-selected="false" onclick="selectList('${state}')">${state} 999</button>`).join('')}</div><div id="items"></div><script>
 function selectList(state){setTimeout(()=>{for(const b of document.querySelectorAll('[role=tab]'))b.setAttribute('aria-selected','false');const tab=document.getElementById(state);tab.setAttribute('aria-selected','true');tab.textContent=state+(state==='scheduled'?'':' 1');items.innerHTML=state==='scheduled'?'<span id="empty">No scheduled posts</span>':'<a class="post" href="/publish/post/'+(state==='published'?'123':'456')+'"><span class="title">'+(state==='published'?'Demo':'Other')+'</span></a>';},150);}
 </script>`;
 await nativeFixture(content,async adapter=>{assert.deepEqual((await adapter.find(article)).map(remote=>remote.id),['123']);},{discoveryScopes:scopes.map(state=>({state,tab:{css:`#${state}`},total:{css:`#${state}`},items:'a.post',titleSelector:'.title',complete:{css:`#${state}[aria-selected="true"]`},...(state==='scheduled'?{empty:{css:'#empty'}}:{})}))});
});

test('native website-only confirmation waits for the dialog and publishes once with every delivery control off',async()=>{
 const content=`<input id="title" value="Demo"><div id="body"><p>Hello <a href="https://example.com/original">original</a></p></div><span id="saved">Saved</span><a id="public" href="/p/demo">Public</a><button id="continue" onclick="dialog.hidden=false">Continue</button><div id="dialog" hidden><input id="email" type="checkbox" checked><input id="app" type="checkbox" checked><input id="schedule" type="checkbox" checked><button id="publish" onclick="window.publishClicks=(window.publishClicks||0)+1;setTimeout(()=>dialog.insertAdjacentHTML('beforeend','<button id=website onclick=confirmWebsite()>Website only</button>'),150)">Publish</button></div><script>function confirmWebsite(){window.confirmations=(window.confirmations||0)+1;window.delivery=[email.checked,app.checked,schedule.checked];dialog.hidden=true;}</script>`;
 await nativeFixture(content,async(adapter,page)=>{
  const result=await adapter.publish({id:'123',url:new URL('/publish/post/123',page.url()).href},article);
  assert.equal(result.id,'123');assert.match(result.url,/\/p\/demo$/);
  assert.deepEqual(await page.evaluate(()=>({clicks:(window as any).publishClicks,confirmations:(window as any).confirmations,delivery:(window as any).delivery})),{clicks:1,confirmations:1,delivery:[false,false,false]});
 },{websiteOnlyConfirm:{css:'#website'},settingsDone:{css:'#done'}});
});

test('published discovery preserves the anonymous public identity before adopting an existing mirror',async()=>{
 await nativeFixture('<button id="published" role="tab" aria-selected="true">Published 1</button><a class="post" href="/publish/posts/detail/123"><span class="title">Demo</span></a>',async(adapter,page)=>{
  assert.deepEqual(await adapter.find(article),[{id:'123',url:new URL('/p/demo',page.url()).href}]);
 },{discoveryScopes:[{state:'published',tab:{css:'#published'},total:{css:'#published'},items:'a.post',titleSelector:'.title',complete:{css:'#published[aria-selected="true"]'}}]},async(id,origin)=>({id,url:origin+'/p/demo'}));
});

test('native preflight tolerates a bounded eleven-second browser navigation without replay',{timeout:20000},async()=>{
 const target={windowId:1,tabId:2,url:'https://gcakedev.substack.com/publish/posts'};
 let live=target.url,navigations=0,timer:ReturnType<typeof setTimeout>|undefined;
 const sandbox=vm.createContext({window:{},location:{origin:'https://gcakedev.substack.com',href:live,pathname:'/publish/posts'},document:{readyState:'complete',documentElement:{querySelectorAll:()=>[{innerText:'Home'}]}}});
 const native=new NativeChromePage(new ChromeTabBridge(target,{read:async()=>({...target,url:live}),execute:async code=>vm.runInContext(code,sandbox),navigate:async destination=>{navigations++;timer=setTimeout(()=>{live=destination;sandbox.location.href=live;sandbox.location.pathname=new URL(live).pathname;},11000);}}));
 const contract={version:1,origin:'https://gcakedev.substack.com',reviewedAt:'2026-10-15',homePath:'/publish/home',postsPath:'/publish/posts',editPath:'/publish/post/{id}',create:{css:'#create'},title:{css:'#title'},body:{css:'#body'},saved:{css:'#saved'},continue:{css:'#continue'},email:{css:'#email'},confirmPublish:{css:'#publish'}} as SubstackUiContract;
 try{await new PlaywrightSubstackAdapter(native.asPage(),contract).preflight();assert.equal(navigations,1);}finally{clearTimeout(timer);}
});
