import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import { approvedModel, type SearchPolicy } from '../../apps/search-worker/src/service';
import { sha256 } from '../../apps/search-worker/src/deployed';
const c=buildPublicDiscovery([{source:'local',id:'automation',title:'流程自動化',href:'/gcake-dev/posts/automation/',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/automation/',status:'published',topics:[],html:'<p>減少重複操作與流程自動化。</p>'}],{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'fixture',snapshotDigest:'fixture'});
const makeRequest=()=>new Request('https://search.invalid/v1/search',{method:'POST',headers:{Origin:'https://gcake119.github.io'},body:JSON.stringify({q:'如何減少每天重複操作',corpusId:c.corpusId})});
const policy:SearchPolicy={enabled:true,activeCorpusId:c.corpusId,model:approvedModel,modelConfig:'cloud-fixture',dimensions:1024,format:'plain',inputLimit:4096,billing:{model:approvedModel,id:'fixture',validUntil:new Date(Date.now()+3600000).toISOString(),rate:1075/1e6,freeVerified:true,noChargeBoundary:true,account:'fixture',providerResetVerified:true,windowId:new Date().toISOString().slice(0,10),services:['embedding','vector-query','vector-storage','worker','admission']},limits:{requests:10,tokens:10000,units:100,vectorQueries:10,storage:5000000,worker:100,admission:100},paidOverage:0,throttleSecret:'',qualityVerified:true,providerInputVerified:true};
async function fixture(){
 let embeddings=0,queries=0,stored:unknown;
 const env={SEMANTIC_ENABLED:'true',THROTTLE_SECRET:'fixture-only',DISCOVERY_DB:{prepare(sql:string){return {bind(){return this;},async first<T>(){return (sql.includes('discovery_policy')?{policy:JSON.stringify(stored)}:{id:'reserved'}) as T;},async run(){return {};}};}},AI:{async run(model:string,input:unknown){assert.equal(model,approvedModel);assert.deepEqual(input,{text:['如何減少每天重複操作']});embeddings++;return {data:[Array(1024).fill(1)]};}},VECTOR_INDEX:{async query(_v:number[],options:unknown){queries++;assert.deepEqual(options,{namespace:c.corpusId,topK:50,returnMetadata:'all'});return {matches:[{id:c.passages[0].passageId,metadata:{articleId:c.articles[0].articleId,revision:c.passages[0].revision}}]};}}};
 const bodies:Record<string,string>={index:JSON.stringify(c),passages:JSON.stringify(c.passages)};
 const assets=Object.fromEntries(await Promise.all(Object.entries(bodies).map(async([kind,body])=>[kind,{href:`/gcake-dev/discovery/${c.corpusId}/${kind}.json`,digest:await sha256(body)}])));
 const fetcher:typeof fetch=async(input)=>{const u=String(input);return new Response(u.endsWith('discovery-manifest.json')?JSON.stringify({schemaVersion:1,corpusId:c.corpusId,assets}):u.endsWith('index.json')?bodies.index:bodies.passages);};
 const runtime=await import('../../apps/search-worker/src/runtime');
 return {fetcher,worker:runtime.createProductionWorker(fetcher),env,calls:()=>[embeddings,queries],setPolicy:(v:unknown)=>{stored=v;}};
}
test('Authorized cloud binding is incomplete: zero remote calls and keyword fallback',async()=>{
 const h=await fixture();h.setPolicy(policy);
 for(const env of [{...h.env,SEMANTIC_ENABLED:'false'},{...h.env,AI:undefined},{...h.env,THROTTLE_SECRET:''}]){const r=await h.worker.fetch(makeRequest(),env);assert.equal(r.status,503);assert.equal((await r.json()).fallback,'keyword');}
 h.setPolicy(undefined);assert.equal((await h.worker.fetch(makeRequest(),h.env)).status,503);
 h.setPolicy({...policy,billing:{...policy.billing,validUntil:'2000-01-01'}});assert.equal((await h.worker.fetch(makeRequest(),h.env)).status,503);assert.deepEqual(h.calls(),[0,0]);
});
test('Verified cloud release uses actual bindings, current source links and BGE only',async()=>{
 const h=await fixture();h.setPolicy(policy);const r=await h.worker.fetch(makeRequest(),h.env);assert.equal(r.status,200);const body=await r.json();assert.equal(body.mode,'hybrid');assert.equal(body.results[0].articleId,'local:automation');assert.deepEqual(h.calls(),[1,1]);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://gcake119.github.io');assert.equal(r.headers.get('Cache-Control'),'no-store');
});

test('Cloudflare source downloads use supported redirect handling and reject redirected sources',async()=>{
 const h=await fixture();h.setPolicy(policy);
 const edgeFetch:typeof fetch=async(input,init)=>{
  if(init?.redirect==='error')throw new TypeError('Invalid redirect value: Workers supports follow or manual');
  return h.fetcher(input,init);
 };
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');
 const response=await createProductionWorker(edgeFetch).fetch(makeRequest(),h.env);
 assert.equal(response.status,200);assert.equal((await response.json()).mode,'hybrid');assert.deepEqual(h.calls(),[1,1]);
 const {deployedReader}=await import('../../apps/search-worker/src/deployed');
 let downloads=0;
 const redirected:typeof fetch=async(_input,init)=>{
  downloads++;assert.equal(init?.redirect,'manual');
  return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/manifest.json'}});
 };
 await assert.rejects(()=>deployedReader(redirected)(new AbortController().signal),/INVALID_DEPLOYMENT/);
 assert.equal(downloads,1);
});

test('Foreground index preparation can use a longer bounded static download than reader requests',async()=>{
 const h=await fixture();let first=true;
 const slow:typeof fetch=async(input,init)=>{if(first){first=false;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,2100);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('download deadline'));},{once:true});});}return h.fetcher(input,init);};
 const {deployedReader}=await import('../../apps/search-worker/src/deployed');
 const loaded=await deployedReader(slow,30000)(new AbortController().signal);assert.equal(loaded.corpusId,c.corpusId);assert.deepEqual(h.calls(),[0,0]);
});

