import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runSyncRound,type SyncDependencies} from './sync-distribution';
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-scripted-'));const runtime=path.join(root,'runtime');await fs.mkdir(runtime);await fs.writeFile(path.join(runtime,'runner.ts'),'pinned');
 const pin=path.join(root,'pin.json');await fs.writeFile(pin,JSON.stringify({'runner.ts':createHash('sha256').update('pinned').digest('hex')}));
 const calls:string[]=[];const state={status:'verified'};
 const deps:SyncDependencies={validate:async()=>{},audit:async()=>({locks:[],checkpoints:[],intents:[]}),snapshot:async dest=>{calls.push('snapshot');await fs.mkdir(dest);return {sourceRoot:dest,sourceCommit:'a'.repeat(40)};},plan:async (source)=>({inventory:{entries:[]},articles:[{slug:'article',run:{sourceRoot:source,configFile:'scope',commands:[{target:'substack',operation:'verify'}],recoveries:[]}}]} as never),execute:async(_slug,c)=>{calls.push(c.target+':'+c.operation);return {...state};}};
 return {root,runtime,pin,calls,deps,options:{runtime,pin,configFile:path.join(root,'policy.json'),acceptanceFile:path.join(root,'acceptance.json'),output:path.join(root,'runs'),lock:path.join(root,'lock'),execute:true},cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('unchanged round verifies Substack, retains evidence and removes only its owned snapshot',async()=>{const f=await fixture();try{const r=await runSyncRound(f.options,f.deps);assert.deepEqual(f.calls,['snapshot','substack:verify']);assert.equal(r.status,'completed');assert.equal(r.cleanup.source,'removed');assert.equal(r.notification,'quiet');assert.equal(await fs.readFile(path.join(f.runtime,'runner.ts'),'utf8'),'pinned');assert.equal(JSON.parse(await fs.readFile(path.join(r.directory,'result.json'),'utf8')).status,'completed');}finally{await f.cleanup();}});
test('rate-limit failure is recorded once and stops without replay',async()=>{const f=await fixture();try{f.deps.execute=async(_,c)=>{f.calls.push(c.target);throw Error('SUBSTACK_RATE_LIMITED');};const r=await runSyncRound(f.options,f.deps);assert.deepEqual(f.calls,['snapshot','substack']);assert.equal(r.status,'attention');assert.equal(r.results[0].code,'SUBSTACK_RATE_LIMITED');assert.equal(r.results.length,1);}finally{await f.cleanup();}});
test('uncertain preparation never falls through into publication',async()=>{const f=await fixture();try{f.deps.plan=async(source)=>({inventory:{entries:[]},articles:[{slug:'article',run:{sourceRoot:source,configFile:'scope',commands:[{target:'substack',operation:'prepare'},{target:'substack',operation:'publish'}],recoveries:[]}}]} as never);f.deps.execute=async(_,c)=>{f.calls.push(c.operation);return {status:'uncertain',lastErrorCode:'LOST_REPLY'};};const r=await runSyncRound(f.options,f.deps);assert.deepEqual(f.calls,['snapshot','prepare']);assert.equal(r.status,'attention');}finally{await f.cleanup();}});
test('changed pin or concurrent owner stops before snapshot and never steals lock',async()=>{const f=await fixture();try{await fs.mkdir(f.options.lock);await assert.rejects(runSyncRound(f.options,f.deps),/ROUND_LOCKED/);assert.deepEqual(f.calls,[]);await fs.rm(f.options.lock,{recursive:true});await fs.writeFile(path.join(f.runtime,'runner.ts'),'changed');await assert.rejects(runSyncRound(f.options,f.deps),/PIN_MISMATCH/);assert.deepEqual(f.calls,[]);}finally{await f.cleanup();}});
test('planning dispatches no operations and retains only the plan and evidence',async()=>{const f=await fixture();try{const r=await runSyncRound({...f.options,execute:false},f.deps);assert.deepEqual(f.calls,['snapshot']);assert.equal(r.results.length,0);assert.equal(r.cleanup.source,'removed');}finally{await f.cleanup();}});
test('unanswered side request preserves source and is never replayed',async()=>{const f=await fixture();try{f.deps.execute=async(_slug,_command,run)=>{await fs.mkdir(path.join(run.sourceRoot,'..','handoffs'),{recursive:true});await fs.writeFile(path.join(run.sourceRoot,'..','handoffs','request.json'),'{}');throw Error('SUBSTACK_ATTENDED_TIMEOUT');};const r=await runSyncRound(f.options,f.deps);assert.equal(r.cleanup.source,'retained');assert.ok(await fs.stat(path.join(r.directory,'source')));}finally{await f.cleanup();}});
test('a merely pending prepare is not permission to publish',async()=>{const f=await fixture();try{f.deps.plan=async(source)=>({inventory:{entries:[]},articles:[{slug:'article',run:{sourceRoot:source,configFile:'scope',commands:[{target:'substack',operation:'prepare'},{target:'substack',operation:'publish'}],recoveries:[]}}]} as never);f.deps.execute=async(_,c)=>{f.calls.push(c.operation);return {status:'pending'};};await runSyncRound(f.options,f.deps);assert.deepEqual(f.calls,['snapshot','prepare']);}finally{await f.cleanup();}});
test('unsettled final intent requires attention even if transport returned',async()=>{const f=await fixture();try{let reads=0;f.deps.audit=async()=>({locks:[],checkpoints:[],intents:reads++?[{id:'preserved'}]:[]});const r=await runSyncRound(f.options,f.deps);assert.equal(r.status,'attention');}finally{await f.cleanup();}});
test('identical failure stays quiet and recovery becomes one meaningful change',async()=>{const f=await fixture();try{f.deps.execute=async()=>{throw Error('SUBSTACK_RATE_LIMITED');};assert.equal((await runSyncRound(f.options,f.deps)).notification,'meaningful');assert.equal((await runSyncRound(f.options,f.deps)).notification,'quiet');f.deps.execute=async()=>({status:'verified'});assert.equal((await runSyncRound(f.options,f.deps)).notification,'meaningful');assert.equal((await runSyncRound(f.options,f.deps)).notification,'quiet');}finally{await f.cleanup();}});
test('different source revisions of the same updated article each produce a meaningful completion',async()=>{const f=await fixture();try{let revision=0;f.deps.plan=async(source)=>({inventory:{entries:[]},articles:[{slug:'article',sourceRevision:'r'+(++revision),run:{sourceRoot:source,configFile:'scope',commands:[{target:'substack',operation:'prepare'}],recoveries:[]}}]} as never);assert.equal((await runSyncRound(f.options,f.deps)).notification,'meaningful');assert.equal((await runSyncRound(f.options,f.deps)).notification,'meaningful');}finally{await f.cleanup();}});

test('manual-held article remains skipped across restarted rounds and repeated result stays quiet',async()=>{
 const {planTarget}=await import('./distribution-inventory');const f=await fixture();
 const held={postSlug:'article',target:'substack' as const,status:'manual_required' as const,sourceRevision:'r1',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/article',lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS',updatedAt:'now'};
 const original=JSON.stringify(held);
 try{
  f.deps.plan=async()=>({inventory:{entries:[]},articles:[{slug:'article',sourceRevision:'r1',targets:{substack:planTarget('r1',held,undefined,false,true)}}]} as never);
  const first=await runSyncRound(f.options,f.deps),second=await runSyncRound(f.options,f.deps);
  assert.deepEqual(f.calls,['snapshot','snapshot']);assert.equal(JSON.stringify(held),original);
  assert.equal(first.results[0].code,'DISTRIBUTION_MANUAL_REQUIRED');assert.equal(first.notification,'meaningful');assert.equal(second.notification,'quiet');
  assert.equal(second.status,'attention');assert.equal(second.cleanup.source,'removed');
 }finally{await f.cleanup();}
});

test('Hermes receives held results even when repeated round fingerprint is quiet',async()=>{
 const f=await fixture();const notices:unknown[]=[];
 try{
  f.deps.plan=async()=>({inventory:{entries:[]},articles:[{slug:'article',sourceRevision:'r1',targets:{substack:{operations:[],reason:'DISTRIBUTION_MANUAL_REQUIRED'}}}]} as never);
  f.deps.notify=async result=>{notices.push(result);return {status:'queued'};};
  await runSyncRound(f.options,f.deps);const second=await runSyncRound(f.options,f.deps);
  assert.equal(second.notification,'quiet');assert.equal(notices.length,2);assert.equal(second.hermes?.status,'queued');
  assert.deepEqual(f.calls,['snapshot','snapshot']);
 }finally{await f.cleanup();}
});
test('notification queue failure is visible without leaving the sync lock or source snapshot',async()=>{
 const f=await fixture();try{
  f.deps.notify=async()=>{throw Error('private-path-or-secret');};
  const result=await runSyncRound(f.options,f.deps);
  assert.equal(result.status,'attention');assert.equal(result.hermes?.status,'failed');
  assert.equal(result.hermes?.code,'HERMES_ATTENTION_QUEUE_UNAVAILABLE');
  assert.equal(result.cleanup.source,'removed');await assert.rejects(fs.access(f.options.lock));
 }finally{await f.cleanup();}
});

test('production scheduler validation rejects old receipts before any network access',async()=>{
 const {productionDependencies}=await import('./sync-distribution');const f=await fixture();
 const db={prepare:()=>{throw Error('NETWORK_FORBIDDEN');}} as never;
 try{
  await fs.writeFile(f.options.configFile,JSON.stringify({unattended:{enabled:true,scope:'all-formal-markdown',repository:'gcake119/gcake-dev',branch:'main',policy:'pages-first-no-newsletter',targets:['substack']},substack:{ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror'}}}));
  // The old factory requires syntactically valid credentials even for local validation.
  const saved={...process.env};Object.assign(process.env,{CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),DISTRIBUTION_D1_DATABASE_ID:'a'.repeat(36),CLOUDFLARE_API_TOKEN:'fixture-only'});
  try{
   const deps=productionDependencies(f.runtime,db);
   await fs.writeFile(f.options.acceptanceFile,JSON.stringify({status:'passed',transport:'profile',profileVerified:true,readOnlyRound:'completed',inFlight:0,providerStates:[{target:'substack',status:'verified'}]}));
   await assert.rejects(deps.validate(f.options.configFile,f.options.acceptanceFile),/ANONYMOUS_ACCEPTANCE/);
  }finally{for(const key of ['CLOUDFLARE_ACCOUNT_ID','DISTRIBUTION_D1_DATABASE_ID','CLOUDFLARE_API_TOKEN'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
 }finally{await f.cleanup();}
});

test('production notification includes inventory-omitted D1 holds and failed reads cannot clear the feed',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {D1PublicationRepository}=await import('../../apps/admin-worker/src/publication-operations');const {productionDependencies}=await import('./sync-distribution');
 const f=await fixture();const database=new DatabaseSync(':memory:');let closed=false;
 try{
  database.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql',import.meta.url),'utf8'));
  const db=new SqliteD1Database(database),repo=new D1PublicationRepository(db),file=path.join(f.root,'attention.json');
  const state={postSlug:'deleted-source',target:'substack' as const,sourceRevision:'r1',status:'manual_required' as const,lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS',updatedAt:'now'};
  await repo.putState(state);await fs.writeFile(f.options.configFile,JSON.stringify({unattended:{notifyViaHermes:true}}));
  const deps=productionDependencies(f.runtime,db,file),round={status:'completed',results:[]};
  assert.equal((await deps.notify!(round,f.options.configFile)).status,'queued');
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[{slug:'deleted-source',code:'DISTRIBUTION_MANUAL_REQUIRED'}]);
  await repo.putState({...state,status:'verified'});await deps.notify!(round,f.options.configFile);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[]);
  await repo.putState(state);await deps.notify!(round,f.options.configFile);const before=await fs.readFile(file,'utf8');
  database.close();closed=true;await assert.rejects(deps.notify!(round,f.options.configFile));assert.equal(await fs.readFile(file,'utf8'),before);
 }finally{if(!closed)database.close();await f.cleanup();}
});
