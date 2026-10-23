import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { synchronizeIndex } from '../../apps/search-worker/src/sync';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import type { SearchPolicy } from '../../apps/search-worker/src/service';
const source={source:'local',id:'sync',title:'流程自動化',href:'/gcake-dev/posts/sync/',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/sync/',status:'published',topics:[],html:'<p>新的公開文章說明流程自動化。</p>'};
const corpus=()=>buildPublicDiscovery([source],{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'fixture',snapshotDigest:'fixture'});
async function setup(count=1){
 const sql=new DatabaseSync(':memory:');for(const n of ['0001_admission','0002_policy','0003_index_sync','0004_sync_receipt_retention'])sql.exec(await readFile(new URL(`../../apps/search-worker/migrations/${n}.sql`,import.meta.url),'utf8'));
 const db={prepare(q:string){const st=sql.prepare(q);let args:any[]=[];const bound={bind(...a:any[]){args=a;return bound;},async first<T>(){return(st.get(...args)??null) as T|null;},async all<T>(){return{results:st.all(...args) as T[]};},async run(){return st.run(...args);}};return bound;},async batch(st:any[]){sql.exec('BEGIN');try{const r=[];for(const x of st)r.push(await x.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const c=count===1?corpus():buildPublicDiscovery(Array.from({length:count},(_,i)=>({...source,id:`sync-${i}`,href:`/gcake-dev/posts/sync-${i}/`})),{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'fixture',snapshotDigest:'fixture'});let current=c;const p:SearchPolicy={enabled:true,activeCorpusId:'old',model:'@cf/baai/bge-m3',modelConfig:'cloudflare:@cf/baai/bge-m3:plain:1024:cosine:bytes4096:v1',dimensions:1024,format:'plain',inputLimit:4096,syncCapacity:{validUntil:new Date(Date.now()+86400000).toISOString(),otherDimensions:0},billing:{model:'@cf/baai/bge-m3',id:'fixture',validUntil:new Date(Date.now()+86400000).toISOString(),rate:1075/1e6,freeVerified:true,noChargeBoundary:true,account:'979a3735f8dfa269e7474135f348cfdf',providerResetVerified:true,windowId:new Date().toISOString().slice(0,10),renewal:'verified-workers-free-utc',services:['embedding','vector-query','vector-storage','worker','admission']},limits:{requests:500,tokens:2000000,units:8000,vectorQueries:500,storage:4000000,worker:10000,admission:80000},paidOverage:0,throttleSecret:'fixture',qualityVerified:true,providerInputVerified:true};
 const save=()=>sql.prepare("INSERT OR REPLACE INTO discovery_policy VALUES ('active',?)").run(JSON.stringify(p));save();let ai=0,writes=0,failAI=false,hidden=false;const vectors=new Map<string,any>();
 const env={INDEX_SYNC_ENABLED:'true',SEMANTIC_ENABLED:'true',THROTTLE_SECRET:'fixture',DISCOVERY_DB:db,AI:{async run(model:string,input:{text:string[]}){assert.equal(model,'@cf/baai/bge-m3');assert.ok(sql.prepare('SELECT count(*) n FROM discovery_reservations WHERE tokens>0').get()!.n);ai++;if(failAI)throw Error('unknown');return{data:input.text.map(()=>Array(1024).fill(1))};}},VECTOR_INDEX:{async describe(){return{vectorCount:vectors.size,dimensions:1024};},async getByIds(ids:string[]){return hidden?[]:ids.flatMap(id=>vectors.has(id)?[vectors.get(id)]:[]);},async upsert(v:any[]){writes++;for(const x of v)vectors.set(x.id,x);return{mutationId:'fixture'};},async deleteByIds(ids:string[]){writes++;for(const x of ids)vectors.delete(x);return{mutationId:'fixture'};}}};
 const read=async()=>({corpusId:current.corpusId,corpus:current});const run=(options:Parameters<typeof synchronizeIndex>[1]={})=>synchronizeIndex(env,{read,...options});
 return{sql,env,p,c,save,run,vectors,calls:()=>[ai,writes],current:(v:any)=>current=v,fail:()=>failAI=true,hide:(v:boolean)=>hidden=v,close:()=>sql.close()};
}
test('Cloud-hosted synchronization reserves shared quota, verifies provider values, then promotes the public release',async()=>{const h=await setup();try{assert.equal((await h.run()).status,'uploaded');assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');assert.equal((await h.run()).status,'promoted');assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,h.c.corpusId);assert.deepEqual(h.calls(),[1,1]);assert.equal((await h.run()).status,'no_change');assert.deepEqual(h.calls(),[1,1]);}finally{h.close();}});
test('Unknown inference retains its reservation and is never automatically repeated',async()=>{const h=await setup();try{h.fail();assert.equal((await h.run()).status,'blocked');assert.equal((await h.run()).status,'blocked');assert.equal(h.calls()[0],1);assert.ok(h.sql.prepare('SELECT sum(tokens) n FROM discovery_reservations').get()!.n);assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');}finally{h.close();}});
test('Saved output waits for full readback and resumes without another inference',async()=>{const h=await setup();try{await h.run();h.hide(true);assert.equal((await h.run()).status,'awaiting_readback');assert.equal(h.calls()[0],1);h.hide(false);await h.run();await h.run();assert.equal(h.calls()[0],1);}finally{h.close();}});
test('Disabled, expired and concurrent rounds cannot infer or promote',async()=>{const h=await setup();try{h.env.INDEX_SYNC_ENABLED='false';assert.equal((await h.run()).status,'disabled');h.env.INDEX_SYNC_ENABLED='true';h.p.billing.validUntil='2000-01-01';h.save();assert.equal((await h.run()).status,'ineligible');h.p.billing.validUntil=new Date(Date.now()+86400000).toISOString();h.save();h.sql.prepare('UPDATE discovery_sync SET leaseUntil=?').run(Date.now()+60000);assert.equal((await h.run()).status,'busy');h.sql.exec('UPDATE discovery_sync SET leaseUntil=0');await h.run();}finally{h.close();}});
test('Changed public release and operator policy edits prevent stale promotion',async()=>{const h=await setup();try{await h.run();h.current({...h.c,corpusId:'b'.repeat(64)});assert.equal((await h.run()).status,'source_changed');assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');assert.equal(h.calls()[0],1);}finally{h.close();}});
test('Shared daily quota exhaustion prevents inference and is not replenished by the next run',async()=>{const h=await setup();try{const {activateFreeWindow}=await import('../../apps/search-worker/src/runtime');await activateFreeWindow(h.env.DISCOVERY_DB,h.p,Date.now());h.sql.exec('UPDATE discovery_windows SET tokens=0');assert.equal((await h.run()).status,'quota_exceeded');assert.equal((await h.run()).status,'quota_exceeded');assert.deepEqual(h.calls(),[0,0]);assert.equal(h.sql.prepare('SELECT tokens FROM discovery_windows').get()!.tokens,0);}finally{h.close();}});
test('An operator change between upload and promotion cannot be overwritten',async()=>{const h=await setup();try{await h.run();h.p.activeCorpusId='operator-changed';h.save();assert.equal((await h.run()).status,'blocked');assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'operator-changed');assert.equal(h.calls()[0],1);}finally{h.close();}});
test('Tampered provider values are never promoted',async()=>{const h=await setup();try{await h.run();const [v]=await h.env.VECTOR_INDEX.getByIds([h.c.passages[0].passageId]);v.values[0]=0;assert.equal((await h.run()).status,'awaiting_readback');assert.equal(h.calls()[0],1);}finally{h.close();}});
test('Only owned obsolete vectors may be deleted; an unknown identity is preserved',async()=>{const h=await setup();try{h.sql.prepare('INSERT INTO discovery_sync_vectors VALUES(?,?,?,?,?,?)').run('obsolete','old:a','revision','hash',h.p.modelConfig,'old');await h.env.VECTOR_INDEX.upsert([{id:'obsolete',namespace:'old',values:Array(1024).fill(1/32),metadata:{articleId:'foreign:a',revision:'revision'}}]);assert.equal((await h.run()).status,'blocked');assert.equal((await h.env.VECTOR_INDEX.describe()).vectorCount,1);await h.env.VECTOR_INDEX.upsert([{id:'obsolete',namespace:'old',values:Array(1024).fill(1/32),metadata:{articleId:'old:a',revision:'revision'}}]);assert.equal((await h.run()).status,'cleaning');assert.equal((await h.run()).status,'cleaned');assert.equal((await h.env.VECTOR_INDEX.describe()).vectorCount,0);}finally{h.close();}});
test('Only the encrypted operator token may trigger fixed-source indexing; public requests cannot',async()=>{const {authorizeIndexTrigger}=await import('../../apps/search-worker/src/sync-trigger');const secret='fixture'.repeat(8);assert.equal(await authorizeIndexTrigger(new Request('https://worker/internal/index-sync',{method:'POST'}),secret),false);assert.equal(await authorizeIndexTrigger(new Request('https://worker/internal/index-sync',{method:'POST',headers:{Authorization:'Bearer '+secret}}),secret),true);assert.equal(await authorizeIndexTrigger(new Request('https://worker/internal/index-sync',{headers:{Authorization:'Bearer '+secret}}),secret),false);});
test('An upload acknowledgement lost after saving output can be retried without another model call',async()=>{const h=await setup();try{const upsert=h.env.VECTOR_INDEX.upsert;let lose=true;h.env.VECTOR_INDEX.upsert=async v=>{await upsert(v);if(lose){lose=false;throw Error('lost acknowledgement');}return{mutationId:'fixture'};};assert.equal((await h.run()).status,'blocked');assert.equal((await h.run()).status,'uploaded');assert.equal(h.calls()[0],1);assert.equal((await h.run()).status,'promoted');}finally{h.close();}});
test('Maintenance receipts expire after thirty days while current evidence remains',async()=>{const h=await setup();try{h.sql.prepare('INSERT INTO discovery_sync_receipts(created,corpusId,status,detail) VALUES(?,?,?,?)').run(Date.now()-31*86400000,'old','no_change','old');h.p.activeCorpusId=h.c.corpusId;h.save();assert.equal((await h.run()).status,'no_change');const rows=h.sql.prepare('SELECT corpusId FROM discovery_sync_receipts').all();assert.deepEqual(rows.map(r=>r.corpusId),[h.c.corpusId]);}finally{h.close();}});
test('A ledger-proven compatible passage reuses its vector under the new public namespace with zero inference',async()=>{const h=await setup();try{const {sha256}=await import('../../apps/search-worker/src/deployed');const p=h.c.passages[0];h.sql.prepare('INSERT INTO discovery_sync_vectors VALUES(?,?,?,?,?,?)').run(p.passageId,p.articleId,p.revision,await sha256(p.text),h.p.modelConfig,'old');await h.env.VECTOR_INDEX.upsert([{id:p.passageId,namespace:'old',values:Array(1024).fill(1/32),metadata:{articleId:p.articleId,revision:p.revision}}]);assert.equal((await h.run()).status,'uploaded');assert.equal(h.calls()[0],0);assert.equal((await h.run()).status,'promoted');const [v]=await h.env.VECTOR_INDEX.getByIds([p.passageId]);assert.equal(v.namespace,h.c.corpusId);assert.equal(h.sql.prepare('SELECT sum(tokens) n FROM discovery_reservations').get()!.n,0);}finally{h.close();}});

test('Verified continuation uploads only the next batch and promotes the final partial batch',async()=>{
 const h=await setup(33);try{
  assert.equal((await h.run()).status,'uploaded');assert.equal(h.vectors.size,16);
  h.hide(true);assert.equal((await h.run()).status,'awaiting_readback');assert.deepEqual(h.calls(),[1,1]);h.hide(false);
  assert.equal((await h.run()).status,'uploaded');assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,16);assert.equal(h.vectors.size,32);
  assert.equal((await h.run()).status,'uploaded');assert.equal(h.vectors.size,33);
  assert.equal((await h.run()).status,'promoted');assert.deepEqual(h.calls(),[3,3]);
  assert.equal((await h.run()).status,'no_change');assert.deepEqual(h.calls(),[3,3]);
 }finally{h.close();}
});
test('Readback preserves progress when time or continuation admission is insufficient',async()=>{
 for(const reason of ['time','admission']){const h=await setup(17);try{
  await h.run();let clock=Date.now();
  const get=h.env.VECTOR_INDEX.getByIds;h.env.VECTOR_INDEX.getByIds=async ids=>{const r=await get(ids);if(reason==='time')clock+=20000;else h.sql.exec('UPDATE discovery_windows SET admission=0');return r;};
  assert.equal((await h.run({now:()=>clock})).status,'verified');
  assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,16);assert.deepEqual(h.calls(),[1,1]);
 }finally{h.close();}}
});
test('Equivalent public rebuild preserves pending and confirmed progress without inference replay',async()=>{
 const h=await setup(17);try{await h.run();h.current(buildPublicDiscovery(Array.from({length:17},(_,i)=>({...source,id:`sync-${i}`,href:`/gcake-dev/posts/sync-${i}/`})),{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'rebuilt',snapshotDigest:'different-time'}));
 assert.equal((await h.run()).status,'uploaded');assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,16);
 assert.equal((await h.run()).status,'promoted');assert.deepEqual(h.calls(),[2,2]);
 }finally{h.close();}
});
test('Lease lost during readback never commits progress or promotes',async()=>{
 const h=await setup();try{await h.run();const get=h.env.VECTOR_INDEX.getByIds;h.env.VECTOR_INDEX.getByIds=async ids=>{const r=await get(ids);h.sql.exec("UPDATE discovery_sync SET owner='other',leaseUntil=9999999999999");return r;};
 assert.equal((await h.run()).status,'blocked');assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,0);assert.equal(h.sql.prepare('SELECT count(*) n FROM discovery_sync_pending').get()!.n,1);assert.deepEqual(h.calls(),[1,1]);
 }finally{h.close();}
});
test('Final source change and policy expiry during readback prevent promotion',async()=>{
 for(const reason of ['source','expiry']){const h=await setup();try{await h.run();const get=h.env.VECTOR_INDEX.getByIds;let clock=Date.now();h.env.VECTOR_INDEX.getByIds=async ids=>{const r=await get(ids);if(reason==='source')h.current({...h.c,corpusId:'b'.repeat(64)});else clock=Date.parse(h.p.billing.validUntil);return r;};
 assert.ok(['source_changed','blocked'].includes((await h.run({now:()=>clock})).status));assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');assert.equal(h.calls()[0],1);
 }finally{h.close();}}
});

test('Capacity evidence counts other, retained and worst-case namespace copies even for reused vectors',async()=>{
 for(const condition of ['absent','expired','unknown','other-usage','retained']){const h=await setup();try{
  const {sha256}=await import('../../apps/search-worker/src/deployed');const p=h.c.passages[0];
  h.sql.prepare('INSERT INTO discovery_sync_vectors VALUES(?,?,?,?,?,?)').run(p.passageId,p.articleId,p.revision,await sha256(p.text),h.p.modelConfig,'old');
  h.vectors.set(p.passageId,{id:p.passageId,namespace:'old',values:Array(1024).fill(1/32),metadata:{articleId:p.articleId,revision:p.revision}});
  if(condition==='absent')delete h.p.syncCapacity;
  if(condition==='expired')h.p.syncCapacity!.validUntil='2000-01-01';
  if(condition==='unknown')h.p.syncCapacity!.otherDimensions=NaN;
  if(condition==='other-usage')h.p.syncCapacity!.otherDimensions=h.p.limits.storage-1024;
  if(condition==='retained')h.env.VECTOR_INDEX.describe=async()=>({dimensions:1024,vectorCount:3906});
  h.save();assert.equal((await h.run()).status,'capacity_exceeded',condition);assert.deepEqual(h.calls(),[0,0]);
 }finally{h.close();}}
});
test('Legacy transition readback is safe for provider move, overwrite and namespace-copy behavior',async()=>{
 for(const mode of ['move','overwrite','copy']){const h=await setup();try{
  const {sha256}=await import('../../apps/search-worker/src/deployed');const p=h.c.passages[0];
  const old={id:p.passageId,namespace:'old',values:Array(1024).fill(1/32),metadata:{articleId:p.articleId,revision:p.revision}};
  h.sql.prepare('INSERT INTO discovery_sync_vectors VALUES(?,?,?,?,?,?)').run(p.passageId,p.articleId,p.revision,await sha256(p.text),h.p.modelConfig,'old');h.vectors.set(p.passageId,old);
  const upsert=h.env.VECTOR_INDEX.upsert;h.env.VECTOR_INDEX.upsert=async v=>{if(mode==='copy')h.vectors.set('retained-copy',structuredClone(old));return upsert(v);};
  assert.equal((await h.run()).status,'uploaded');assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');
  assert.equal((await h.run()).status,'promoted');assert.equal(h.calls()[0],0);assert.equal(h.vectors.size,mode==='copy'?2:1);
 }finally{h.close();}}
});

test('Completed equivalent rebuild does no enrichment; real changed target with no pending starts safely',async()=>{
 const h=await setup();try{
  await h.run();await h.run();const calls=h.calls();
  h.current(buildPublicDiscovery([source],{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'different',snapshotDigest:'later'}));
  assert.equal((await h.run()).status,'no_change');assert.deepEqual(h.calls(),calls);
  const next=buildPublicDiscovery([{...source,html:'<p>new revision</p>'}],{now:new Date().toISOString(),baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'different',snapshotDigest:'later'});h.current(next);
  assert.equal((await h.run()).status,'cleaning');assert.equal((await h.run()).status,'cleaned');assert.equal((await h.run()).status,'uploaded');
  assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,0);assert.equal((await h.run()).status,'promoted');
 }finally{h.close();}
});
test('Owner lost during final manifest check cannot commit ledger or active version',async()=>{
 const h=await setup();try{await h.run();let checks=0;
 const result=await h.run({current:async()=>{if(++checks===2)h.sql.exec("UPDATE discovery_sync SET owner='other',leaseUntil=9999999999999");return h.c.corpusId;}});
 assert.equal(result.status,'blocked');assert.equal(h.sql.prepare('SELECT cursor FROM discovery_sync').get()!.cursor,0);assert.equal(h.sql.prepare('SELECT count(*) n FROM discovery_sync_pending').get()!.n,1);
 assert.equal(JSON.parse(h.sql.prepare('SELECT policy FROM discovery_policy').get()!.policy as string).activeCorpusId,'old');
 }finally{h.close();}
});

test('Reader admission competes atomically with index work for the final shared token allocation',async()=>{
 const h=await setup();try{
  const {activateFreeWindow}=await import('../../apps/search-worker/src/runtime');const {D1Admission}=await import('../../apps/search-worker/src/admission');
  await activateFreeWindow(h.env.DISCOVERY_DB,h.p,Date.now());const bytes=new TextEncoder().encode(h.c.passages[0].text).length;
  h.sql.prepare('UPDATE discovery_windows SET tokens=?').run(bytes);
  const [sync,reader]=await Promise.all([h.run(),new D1Admission(h.env.DISCOVERY_DB).reserve(h.p.billing.windowId,'reader-fixture',{requests:1,tokens:bytes,units:0,vectorQueries:0,worker:0,admission:1,storage:0},h.p.limits,Date.now())]);
  assert.equal(Number(reader)+h.calls()[0],1);assert.equal(h.sql.prepare('SELECT tokens FROM discovery_windows').get()!.tokens,0);
  if(reader){assert.equal(sync.status,'quota_exceeded');assert.deepEqual(h.calls(),[0,0]);}
 }finally{h.close();}
});

test('Unchanged minute checks retain a sustainable daily admission budget',async()=>{
 const h=await setup();try{h.p.activeCorpusId=h.c.corpusId;h.save();assert.equal((await h.run()).status,'no_change');
 const cost=Number(h.sql.prepare('SELECT sum(admission) n FROM discovery_reservations').get()!.n);
 assert.ok(cost*1440<=h.p.limits.admission,'unchanged scheduled checks alone must not exhaust the daily budget');assert.deepEqual(h.calls(),[0,0]);
 }finally{h.close();}
});