test('Verified Workers Free renewal creates each UTC allocation once and never replenishes spent credit',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {readFile}=await import('node:fs/promises');const {activateFreeWindow}=await import('../../apps/search-worker/src/runtime');
 const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../../apps/search-worker/migrations/0001_admission.sql',import.meta.url),'utf8'));
 const database={prepare(sql:string){const statement=db.prepare(sql);let values:(string|number)[]=[];const bound={bind(...next:(string|number)[]){values=next;return bound;},async first<T>(){return (statement.get(...values)??null) as T|null;},async run(){return statement.run(...values);}};return bound;}};
 try{
 const now=Date.now(),day=new Date(now).toISOString().slice(0,10);const p={...policy,throttleSecret:'fixture-only',billing:{...policy.billing,windowId:'previous-day',renewal:'verified-workers-free-utc' as const}};
 const [a,b]=await Promise.all([activateFreeWindow(database,p,now),activateFreeWindow(database,p,now)]);assert.equal(a.billing.windowId,day);assert.equal(b.billing.windowId,day);assert.equal(db.prepare('SELECT count(*) n FROM discovery_windows').get()!.n,1);
 db.prepare('UPDATE discovery_windows SET requests=0').run();await activateFreeWindow(database,p,now);assert.equal(db.prepare('SELECT requests FROM discovery_windows').get()!.requests,0);
 const old=await activateFreeWindow(database,{...p,billing:{...p.billing,renewal:undefined}},now);assert.equal(old.billing.windowId,'previous-day');
 await activateFreeWindow(database,{...p,billing:{...p.billing,validUntil:'2000-01-01'}},now+86400000);assert.equal(db.prepare('SELECT count(*) n FROM discovery_windows').get()!.n,1);
 }finally{db.close();}
});

test('Runtime configuration and policy failures identify stage without credentials or reader data',async()=>{
 const h=await fixture();h.setPolicy(policy);
 for(const stage of ['configuration','policy']){
  const env=stage==='configuration'?{...h.env,AI:undefined}:{...h.env,DISCOVERY_DB:{prepare(){throw new Error('private-query 203.0.113.9 private-secret');}}};
  const r=await h.worker.fetch(makeRequest(),env);assert.equal(r.status,503);const b=await r.json();assert.equal(b.diagnostic?.stage,stage);assert.equal(b.diagnostic.reason,stage==='configuration'?'ineligible':'failure');assert.equal(r.headers.get('X-Search-Request-Id'),b.diagnostic.requestId);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://gcake119.github.io');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.doesNotMatch(JSON.stringify(b),/private-query|203\.0\.113\.9|private-secret/);
 }assert.deepEqual(h.calls(),[0,0]);
});
test('Source download deadline is identified before any embedding or vector call',async()=>{
 const h=await fixture();h.setPolicy(policy);const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('private-query 203.0.113.9')),{once:true});});
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const response=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(response.status,503);const b=await response.json();assert.equal(b.diagnostic?.stage,'source_initial');assert.equal(b.diagnostic.reason,'timeout');assert.deepEqual(h.calls(),[0,0]);assert.doesNotMatch(JSON.stringify(b),/private-query|203\.0\.113\.9/);
});

test('Independent public assets start together and final source check does not redownload them',async()=>{
 const h=await fixture();h.setPolicy(policy);const calls:string[]=[];let startBoth!:()=>void;const both=new Promise<void>(r=>startBoth=r);let started=0;
 const fetcher:typeof fetch=async(input,init)=>{
  const u=String(input);calls.push(u);assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'manual');
  if(!u.endsWith('discovery-manifest.json')){started++;if(started===2)startBoth();await Promise.race([both,new Promise((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(Error('shared deadline')),{once:true}))]);}
  return h.fetcher(input,init);
 };
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const r=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);
 assert.equal(r.status,200);assert.equal((await r.json()).mode,'hybrid');assert.equal(calls.filter(u=>u.endsWith('discovery-manifest.json')).length,2);assert.equal(calls.filter(u=>u.endsWith('index.json')).length,1);assert.equal(calls.filter(u=>u.endsWith('passages.json')).length,1);assert.deepEqual(h.calls(),[1,1]);
});
test('Production final verification rejects changed asset identity even when corpus ID was reused',async()=>{
 const h=await fixture();h.setPolicy(policy);let reads=0,assets=0;
 const fetcher:typeof fetch=async(input,init)=>{const u=String(input);const r=await h.fetcher(input,init);if(!u.endsWith('discovery-manifest.json')){assets++;return r;}reads++;if(reads===2){const m=await r.json();m.assets.index.digest='f'.repeat(64);return Response.json(m);}return r;};
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const r=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(r.status,409);assert.equal((await r.json()).fallback,'keyword');assert.equal(assets,2);assert.deepEqual(h.calls(),[1,1]);
});
test('Failed asset aborts its pending sibling and never reaches inference',async()=>{
 const h=await fixture();h.setPolicy(policy);let cancelled=false,started=false;
 const fetcher:typeof fetch=async(input,init)=>{const u=String(input);if(u.endsWith('index.json')){await Promise.resolve();return new Response('{}');}if(u.endsWith('passages.json')){started=true;return new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>{cancelled=true;reject(Error('sibling cancelled'));},{once:true});});}return h.fetcher(input,init);};
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const r=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(r.status,503);assert.equal((await r.json()).diagnostic.reason,'invalid_response');assert.equal(started,true);assert.equal(cancelled,true);assert.deepEqual(h.calls(),[0,0]);
});

test('Both asset descriptors are validated before any full asset request',async()=>{
 const h=await fixture();h.setPolicy(policy);let assets=0;const fetcher:typeof fetch=async(input,init)=>{if(!String(input).endsWith('discovery-manifest.json')){assets++;return h.fetcher(input,init);}const m=await (await h.fetcher(input,init)).json();m.assets.passages.href='https://untrusted.invalid/passages.json';return Response.json(m);};
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const r=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(r.status,503);assert.equal((await r.json()).diagnostic.stage,'source_initial');assert.equal(assets,0);assert.deepEqual(h.calls(),[0,0]);
});
for(const kind of ['changed','redirect','timeout'] as const)test('Manifest-only final check preserves '+kind+' rejection and never retries inference',async()=>{
 const h=await fixture();h.setPolicy(policy);let manifests=0,assets=0;const fetcher:typeof fetch=async(input,init)=>{if(!String(input).endsWith('discovery-manifest.json')){assets++;return h.fetcher(input,init);}if(++manifests===2){if(kind==='redirect')return new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/'}});if(kind==='timeout')return new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(Error('deadline')),{once:true}));const m=await (await h.fetcher(input,init)).json();m.corpusId='b'.repeat(64);for(const k of ['index','passages'])m.assets[k].href=m.assets[k].href.replace(c.corpusId,m.corpusId);return Response.json(m);}return h.fetcher(input,init);};
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const r=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(r.status,kind==='changed'?409:503);const b=await r.json();assert.equal(b.fallback,'keyword');if(kind!=='changed'){assert.equal(b.diagnostic.stage,'source_final');assert.equal(b.diagnostic.reason,kind==='timeout'?'timeout':'invalid_response');}assert.equal(assets,2);assert.deepEqual(h.calls(),[1,1]);
});

test('Ten-second public bodies complete without the old shared source or request timeout',async()=>{
 const h=await fixture();h.setPolicy(policy);let bodies=0;
 const fetcher:typeof fetch=async(input,init)=>{if(!String(input).endsWith('discovery-manifest.json')){bodies++;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,10000);init?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('source deadline'));},{once:true});});}return h.fetcher(input,init);};
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const response=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(response.status,200);assert.equal((await response.json()).mode,'hybrid');assert.equal(bodies,2);assert.deepEqual(h.calls(),[1,1]);
});

test('Incomplete public article bodies stop at the full-source budget before inference',async()=>{
 const h=await fixture();h.setPolicy(policy);let cancelled=0;
 const fetcher:typeof fetch=async(input,init)=>{
  if(String(input).endsWith('discovery-manifest.json'))return h.fetcher(input,init);
  return new Response(new ReadableStream({start(controller){init?.signal?.addEventListener('abort',()=>{cancelled++;controller.error(Error('body cancelled'));},{once:true});}}));
 };
 const {createProductionWorker}=await import('../../apps/search-worker/src/runtime');const response=await createProductionWorker(fetcher).fetch(makeRequest(),h.env);assert.equal(response.status,503);const b=await response.json();assert.equal(b.diagnostic.stage,'source_initial');assert.equal(b.diagnostic.reason,'timeout');assert.equal(cancelled,2);assert.deepEqual(h.calls(),[0,0]);
});
