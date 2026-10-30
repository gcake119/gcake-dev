import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import {SqliteD1Database} from './sqlite-d1';
import {D1DistributionRuntime} from '../../apps/admin-worker/src/distribution-runtime';
import {ScheduleRepository} from '../../apps/admin-worker/src/substack-schedules';
import {DraftSyncCoordinator,type DraftSyncPolicy} from './substack-draft-sync';
import {contentFingerprint,expectedContent,type ScheduleObservation} from './substack-schedule';
import type {ScheduledSource} from './scheduled-source';
import type {DraftExchangeRequest} from './substack-draft-computer-use';

async function qualificationFixture(policy='single-draft-read-qualification-v1'){
 const f=await fixture();await f.core.sync('trial');
 const path=await import('node:path'),os=await import('node:os'),crypto=await import('node:crypto');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-qualification-test-'));
 const pin=path.join(root,'pin.json'),config=path.join(root,'config.json');await fs.writeFile(pin,'{}');
 const q={schema:1,enabled:true,policyVersion:policy,expectedBaselineDigest:policy==='single-draft-write-qualification-v1'?contentFingerprint(expectedContent(source())):undefined,slug:'trial',remoteId:'123',sourceRevision:source().sourceRevision,expiresAt:'2026-10-20T00:00:00Z',directory:path.join(root,'evidence'),executor:process.execPath,browserName:'chrome',timeoutMs:60000,authorizationRef:path.join(root,'authorization.json')};
 const m=await import('./substack-draft-qualification');
 await fs.writeFile(q.authorizationRef,JSON.stringify({schema:1,approved:true,policyVersion:q.policyVersion,scopeDigest:m.qualificationScopeDigest(q,crypto.createHash('sha256').update('{}').digest('hex')),expiresAt:q.expiresAt}));
 await fs.writeFile(config,JSON.stringify({draftQualification:q}));let executions=0;
 const deps={now:()=>now,verifyPin:async()=>{},readSource:async()=>source(),assertMain:async()=>{},execute:async(file:string,_q:{directory:string},evidence:string)=>{executions++;const r=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(r.request.action,policy==='single-draft-write-qualification-v1'?'draft-update':'draft-read');if(policy==='single-draft-write-qualification-v1'){assert.equal((await f.repo.bySlug('trial'))?.intent?.id,r.request.intentId);assert.equal(r.request.precondition.digest,q.expectedBaselineDigest);}assert.equal(r.remoteId,'123');await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post,...(policy==='single-draft-write-qualification-v1'?{before:f.post,writeEvidence:{fullBodyPasted:true,savedBeforeReload:true,navigatedAway:true,reloaded:true}}:{})}));await fs.writeFile(_q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');}};
 return {f,root,pin,config,q,deps,m,get executions(){return executions;},cleanup:async()=>{f.db.close();await fs.rm(root,{recursive:true,force:true});}};
}
test('scoped write qualification persists intent, performs actual save and verifies once',async()=>{const t=await qualificationFixture('single-draft-write-qualification-v1');try{
 const before=(await t.f.repo.bySlug('trial'))!;await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps);
 const after=(await t.f.repo.bySlug('trial'))!;assert.equal(after.intent,undefined);assert.equal(after.remoteId,before.remoteId);assert.equal(after.delivery,before.delivery);assert.equal(after.draftSync?.status,'verified');
 const r=JSON.parse(await fs.readFile(t.q.directory+'/result.json','utf8'));assert.equal(r.providerMutations,1);assert.equal(r.writeVerified,true);
 assert.deepEqual(await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),[]);assert.equal(t.executions,1);
}finally{await t.cleanup();}});
for(const failure of ['process','missing-save','before-conflict'])test('scoped write '+failure+' preserves unknown original intent without replay',async()=>{const t=await qualificationFixture('single-draft-write-qualification-v1');try{
 const execute=t.deps.execute;t.deps.execute=async(file,q,evidence)=>{if(failure==='process')throw Error('SUBSTACK_EXECUTOR_FAILED');await execute(file,q,evidence);const v=JSON.parse(await fs.readFile(evidence,'utf8'));if(failure==='missing-save')delete v.writeEvidence;else v.before={...v.before,content:{...v.before.content,title:'Human edit'}};await fs.writeFile(evidence,JSON.stringify(v));};
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),failure==='process'?/EXECUTOR_FAILED/:failure==='missing-save'?/WRITE_EVIDENCE_INVALID/:/REMOTE_EDIT_CONFLICT/);
 const state=(await t.f.repo.bySlug('trial'))!;assert.equal(state.intent?.action,'update-draft');assert.equal(state.draftSync?.status,'reconciliation-required');
 assert.equal(JSON.parse(await fs.readFile(t.q.directory+'/result.json','utf8')).providerMutations,null);
 assert.deepEqual(await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),[]);
}finally{await t.cleanup();}});
for(const invalid of ['baseline','scheduled'])test('scoped write rejects '+invalid+' before dispatch',async()=>{const t=await qualificationFixture('single-draft-write-qualification-v1');try{
 if(invalid==='scheduled'){const state=(await t.f.repo.bySlug('trial'))!;await t.f.repo.save({...state,observedState:'scheduled',delivery:'armed'},state.version);}else {t.q.expectedBaselineDigest='sha256:wrong';await fs.writeFile(t.config,JSON.stringify({draftQualification:t.q}));const crypto=await import('node:crypto');await fs.writeFile(t.q.authorizationRef,JSON.stringify({schema:1,approved:true,policyVersion:t.q.policyVersion,scopeDigest:t.m.qualificationScopeDigest(t.q,crypto.createHash('sha256').update('{}').digest('hex')),expiresAt:t.q.expiresAt}));}
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),/QUALIFICATION_SCOPE/);assert.equal(t.executions,0);assert.equal((await t.f.repo.bySlug('trial'))!.intent,undefined);
}finally{await t.cleanup();}});
test('one scoped natural qualification consumes once, verifies full read and preserves delivery',async()=>{const t=await qualificationFixture();try{
 const before=(await t.f.repo.bySlug('trial'))!;
 const r=await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps);
 assert.equal(r[0].status,'observed');assert.equal(t.executions,1);
 const after=(await t.f.repo.bySlug('trial'))!;assert.equal(after.remoteId,before.remoteId);assert.equal(after.delivery,before.delivery);assert.equal(after.intent,undefined);
 assert.deepEqual(await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),[]);assert.equal(t.executions,1);
 t.deps.now=()=> '2026-10-21T00:00:00Z';assert.deepEqual(await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),[]);assert.equal(t.executions,1);
 const result=JSON.parse(await fs.readFile(t.q.directory+'/result.json','utf8'));assert.equal(result.passed,true);assert.equal(result.providerMutations,0);
}finally{await t.cleanup();}});
test('qualification refuses numeric browser identities before executor access',async()=>{const t=await qualificationFixture();try{
 const crypto=await import('node:crypto');const q={...t.q,browserName:'2'};await fs.writeFile(t.config,JSON.stringify({draftQualification:q}));await fs.writeFile(q.authorizationRef,JSON.stringify({schema:1,approved:true,policyVersion:q.policyVersion,scopeDigest:t.m.qualificationScopeDigest(q,crypto.createHash('sha256').update('{}').digest('hex')),expiresAt:q.expiresAt}));
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),/QUALIFICATION_SCOPE/);assert.equal(t.executions,0);
}finally{await t.cleanup();}});
test('qualification refuses actual Brave execution despite a Chrome selection',async()=>{const t=await qualificationFixture();try{
 const execute=t.deps.execute;t.deps.execute=async(file,q,evidence)=>{await execute(file,q,evidence);await fs.writeFile(t.q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'brave'}}}}})+'\n');};
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),/EXECUTOR_BROWSER_MISMATCH/);
 assert.equal(JSON.parse(await fs.readFile(t.q.directory+'/result.json','utf8')).passed,false);
}finally{await t.cleanup();}});
test('qualification rejects protected identity and invalid grants before executor access',async()=>{const t=await qualificationFixture();try{
 let s=(await t.f.repo.bySlug('trial'))!;s=await t.f.repo.save({...s,observedState:'scheduled',delivery:'armed',observedTime:'2026-10-21T23:00:00Z',armedRevision:'keep'},s.version);
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),/QUALIFICATION_SCOPE/);assert.equal(t.executions,0);assert.equal((await t.f.repo.bySlug('trial'))!.armedRevision,'keep');
 await fs.writeFile(t.config,JSON.stringify({draftQualification:{...t.q,remoteId:'124'}}));await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),/QUALIFICATION_SCOPE/);assert.equal(t.executions,0);
}finally{await t.cleanup();}});
test('production occurrence routes explicit qualification to its read-only scope validator',async()=>{
 const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'qualification-hook-'));
 try{const config=path.join(root,'scope.json');await fs.writeFile(config,JSON.stringify({scheduled:{policyVersion:'scheduled-source-first-delivery-v1'},draftQualification:{enabled:true}}));
 const {productionDependencies}=await import('./sync-distribution');const db={prepare:()=>{throw Error('NO_DB_ACCESS');}} as never;
 await assert.rejects(productionDependencies(root,db,undefined,'pin').syncDrafts!(root,config),/QUALIFICATION_SCOPE/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
for(const failure of ['process','content'])test('qualification '+failure+' failure retains evidence and never retries',async()=>{const t=await qualificationFixture();try{
 t.deps.execute=async(_file:string,_q:unknown,evidence:string)=>{if(failure==='process')throw Error('SUBSTACK_EXECUTOR_FAILED');await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,observation:{...t.f.post,content:{...t.f.post.content,title:'Other'}}}));await fs.writeFile(t.q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');};
 await assert.rejects(t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),failure==='process'?/EXECUTOR_FAILED/:/CONTENT_EVIDENCE_MISMATCH/);
 assert.equal(JSON.parse(await fs.readFile(t.q.directory+'/result.json','utf8')).passed,false);
 assert.deepEqual(await t.m.runDraftQualification(t.root+'/source',new SqliteD1Database(t.f.db),t.config,t.pin,t.deps),[]);assert.equal((await t.f.repo.bySlug('trial'))!.intent,undefined);
}finally{await t.cleanup();}});
const now='2026-10-19T01:00:00Z';
const source=(v='a'):ScheduledSource=>({slug:'trial',sourcePath:'src/content/posts/trial.md',sourceCommit:v.repeat(40),sourceRevision:v.repeat(64),article:{slug:'trial',sourceRevision:v.repeat(64),title:'Title '+v,description:'Summary '+v,body:'## Body\n\n'+v+'\n\n```ts\n  const x = 1;\n```',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/trial/',assets:[]}});
async function fixture(){
 const db=new DatabaseSync(':memory:');for(const f of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+f,import.meta.url),'utf8'));
 const d1=new SqliteD1Database(db),repo=new ScheduleRepository(d1),runtime=new D1DistributionRuntime(d1);
 let current:ScheduledSource|undefined=source(),post:ScheduleObservation|undefined;
 const calls:string[]=[];let fail='',onRead:(()=>void)|undefined;
 const policy:DraftSyncPolicy={allowCreate:true,policyVersion:'unattended-draft-sync-v1',transport:'computer-use',enabled:true,writeEnabled:true,origin:'https://gcakedev.substack.com',repository:'gcake119/gcake-dev',branch:'main',expiresAt:'2026-10-20T00:00:00Z',qualificationRef:'qualified-fixture',authorizationRef:'fixture-scope',sessionExclusive:true};
 const provider={find:async()=>{calls.push('find');return {complete:true,scanned:['draft','scheduled','published'],items:post?[structuredClone(post)]:[]};},read:async(id:string)=>{calls.push('read');onRead?.();assert.equal(id,post?.id);if(fail==='read')throw Error('offline');return structuredClone(post!);},create:async(s:ScheduledSource)=>{calls.push('create');post={id:'123',slug:s.slug,state:'draft',saved:true,listEvidence:{draft:true,scheduled:false},content:expectedContent(s)};if(fail==='create')throw Error('lost');return '123';},update:async(id:string,s:ScheduledSource)=>{calls.push('update');assert.equal(post?.id,id);post!.content=expectedContent(s);if(fail==='update')throw Error('lost');}};
 const core=new DraftSyncCoordinator(repo,runtime,provider,{readPolicy:async()=>policy,readSource:async()=>current,now:()=>now});
 return {db,repo,runtime,policy,calls,core,setSource:(s:ScheduledSource|undefined)=>current=s,get post(){return post!;},setPost:(p:ScheduleObservation)=>post=p,setFail:(x:string)=>fail=x,setOnRead:(f:()=>void)=>onRead=f};
}
test('draft core creates full unpublished source and edits same ID; equal rounds read but never write',async()=>{const f=await fixture();try{
 let r=await f.core.sync('trial');assert.equal(r.remoteId,'123');assert.equal(r.draftSync?.status,'verified');assert.equal(r.delivery,'not_armed');assert.deepEqual(f.post.content,expectedContent(source()));
 const n=f.calls.length;await f.core.sync('trial');assert.deepEqual(f.calls.slice(n),['read']);
 f.setSource(source('b'));r=await f.core.sync('trial');assert.equal(r.remoteId,'123');assert.deepEqual(f.post.content,expectedContent(source('b')));assert.equal(f.calls.filter(x=>x==='create').length,1);assert.equal(f.calls.filter(x=>x==='update').length,1);
}finally{f.db.close();}});
test('disabled or unqualified worker never accesses provider',async()=>{const f=await fixture();try{f.policy.enabled=false;await assert.rejects(f.core.sync('trial'),/DRAFT_SYNC_DISABLED/);assert.deepEqual(f.calls,[]);f.policy.enabled=true;f.policy.qualificationRef='';await assert.rejects(f.core.sync('trial'),/DRAFT_SYNC_UNQUALIFIED/);assert.deepEqual(f.calls,[]);}finally{f.db.close();}});
test('human-only edit is preserved as conflict; incomplete read does not claim drift',async()=>{const f=await fixture();try{await f.core.sync('trial');f.post.content.title='Human';let r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'conflict');assert.equal(f.post.content.title,'Human');assert.equal(f.calls.includes('update'),false);f.setFail('read');r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'inconclusive');assert.equal(r.draftSync?.savedRevision,source().sourceRevision);}finally{f.db.close();}});
for(const op of ['create','update'])test('lost '+op+' acknowledgement retains intent and restart does not replay',async()=>{const f=await fixture();try{if(op==='update'){await f.core.sync('trial');f.setSource(source('b'));}f.setFail(op);let r=await f.core.sync('trial');assert.ok(r.intent);const n=f.calls.length;f.setFail('');r=await f.core.sync('trial');assert.equal(f.calls.slice(n).filter(x=>x==='create'||x==='update').length,0);if(op==='create')assert.ok(r.intent);else assert.equal(r.intent,undefined);}finally{f.db.close();}});
for(const state of ['scheduled','published','sending'] as const)test(state+' provider state cannot be edited or cancelled',async()=>{const f=await fixture();try{await f.core.sync('trial');f.post.state=state;if(state==='scheduled')Object.assign(f.post,{scheduledAt:'2026-10-21T23:00:00Z',timeZone:'Asia/Taipei',email:true,appInbox:true,audience:'everyone'});f.setSource(source('b'));const r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'foreground-required');assert.equal(f.calls.includes('update'),false);}finally{f.db.close();}});
test('local schedule commitment is preserved without even authenticated reads',async()=>{const f=await fixture();try{await f.core.sync('trial');let s=(await f.repo.bySlug('trial'))!;s=await f.repo.save({...s,observedState:'scheduled',observedTime:'2026-10-21T23:00:00Z',delivery:'armed',emailEnabled:true,appInboxEnabled:true,armedRevision:'original'},s.version);const n=f.calls.length;f.setSource(source('b'));const r=await f.core.sync('trial');assert.equal(f.calls.length,n);assert.equal(r.observedTime,s.observedTime);assert.equal(r.armedRevision,'original');assert.equal(r.delivery,'armed');}finally{f.db.close();}});
test('source removal, rename and another writer cannot create replacements',async()=>{const f=await fixture();try{await f.core.sync('trial');f.setSource(undefined);let r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'foreground-required');f.setSource({...source(),slug:'renamed',article:{...source().article,slug:'renamed'}});await assert.rejects(f.core.sync('renamed'),/RENAME/);assert.equal(f.calls.filter(x=>x==='create').length,1);f.setSource(source());await f.runtime.acquire('trial','substack','other',now);await assert.rejects(f.core.sync('trial'),/LOCKED/);}finally{f.db.close();}});
test('source B to C invalidates stale edit; post-save incomplete read retains uncertain intent',async()=>{const f=await fixture();try{await f.core.sync('trial');f.setSource(source('b'));f.setOnRead(()=>f.setSource(source('c')));let r=await f.core.sync('trial');assert.equal(r.draftSync?.code,'SUBSTACK_SOURCE_CHANGED');assert.equal(f.calls.includes('update'),false);f.setOnRead(()=>{});f.setSource(source('b'));f.setFail('update');r=await f.core.sync('trial');assert.ok(r.intent);}finally{f.db.close();}});
test('wrong occupied slug and partial discovery stop creation',async()=>{const f=await fixture();try{f.setPost({id:'777',slug:'trial',state:'draft',saved:true,content:expectedContent(source('b')),listEvidence:{draft:true,scheduled:false}});const r=await f.core.sync('trial');assert.equal(r.remoteId,'777');assert.equal(r.draftSync?.status,'conflict');assert.equal(f.calls.includes('create'),false);}finally{f.db.close();}});

test('Computer Use port sends only draft actions and requires full reloaded evidence',async()=>{
 const {ComputerUseDraftPort}=await import('./substack-draft-computer-use');const f=await fixture();try{
 await f.core.sync('trial');const s=source('b');let request:any;
 const port=new ComputerUseDraftPort(s,f.repo,async r=>{request=r;return {sessionExclusive:true,reloaded:true,observation:{...f.post,content:expectedContent(s)},before:{...f.post}};},async()=>{});
 const {contentFingerprint}=await import('./substack-schedule');
 await assert.rejects(port.update('123',s,{digest:contentFingerprint(f.post.content),state:'draft'}),/INTENT/);
 let state=(await f.repo.bySlug('trial'))!;state=await f.repo.save({...state,intent:{id:'edit',action:'update-draft',sourceRevision:s.sourceRevision,expectedDigest:contentFingerprint(expectedContent(s)),createdAt:now}},state.version);
 await port.update('123',s,{digest:contentFingerprint(f.post.content),state:'draft'});assert.equal(request.action,'draft-update');assert.equal(request.draftOnly,true);assert.deepEqual(request.forbiddenActions,['arm','remove','publish','send']);assert.equal(request.exchangeVersion,2);
 const bad=new ComputerUseDraftPort(s,f.repo,async()=>({observation:f.post}),async()=>{});await assert.rejects(bad.read('123'),/EVIDENCE/);
}finally{f.db.close();}});

test('ordinary sync occurrence invokes optional draft phase before anonymous observer without a second timer',async()=>{
 const {runDraftSyncRound}=await import('./substack-draft-round');
 const f=await fixture();const path=await import('node:path');const os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-round-'));try{
 await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\nstatus: ready\n---\nComplete body');
 const config=path.join(root,'policy.json');await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:2,timeoutMs:1000,sessionDirectory:'/private/tmp/fixture-not-used'}}));
 const rows=await runDraftSyncRound(root,new SqliteD1Database(f.db),config,{assertMain:async()=>{},verifyActivation:async()=>{},readSource:async()=>source(),provider:()=>({find:async()=>({complete:true,scanned:['draft','published','scheduled'],items:[]}),read:async()=>({id:'987',slug:'trial',state:'draft',saved:true,listEvidence:{draft:true,scheduled:false},content:expectedContent(source())}),create:async()=> '987',update:async()=>{throw Error('unexpected');}}),now:()=>now});
 assert.equal(rows[0].status,'observed');assert.equal((await f.repo.bySlug('trial'))?.remoteId,'987');
 await fs.writeFile(config,JSON.stringify({draftSync:{enabled:false}}));assert.deepEqual(await runDraftSyncRound(root,new SqliteD1Database(f.db),config),[]);
}finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}});

test('independent identity holds block edits and successful foreground correction becomes the baseline',async()=>{const f=await fixture();try{
 await f.core.sync('trial');let s=(await f.repo.bySlug('trial'))!;await f.repo.save({...s,lastErrorCode:'SUBSTACK_REMOTE_IDENTITY_MISMATCH'},s.version);f.setSource(source('b'));let r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'foreground-required');assert.equal(f.calls.includes('update'),false);
 s=(await f.repo.bySlug('trial'))!;const {contentFingerprint}=await import('./substack-schedule');f.post.content=expectedContent(source('b'));await f.repo.save({...s,lastErrorCode:undefined,contentDigest:contentFingerprint(f.post.content),contentVerifiedRevision:source('b').sourceRevision},s.version);f.setSource(source('c'));r=await f.core.sync('trial');assert.equal(r.draftSync?.status,'verified');assert.deepEqual(f.post.content,expectedContent(source('c')));
}finally{f.db.close();}});

test('draft activation requires actual scoped receipts, not nonempty reference strings',async()=>{
 const {validateDraftActivation}=await import('./substack-draft-activation');const f=await fixture();try{
 await assert.rejects(validateDraftActivation(f.policy,'pin',now,{read:async()=>({}),verifyPin:async()=>{}}),/ACTIVATION/);
 const {draftPolicyDigest}=await import('./substack-draft-activation');const scope=draftPolicyDigest(f.policy);
 const receipts={schema:1,policyVersion:'unattended-draft-sync-v1',scopeDigest:scope,pinDigest:'abc',expiresAt:'2026-10-20T00:00:00Z',approved:true,passed:true,fullReadback:true,exactSlug:true,sameId:true,unattendedExecutor:true,sessionExclusive:true,draftOnly:true};
 await validateDraftActivation(f.policy,'pin',now,{read:async file=>file==='pin'?'pinned runtime':receipts,verifyPin:async()=>{},pinDigest:()=> 'abc'});
 await assert.rejects(validateDraftActivation({...f.policy,authorizationRef:'different'},'pin',now,{read:async()=>({...receipts,approved:false}),verifyPin:async()=>{},pinDigest:()=> 'abc'}),/ACTIVATION/);
}finally{f.db.close();}});

test('partial discovery, rewritten slug, missing media proof and revoked grant never verify or repeat writes',async()=>{
 for(const mode of ['partial','slug','media','revoke'] as const){const f=await fixture();try{
 let creates=0;const provider={find:async()=>({complete:mode!=='partial',scanned:['draft','published','scheduled'],items:[]}),create:async()=>{creates++;return '555';},read:async()=>({id:'555',slug:mode==='slug'?'trial-2':'trial',state:'draft' as const,saved:true,listEvidence:{draft:true,scheduled:false},content:mode==='media'?{title:'Title a',description:'Summary a',html:'<p><img src="https://images.example/missing.png" alt="required"></p>'}:expectedContent(source())}),update:async()=>{throw Error('unexpected');}};
 const core=new DraftSyncCoordinator(f.repo,f.runtime,provider,{readPolicy:async()=>f.policy,readSource:async()=>source(),now:()=>now});
 if(mode==='revoke'){f.policy.expiresAt=now;await assert.rejects(core.sync('trial'),/UNQUALIFIED/);assert.equal(creates,0);}
 else {const r=await core.sync('trial');assert.notEqual(r.draftSync?.status,'verified');const n=creates;await core.sync('trial');assert.equal(creates,n);}
 }finally{f.db.close();}}
});
test('Computer Use envelope rejects stale generation, missing update precondition and forged schedule action',async()=>{
 const {validateDraftHandoff}=await import('./substack-draft-computer-use');const {createHash}=await import('node:crypto');const f=await fixture();try{
 await f.core.sync('trial');const state=(await f.repo.bySlug('trial'))!,s=source();
 const request:any={exchangeVersion:2,action:'draft-read',operation:'sync-draft',draftOnly:true,draftPolicyVersion:'unattended-draft-sync-v1',forbiddenActions:['arm','remove','publish','send'],article:s.article,sourceCommit:s.sourceCommit,recordVersion:state.version,scheduleId:state.scheduleId,remote:{id:state.remoteId,url:'https://gcakedev.substack.com/publish/post/'+state.remoteId}};
 const envelope=(r:any)=>({version:2 as const,requestId:'fixture',scopeDigest:createHash('sha256').update(JSON.stringify(r)).digest('hex'),expiresAt:Date.now()+60000,slug:s.slug,sourceRevision:s.sourceRevision,remoteId:state.remoteId!,action:r.action,operation:r.operation,request:r});
 validateDraftHandoff(envelope(request),state,s);
 assert.throws(()=>validateDraftHandoff(envelope({...request,recordVersion:state.version-1}),state,s),/MISMATCH/);
 assert.throws(()=>validateDraftHandoff(envelope({...request,remote:{id:state.remoteId,url:'https://other.example/private'}}),state,s),/IDENTITY/);
 assert.throws(()=>validateDraftHandoff(envelope({...request,action:'schedule-arm'}),state,s),/MISMATCH/);
}finally{f.db.close();}});

test('invalid new sources do not starve later eligible originals under the same bounded timer',async()=>{
 const {runDraftSyncRound}=await import('./substack-draft-round');const path=await import('node:path');const os=await import('node:os');const f=await fixture();const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-fair-'));try{
 await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});for(const slug of ['a','b','c'])await fs.writeFile(path.join(root,'src/content/posts/'+slug+'.md'),'---\nstatus: ready\n---\nBody');
 const config=path.join(root,'policy.json');await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:1000}}));let tick=0,created='';
 const src=(slug:string)=>({...source(),slug,sourcePath:'src/content/posts/'+slug+'.md',article:{...source().article,slug}});
 for(let i=0;i<3;i++)await runDraftSyncRound(root,new SqliteD1Database(f.db),config,{assertMain:async()=>{},verifyActivation:async()=>{},now:()=>new Date(Date.parse(now)+tick++*1000).toISOString(),readSource:async(_root,slug)=>{if(slug!=='c')throw Error('SUBSTACK_SOURCE_MEDIA_UNAVAILABLE');return src(slug);},provider:s=>({find:async()=>({complete:true,scanned:['draft','published','scheduled'],items:[]}),create:async()=>{created=s.slug;return '321';},read:async()=>({id:'321',slug:s.slug,state:'draft',saved:true,listEvidence:{draft:true,scheduled:false},content:expectedContent(s)}),update:async()=>{throw Error('unexpected');}})});
 assert.equal(created,'c');
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

test('real private FileAttendedExchange carries create/read/update/reload through draft reply validation',async()=>{
 const path=await import('node:path');const os=await import('node:os');const {FileAttendedExchange}=await import('./substack-attended');const {ComputerUseDraftPort,draftHandoff}=await import('./substack-draft-computer-use');const f=await fixture();const dir=await fs.mkdtemp(path.join(os.tmpdir(),'draft-cu-handoff-'));try{
 const root=path.join(dir,'source');await fs.mkdir(root);const config=path.join(dir,'config.json');await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,expiresAt:'2100-01-01T00:00:00Z'}}));let desired=source(),post:ScheduleObservation|undefined;const actions:string[]=[];
 const exchange=await FileAttendedExchange.create<any>(path.join(dir,'draft-sessions'),root,2000,1,async file=>{
  const e=JSON.parse(await fs.readFile(file,'utf8')),r=e.request;actions.push(r.action);let evidence:any={sessionExclusive:true,reloaded:true};
  if(r.action==='draft-find')Object.assign(evidence,{complete:true,scanned:['draft','scheduled','published'],items:post?[post]:[]});
  else {const before=post?structuredClone(post):undefined;if(r.action==='draft-create')post={id:'456',slug:r.article.slug,state:'draft',saved:true,listEvidence:{draft:true,scheduled:false},content:expectedContent(desired)};if(r.action==='draft-update')post!.content=expectedContent(desired);Object.assign(evidence,{observation:post,before});}
  const evidenceFile=path.join(path.dirname(file),'evidence.json');await fs.writeFile(evidenceFile,JSON.stringify(evidence));
  await draftHandoff('reply-draft',new Map([['--config',config],['--source-root',root],['--request',file],['--evidence',evidenceFile]]),{database:new SqliteD1Database(f.db),readSource:async()=>desired,assertMain:async()=>{},verifyActivation:async()=>{}});
 });
 const run=()=>new DraftSyncCoordinator(f.repo,f.runtime,new ComputerUseDraftPort(desired,f.repo,exchange.exchange,async()=>{}),{readSource:async()=>desired,readPolicy:async()=>f.policy,now:()=>now}).sync('trial');
 let state=await run();assert.equal(state.remoteId,'456');assert.equal(state.draftSync?.status,'verified');desired=source('b');state=await run();assert.equal(state.draftSync?.status,'verified');assert.deepEqual(post!.content,expectedContent(desired));assert.equal(actions.filter(x=>x==='draft-create').length,1);assert.equal(actions.filter(x=>x==='draft-update').length,1);assert.ok(actions.every(x=>x.startsWith('draft-')));
 }finally{f.db.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('ordinary draft worker rechecks live main after a saved UI result before claiming current synchronization',async()=>{
 const {runDraftSyncRound}=await import('./substack-draft-round');const path=await import('node:path');const os=await import('node:os');const f=await fixture();const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-main-race-'));try{
 await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\nstatus: ready\n---\nBody');const config=path.join(root,'policy.json');await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:1000}}));let remoteChanged=false;
 const rows=await runDraftSyncRound(root,new SqliteD1Database(f.db),config,{verifyActivation:async()=>{},now:()=>now,readSource:async()=>source(),assertMain:async()=>{if(remoteChanged)throw Error('SUBSTACK_SOURCE_CHANGED');},provider:()=>({find:async()=>({complete:true,scanned:['draft','scheduled','published'],items:[]}),create:async()=>{remoteChanged=true;return '654';},read:async()=>({id:'654',slug:'trial',state:'draft',saved:true,listEvidence:{draft:true,scheduled:false},content:expectedContent(source())}),update:async()=>{throw Error('unexpected');}})});
 assert.notEqual(rows[0].status,'observed');assert.equal((await f.repo.bySlug('trial'))?.remoteId,'654');
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

for(const failure of [false,true])test('ordinary unattended executor '+(failure?'retains failed write intent':'updates original and equal round is read-only'),async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'ordinary-executor-'));
 try{
  await fs.mkdir(path.join(root,'source/src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'source/src/content/posts/trial.md'),'---\nstatus: ready\n---\nComplete');
  const config=path.join(root,'policy.json');await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:2,timeoutMs:5000,maxRoundMs:30000,executor:process.execPath,browserName:'chrome',evidenceDirectory:path.join(root,'evidence')}}));
  const actions:string[]=[];const execute=async(file:string,q:{directory:string},evidence:string)=>{
   const r=JSON.parse(await fs.readFile(file,'utf8')).request;actions.push(r.action);let before;await fixtureLists(q.directory);
   if(r.action==='draft-update'){assert.equal((await f.repo.bySlug('trial'))?.intent?.id,r.intentId);assert.equal(r.precondition.digest,contentFingerprint(f.post.content));before=structuredClone(f.post);if(failure)throw Error('SUBSTACK_EXECUTOR_FAILED');await fixtureBeforeVerdict(file,q.directory,before,true);f.post.content=expectedContent(source('b'));}
   await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post,...(before?{before,writeEvidence:{fullBodyPasted:true,savedBeforeReload:true,navigatedAway:true,reloaded:true}}:{})}));
   await fs.writeFile(q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');
  };
  const {runDraftSyncRound}=await import('./substack-draft-round');
  const deps={assertMain:async()=>{},verifyActivation:async()=>{},readSource:async()=>source('b'),now:()=>now,execute};
  const rows=await runDraftSyncRound(root+'/source',new SqliteD1Database(f.db),config,deps);
  const state=(await f.repo.bySlug('trial'))!;assert.equal(state.remoteId,'123');assert.equal(state.delivery,'not_armed');
  if(failure){assert.equal(rows[0].status,'manual_required');assert.equal(state.intent?.action,'update-draft');assert.equal(state.draftSync?.status,'reconciliation-required');}
  else {assert.equal(rows[0].status,'observed',JSON.stringify({rows,code:state.draftSync?.code,actions}));assert.deepEqual(actions,['draft-read','draft-read','draft-update','draft-read']);assert.equal(state.intent,undefined);assert.deepEqual(f.post.content,expectedContent(source('b')));const count=actions.length;await runDraftSyncRound(root+'/source',new SqliteD1Database(f.db),config,deps);assert.deepEqual(actions.slice(count),['draft-read']);assert.ok((await fs.readdir(root+'/evidence')).length>=5);}
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

test('creation disabled holds missing identity without provider access or intent but updates existing original',async()=>{const f=await fixture();try{
 f.policy.allowCreate=false;let s=await f.core.sync('trial');assert.deepEqual(f.calls,[]);assert.equal(s.intent,undefined);assert.equal(s.draftSync?.code,'SUBSTACK_DRAFT_CREATION_DISABLED');
 f.policy.allowCreate=true;s=await f.core.sync('trial');assert.equal(s.remoteId,'123');f.policy.allowCreate=false;f.setSource(source('b'));s=await f.core.sync('trial');assert.equal(s.remoteId,'123');assert.equal(s.draftSync?.status,'verified');assert.equal(f.calls.filter(c=>c==='create').length,1);assert.equal(f.calls.filter(c=>c==='update').length,1);
}finally{f.db.close();}});

for(const protectedState of ['scheduled','verified'] as const)test('unchanged '+protectedState+' is excluded quietly but source drift requires foreground',async()=>{const f=await fixture();try{
 await f.core.sync('trial');const old=(await f.repo.bySlug('trial'))!;await f.repo.save({...old,observedState:protectedState,...(protectedState==='scheduled'?{delivery:'armed',desiredState:'scheduled',observedTime:'2026-10-21T23:00:00Z',armedRevision:source().sourceRevision}:{everPublished:true})},old.version);
 const count=f.calls.length;let result=await f.core.sync('trial');assert.equal(result.draftSync?.status,'excluded');assert.equal(result.draftSync?.code,undefined);assert.equal(result.observedState,protectedState);assert.deepEqual(f.calls.slice(count),[]);
 f.setSource(source('b'));result=await f.core.sync('trial');assert.equal(result.draftSync?.status,'foreground-required');assert.deepEqual(f.calls.slice(count),[]);assert.equal(result.remoteId,'123');
}finally{f.db.close();}});

test('draft media verifies original bytes while preserving alt, order, code and source links',async()=>{
 const {readImageDigest,expectedDraftContent,normalizeDraftObservation}=await import('./substack-draft-media');
 const png=await fs.readFile(new URL('../../public/brand/gcake-dev-logo-96.png',import.meta.url));
 const original='https://source.example/image.png',hosted='https://substack-post-media.s3.amazonaws.com/public/images/test_96x96.png',rendered='https://substackcdn.com/image/fetch/w_1456/'+encodeURIComponent(hosted);
 const fetcher=(async()=>new Response(Uint8Array.from(png),{headers:{'content-type':'image/png'}})) as typeof fetch;
 const media=await readImageDigest(original,fetcher);const s={...source(),media:[media],article:{...source().article,body:source().article.body+'\n\n![required alt]('+original+')\n\n[required link](https://source.example/reference)'}};
 const expected=expectedContent(s),html=expected.html.replace(/<p>\s*<img[^>]+>\s*<\/p>/,`<div class="captioned-image-container"><figure><div class="image2"><picture><img src="${rendered}" alt="required alt" data-attrs='{ "src":"${hosted}" }'></picture></div></figure></div>`);
 const observation={id:'123',slug:'trial',state:'draft' as const,saved:true,listEvidence:{draft:true,scheduled:false},content:{...expected,html},images:[{src:rendered,alt:'required alt',loaded:true}]};
 const good=await normalizeDraftObservation(observation,fetcher,[original]);assert.equal(contentFingerprint(good.observation.content),contentFingerprint(expectedDraftContent(s)));assert.equal(good.images[0].sha256,media.sha256);assert.ok(observation.content.html.includes(rendered),'raw UI evidence must stay unchanged');
 for(const variant of ['binary','alt','link','code']){
  const changed=structuredClone(observation);let fetchImage=fetcher;
  if(variant==='binary')fetchImage=(async()=>new Response(Uint8Array.from(Buffer.concat([png,Buffer.from('changed')])),{headers:{'content-type':'image/png'}})) as typeof fetch;
  if(variant==='alt'){changed.content.html=changed.content.html.replace('alt="required alt"','alt="lost"');changed.images[0].alt='lost';}
  if(variant==='link')changed.content.html=changed.content.html.replace('https://source.example/reference','https://source.example/wrong');
  if(variant==='code')changed.content.html=changed.content.html.replace('const x = 1','const x = 2');
  const result=await normalizeDraftObservation(changed,fetchImage,[original]);assert.notEqual(contentFingerprint(result.observation.content),contentFingerprint(expectedDraftContent(s)),variant);
 }
 const second={...media,src:'https://source.example/second.png',sha256:'f'.repeat(64)};const two={...s,media:[media,second],article:{...s.article,body:s.article.body+'\n\n![required alt]('+second.src+')'}};
 const canonical=expectedDraftContent(two);const reversed=canonical.html.replace(media.sha256,'TEMP').replace(second.sha256,media.sha256).replace('TEMP',second.sha256);assert.notEqual(contentFingerprint({...canonical,html:reversed}),contentFingerprint(canonical));
 await assert.rejects(normalizeDraftObservation({...observation,images:[{...observation.images[0],loaded:false}]},fetcher,[original]),/CONTENT_EVIDENCE_INVALID/);
 assert.throws(()=>expectedDraftContent({...s,article:{...s.article,body:'[![required alt]('+original+')](https://source.example/reference)'}}),/UNSUPPORTED_CONTENT/);
 assert.throws(()=>expectedDraftContent({...s,media:[{...media,format:'other',contentType:'image/jpeg'}]}),/UNSUPPORTED_CONTENT/);
 assert.throws(()=>expectedDraftContent({...s,article:{...s.article,body:Array(9).fill('![alt]('+original+')').join('\n\n')}}),/UNSUPPORTED_CONTENT/);
 await assert.rejects(readImageDigest(original,(async()=>new Response(new Uint8Array(8*1024*1024+1),{headers:{'content-type':'image/png'}})) as typeof fetch),/MEDIA_UNAVAILABLE/);
});

test('ordinary controller rejects claimed write without parent before verdict',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const base=await fs.mkdtemp(path.join(os.tmpdir(),'before-verdict-'));
 try{
  let state=(await f.repo.bySlug('trial'))!;state=await f.repo.save({...state,intent:{id:'owned-update',policyVersion:state.policyVersion,action:'update-draft',sourceRevision:source('b').sourceRevision,expectedDigest:contentFingerprint(expectedContent(source('b'))),createdAt:now}},state.version);
  const {FileAttendedExchange}=await import('./substack-attended'),{replyWithDraftExecutor}=await import('./substack-draft-executor');
  const r={exchangeVersion:2 as const,action:'draft-update' as const,operation:'sync-draft' as const,draftOnly:true as const,draftPolicyVersion:'unattended-draft-sync-v1' as const,forbiddenActions:['arm','remove','publish','send'] as ['arm','remove','publish','send'],article:source('b').article,sourceCommit:source('b').sourceCommit,recordVersion:state.version,scheduleId:state.scheduleId,intentId:state.intent!.id,remote:{id:'123',url:'https://gcakedev.substack.com/publish/post/123'},precondition:{state:'draft' as const,digest:contentFingerprint(f.post.content)}};
  const e=await FileAttendedExchange.create<DraftExchangeRequest>(base+'/requests',base+'/source',1000,10,async file=>replyWithDraftExecutor(file,{policy:{...f.policy,executor:process.execPath,browserName:'chrome',evidenceDirectory:base+'/evidence'},source:source('b'),timeoutMs:1000,check:async()=>state,execute:async(_file,q,evidence)=>{
   await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,before:f.post,observation:{...f.post,content:expectedContent(source('b'))},writeEvidence:{fullBodyPasted:true,savedBeforeReload:true,navigatedAway:true,reloaded:true}}));await fs.writeFile(q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');
  }}));
  await assert.rejects(e.exchange(r),/BEFORE_VERDICT_REQUIRED/);assert.equal((await f.repo.bySlug('trial'))?.intent?.id,'owned-update');
 }finally{f.db.close();await fs.rm(base,{recursive:true,force:true});}
});

async function fixtureLists(directory:string){await fs.writeFile(directory+'/list-evidence.json',JSON.stringify({schemaVersion:1,lists:[{state:'draft',label:'草稿 1',selected:true,loading:false,nextEnabled:false,rows:[{href:'/publish/post/123',text:'Original'}]},{state:'scheduled',label:'已排程 0',selected:true,loading:false,nextEnabled:false,rows:[]},{state:'published',label:'已發佈 1',selected:true,loading:false,nextEnabled:false,rows:[{href:'/publish/posts/detail/456',text:'Published'}]}]}));}
async function fixtureBeforeVerdict(_file:string,directory:string,observation:ScheduleObservation,fragmentReady=false){
 await fixtureLists(directory);
 await fs.writeFile(directory+'/before.json',JSON.stringify({sessionExclusive:true,reloaded:true,observation}));
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const imports=['--import',import.meta.resolve('tsx')];
 if(fragmentReady){
  const injector=directory+'/fragment-writes.mjs';await fs.writeFile(injector,`import fs from 'node:fs/promises';const write=fs.writeFile.bind(fs);fs.writeFile=async(file,data,options)=>{if(String(file).endsWith('/before-ready.json')){const handle=await fs.open(file,'wx',0o600);try{const body=String(data),middle=Math.floor(body.length/2);await handle.write(body.slice(0,middle));await new Promise(r=>setTimeout(r,180));await handle.write(body.slice(middle));}finally{await handle.close();}return;}return write(file,data,options);};`);imports.push('--import',injector);
 }
 const result=await promisify(execFile)(process.execPath,[...imports,directory+'/verify-before.mts'],{timeout:5000});assert.match(result.stdout,/SUBSTACK_BEFORE_VERIFIED/);
}

test('parent source revocation rejects before verdict and permits no fixture edit',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const base=await fs.mkdtemp(path.join(os.tmpdir(),'before-verdict-'));
 try{
  let state=(await f.repo.bySlug('trial'))!;state=await f.repo.save({...state,intent:{id:'owned-update',policyVersion:state.policyVersion,action:'update-draft',sourceRevision:source('b').sourceRevision,expectedDigest:contentFingerprint(expectedContent(source('b'))),createdAt:now}},state.version);
  const {FileAttendedExchange}=await import('./substack-attended'),{replyWithDraftExecutor}=await import('./substack-draft-executor');
  const r={exchangeVersion:2 as const,action:'draft-update' as const,operation:'sync-draft' as const,draftOnly:true as const,draftPolicyVersion:'unattended-draft-sync-v1' as const,forbiddenActions:['arm','remove','publish','send'] as ['arm','remove','publish','send'],article:source('b').article,sourceCommit:source('b').sourceCommit,recordVersion:state.version,scheduleId:state.scheduleId,intentId:state.intent!.id,remote:{id:'123',url:'https://gcakedev.substack.com/publish/post/123'},precondition:{state:'draft' as const,digest:contentFingerprint(f.post.content)}};
  let checks=0,rejected=false;const e=await FileAttendedExchange.create<DraftExchangeRequest>(base+'/requests',base+'/source',1000,10,async file=>replyWithDraftExecutor(file,{policy:{...f.policy,executor:process.execPath,browserName:'chrome',evidenceDirectory:base+'/evidence'},source:source('b'),timeoutMs:1000,check:async()=>{if(++checks>1)throw Error('SUBSTACK_SOURCE_CHANGED');return state;},execute:async(_file,q,_evidence)=>{
   const envelope=JSON.parse(await fs.readFile(_file,'utf8')),crypto=await import('node:crypto'),raw=JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post});await fs.writeFile(q.directory+'/before.json',raw);await fs.writeFile(q.directory+'/before-ready.json',JSON.stringify({requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash:crypto.createHash('sha256').update(raw).digest('hex')}));
   const end=Date.now()+1000;while(Date.now()<end){try{const verdict=JSON.parse(await fs.readFile(q.directory+'/before-verdict.json','utf8'));assert.equal(verdict.ok,false);assert.equal(verdict.code,'SUBSTACK_SOURCE_CHANGED');rejected=true;return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,10));}throw Error('No rejection verdict');
  }}));
  await assert.rejects(e.exchange(r),/SOURCE_CHANGED/);assert.equal((await f.repo.bySlug('trial'))?.intent?.id,'owned-update');assert.equal(rejected,true);assert.deepEqual(f.post.content,expectedContent(source()));
 }finally{f.db.close();await fs.rm(base,{recursive:true,force:true});}
});

test('media capability activation cannot reuse a text-only receipt',async()=>{const f=await fixture();try{
 const {validateDraftActivation,draftPolicyDigest}=await import('./substack-draft-activation');const {DRAFT_MEDIA_PROFILE}=await import('./substack-draft-media');const policy:DraftSyncPolicy={...f.policy,mediaProfile:DRAFT_MEDIA_PROFILE};
 const receipt={schema:1,policyVersion:policy.policyVersion,scopeDigest:draftPolicyDigest(policy),pinDigest:'abc',expiresAt:policy.expiresAt,approved:true,passed:true,fullReadback:true,exactSlug:true,sameId:true,unattendedExecutor:true,sessionExclusive:true,draftOnly:true};
 const deps={read:async(file:string)=>file==='pin'?'pinned runtime':receipt,verifyPin:async()=>{},pinDigest:()=> 'abc'};
 await assert.rejects(validateDraftActivation(policy,'pin',now,deps),/ACTIVATION_REQUIRED/);
 await validateDraftActivation(policy,'pin',now,{...deps,read:async(file:string)=>file==='pin'?'pinned runtime':{...receipt,mediaProfile:DRAFT_MEDIA_PROFILE,mediaQualified:true}});
}finally{f.db.close();}});


test('ordinary dispatch rejects a valid replacement policy instead of launching the old executor',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-policy-replaced-'));
 try{
  await fs.mkdir(root+'/source/src/content/posts',{recursive:true});await fs.writeFile(root+'/source/src/content/posts/trial.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';const initial={...f.policy,maxArticles:1,timeoutMs:1000,executor:process.execPath,browserName:'chrome',evidenceDirectory:root+'/old-evidence'};
  await fs.writeFile(config,JSON.stringify({draftSync:initial}));let dispatched=0,replaced=false;
  const {runDraftSyncRound}=await import('./substack-draft-round');
  const rows=await runDraftSyncRound(root+'/source',new SqliteD1Database(f.db),config,{now:()=>now,verifyActivation:async()=>{},assertMain:async()=>{},readSource:async()=>{if(!replaced){replaced=true;await fs.writeFile(config,JSON.stringify({draftSync:{...initial,evidenceDirectory:root+'/new-evidence',timeoutMs:500}}));}return source('b');},execute:async()=>{dispatched++;throw Error('Unexpected stale executor');}});
  assert.equal(dispatched,0);assert.notEqual(rows[0].status,'observed');assert.equal((await f.repo.bySlug('trial'))?.intent,undefined);
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

test('rename holds rotate fairly to the missing original without allowing replacement creation',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-rename-fairness-'));
 try{
  await fs.mkdir(root+'/src/content/posts',{recursive:true});for(const slug of ['a','z'])await fs.writeFile(root+'/src/content/posts/'+slug+'.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:1000}}));let tick=0;const visited:string[]=[];const before=f.calls.length;
  const {runDraftSyncRound}=await import('./substack-draft-round');
  for(let round=0;round<5;round++){
   const rows=await runDraftSyncRound(root,new SqliteD1Database(f.db),config,{now:()=>new Date(Date.parse(now)+1000*(++tick)).toISOString(),verifyActivation:async()=>{},assertMain:async()=>{},readSource:async(_root,slug)=>{if(slug==='trial')throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');return {...source(),slug,sourcePath:'src/content/posts/'+slug+'.md',article:{...source().article,slug}};},provider:()=>({find:async()=>{throw Error('Must not discover replacements');},read:async()=>{throw Error('Must not access provider');},create:async()=>{throw Error('Must not create');},update:async()=>{throw Error('Must not update');}})});
   visited.push(rows[0].slug);
  }
  assert.ok(visited.includes('trial'),JSON.stringify(visited));assert.equal((await f.repo.bySlug('trial'))?.draftSync?.status,'foreground-required');
  assert.equal((await f.repo.bySlug('a'))?.lastErrorCode,'SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');assert.equal((await f.repo.bySlug('z'))?.lastErrorCode,'SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
  assert.deepEqual(f.calls.slice(before),[]);
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

for(const stalledHandler of [false,true])test('executor ignoring SIGTERM is bounded and its owned process group is stopped; stalled handler '+stalledHandler,async(t)=>{
 const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-executor-timeout-'));let pid:number|undefined;let execution:Promise<unknown>|undefined;
 try{
  // Exercise process-group signals without making interpreter startup part of the fixture.
  // Keep both a returning handler and one that never finishes inside the grace period.
  // All operations are shell builtins; TERM is recorded but deliberately does not exit.
  const executable=root+'/ignore-term.sh';await fs.writeFile(executable,[
   '#!/bin/sh','fixture_dir=${0%/*}',`trap 'printf yes > "$fixture_dir/term-seen"; ${stalledHandler?"while :; do :; done":":"}' TERM`,
   `printf '%s' "$$" > "$fixture_dir/pid"`,'while :; do :; done','',
  ].join('\n'),{mode:0o700});
  const {executeComputerUse}=await import('./substack-draft-qualification');
  execution=executeComputerUse('fixture only',{executor:executable,directory:root,timeoutMs:1500}).then(()=> 'resolved',e=>e.message);
  const result=await Promise.race([execution,new Promise<string>(r=>setTimeout(()=>r('still-running'),4500))]);
  pid=Number(await fs.readFile(root+'/pid','utf8'));assert.equal(await fs.readFile(root+'/term-seen','utf8'),'yes');
  assert.equal(result,'SUBSTACK_EXECUTOR_TIMEOUT');const reapDeadline=Date.now()+1000;while(Date.now()<reapDeadline){try{process.kill(pid!,0);}catch(e){if((e as NodeJS.ErrnoException).code==='ESRCH')break;throw e;}await new Promise(r=>setTimeout(r,10));}assert.throws(()=>process.kill(pid!,0),{code:'ESRCH'});
 }catch(error){
  for(const name of ['executor-events.jsonl','executor-stderr.log'])try{t.diagnostic(name+': '+await fs.readFile(root+'/'+name,'utf8'));}catch{}
  throw error;
 }finally{
  if(!pid)try{pid=Number(await fs.readFile(root+'/pid','utf8'));}catch{}
  if(pid)try{process.kill(-pid,'SIGKILL');}catch{}await execution;await fs.rm(root,{recursive:true,force:true});
 }
});


for(const stage of ['source','main','media'] as const)test('round deadline bounds slow '+stage+' checks before any provider dispatch',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-source-deadline-'));let running:Promise<unknown>|undefined;
 try{
  await fs.mkdir(root+'/src/content/posts',{recursive:true});await fs.writeFile(root+'/src/content/posts/trial.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:100,maxRoundMs:120}}));
  let calls=0,cancelled=false,mainCalls=0;const before=await f.repo.bySlug('trial');
  const {runDraftSyncRound}=await import('./substack-draft-round');
  const fetcher=(async(_input,options)=>new Promise<Response>((resolve,reject)=>{const signal=options?.signal;const late=setTimeout(()=>resolve(new Response()),1500);signal?.addEventListener('abort',()=>{cancelled=true;clearTimeout(late);reject(signal.reason);},{once:true});})) as typeof fetch;
  running=runDraftSyncRound(root,new SqliteD1Database(f.db),config,{now:()=>now,verifyActivation:async()=>{},fetcher,
   readSource:async(_root,_slug,readFetch)=>{if(stage==='source')await new Promise(r=>setTimeout(r,1500));if(stage==='media')await (readFetch??fetcher)('https://source.example/slow.png',{signal:AbortSignal.timeout(30000)});return source();},
   assertMain:async()=>{mainCalls++;if(stage==='main')await new Promise(r=>setTimeout(r,1500));},
   provider:()=>({find:async()=>{calls++;throw Error('unexpected provider');},read:async()=>{calls++;return f.post;},create:async()=>{calls++;return '123';},update:async()=>{calls++;}})});
  const result=await Promise.race([running,new Promise<string>(r=>setTimeout(()=>r('still-running'),800))]);
  assert.notEqual(result,'still-running');const rows=result as {code?:string;status:string}[];assert.equal(rows[0].code,'SUBSTACK_DRAFT_BUDGET_EXHAUSTED');assert.notEqual(rows[0].status,'observed');assert.equal(calls,0);
  if(stage==='media')assert.equal(cancelled,true);if(stage==='source')assert.equal(mainCalls,0);
  assert.equal((await f.repo.bySlug('trial'))?.intent,before?.intent);
 }finally{await running;f.db.close();await fs.rm(root,{recursive:true,force:true});}
});


test('round deadline cancels post-executor media verification and retains the unknown update',async(t)=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-result-media-deadline-'));let running:Promise<unknown>|undefined;let watchdog:ReturnType<typeof setTimeout>|undefined;
 try{
  const png=await fs.readFile(new URL('../../public/brand/gcake-dev-logo-96.png',import.meta.url));const image='https://source.example/qualified.png';
  const {readImageDigest}=await import('./substack-draft-media');const m=await readImageDigest(image,(async()=>new Response(Uint8Array.from(png),{headers:{'content-type':'image/png'}})) as typeof fetch);
  const desired={...source('b'),media:[m],article:{...source('b').article,body:source('b').article.body+'\n\n![required alt]('+image+')'}};
  let cancelled=false,mediaReads=0;const actions:string[]=[];
  const fetcher=(async(_input,options)=>new Promise<Response>((resolve,reject)=>{mediaReads++;const timer=setTimeout(()=>resolve(new Response(Uint8Array.from(png),{headers:{'content-type':'image/png'}})),6000);options?.signal?.addEventListener('abort',()=>{cancelled=true;clearTimeout(timer);reject(options.signal!.reason);},{once:true});})) as typeof fetch;
  t.mock.method(globalThis,'fetch',fetcher);
  await fs.mkdir(root+'/source/src/content/posts',{recursive:true});await fs.writeFile(root+'/source/src/content/posts/trial.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:2500,maxRoundMs:3000,executor:process.execPath,browserName:'chrome',evidenceDirectory:root+'/evidence',mediaProfile:'original-sha256-png-v1'}}));
  const {runDraftSyncRound}=await import('./substack-draft-round');
  running=runDraftSyncRound(root+'/source',new SqliteD1Database(f.db),config,{now:()=>now,verifyActivation:async()=>{},assertMain:async()=>{},readSource:async()=>desired,fetcher,execute:async(file,q,evidence)=>{
   const r=JSON.parse(await fs.readFile(file,'utf8')).request;actions.push(r.action);let before;await fixtureLists(q.directory);
   if(r.action==='draft-update'){before=structuredClone(f.post);await fixtureBeforeVerdict(file,q.directory,before);f.post.content=expectedContent(desired);f.post.images=[{src:image,alt:'required alt',loaded:true}];}
   await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post,...(before?{before,writeEvidence:{fullBodyPasted:true,savedBeforeReload:true,navigatedAway:true,reloaded:true}}:{})}));
   await fs.writeFile(q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');
  }});
  const result=await Promise.race([running,new Promise<string>(resolve=>{watchdog=setTimeout(()=>resolve('still-running'),4500);})]);
  assert.notEqual(result,'still-running');assert.equal(mediaReads,1);assert.equal(cancelled,true);
  const state=(await f.repo.bySlug('trial'))!;assert.equal(state.remoteId,'123');assert.equal(state.intent?.action,'update-draft');assert.equal(state.draftSync?.status,'reconciliation-required');assert.equal(state.contentVerifiedRevision,source().sourceRevision);
  assert.deepEqual(actions,['draft-read','draft-read','draft-update']);
 }finally{clearTimeout(watchdog);await running;f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

test('complete UI list verifier counts both actual published-detail and draft-editor links without fixed inventory totals',async()=>{
 const {verifyDraftLists}=await import('./substack-draft-lists');const proof={schemaVersion:1,lists:[{state:'draft',label:'草稿 1',selected:true,loading:false,nextEnabled:false,rows:[{href:'/publish/post/123?back=x',text:'Original'}]},{state:'scheduled',label:'已排程 1',selected:true,loading:false,nextEnabled:false,rows:[{href:'/publish/post/789?back=x',text:'Protected'}]},{state:'published',label:'已發佈 2',selected:true,loading:false,nextEnabled:false,rows:[{href:'/publish/posts/detail/456?referrer=x',text:'Published'},{href:'https://gcakedev.substack.com/publish/posts/detail/999',text:'Other'}]}]};const result=verifyDraftLists(proof,'123');assert.deepEqual(result.counts,{draft:1,scheduled:1,published:2});assert.deepEqual(result.ids.published,['456','999']);
 for(const change of [(p:any)=>p.lists[2].rows.pop(),(p:any)=>p.lists[0].loading=true,(p:any)=>p.lists[2].nextEnabled=true,(p:any)=>p.lists[2].rows[1].href='/publish/posts/detail/456',(p:any)=>p.lists[2].rows[0].href='https://other.example/publish/post/456',(p:any)=>p.lists[0].rows[0].href='/publish/post/789']){const bad=structuredClone(proof);change(bad);assert.throws(()=>verifyDraftLists(bad,'123'),/SUBSTACK_DRAFT_LIST_|SUBSTACK_DRAFT_IDENTITY_/);}
});

for(const stage of ['read','update'] as const)test('parent independently rejects incomplete '+stage+' lists despite claimed child success',async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-parent-lists-'));const actions:string[]=[];let denied=false,edits=0;
 try{
  await fs.mkdir(root+'/source/src/content/posts',{recursive:true});await fs.writeFile(root+'/source/src/content/posts/trial.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:5000,maxRoundMs:30000,executor:process.execPath,browserName:'chrome',evidenceDirectory:root+'/evidence'}}));
  const desired=stage==='update'?source('b'):source();const {runDraftSyncRound}=await import('./substack-draft-round');
  const rows=await runDraftSyncRound(root+'/source',new SqliteD1Database(f.db),config,{now:()=>now,verifyActivation:async()=>{},assertMain:async()=>{},readSource:async()=>desired,execute:async(file,q,evidence)=>{
   const request=JSON.parse(await fs.readFile(file,'utf8')).request;actions.push(request.action);await fixtureLists(q.directory);
   await fs.writeFile(q.directory+'/executor-events.jsonl',JSON.stringify({type:'item.completed',item:{type:'mcp_tool_call',result:{_meta:{'codex/toolSurface':{browserFamily:'chrome'}}}}})+'\n');
   if(stage==='read'||request.action==='draft-update'){
    const lists=JSON.parse(await fs.readFile(q.directory+'/list-evidence.json','utf8'));lists.lists[2].rows=[];await fs.writeFile(q.directory+'/list-evidence.json',JSON.stringify(lists));
    await fs.writeFile(q.directory+'/list-verdict.json',JSON.stringify({complete:true}));
   }
   if(request.action==='draft-update'){
    await fs.writeFile(q.directory+'/before.json',JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post}));
    const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
    await assert.rejects(promisify(execFile)(process.execPath,['--import',import.meta.resolve('tsx'),q.directory+'/verify-before.mts'],{timeout:5000}),/SUBSTACK_DRAFT_LIST_INCOMPLETE/);
    const verdict=JSON.parse(await fs.readFile(q.directory+'/before-verdict.json','utf8'));assert.equal(verdict.ok,false);assert.equal(verdict.code,'SUBSTACK_DRAFT_LIST_INCOMPLETE');denied=true;return;
   }
   if(request.action!=='draft-read')edits++;
   await fs.writeFile(evidence,JSON.stringify({sessionExclusive:true,reloaded:true,observation:f.post}));
  }});
  const state=(await f.repo.bySlug('trial'))!;assert.notEqual(rows[0].status,'observed');assert.equal(edits,0);assert.deepEqual(f.post.content,expectedContent(source()));assert.equal(state.remoteId,'123');assert.equal(state.delivery,'not_armed');assert.equal(state.draftSync?.baselineDigest,contentFingerprint(expectedContent(source())));
  if(stage==='read'){assert.deepEqual(actions,['draft-read']);assert.equal(state.draftSync?.status,'inconclusive');assert.equal(state.draftSync?.code,'SUBSTACK_DRAFT_LIST_INCOMPLETE');assert.equal(state.intent,undefined);}
  else {assert.deepEqual(actions,['draft-read','draft-read','draft-update']);assert.equal(denied,true);assert.equal(state.intent?.action,'update-draft');assert.equal(state.draftSync?.status,'reconciliation-required');}
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});

for(const action of ['draft-find','draft-create'] as const)for(const allowCreate of [false,true])test('ordinary existing-ID executor rejects '+action+' with allowCreate='+allowCreate,async()=>{
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-existing-id-only-'));let dispatched=0;
 try{
  const old=(await f.repo.bySlug('trial'))!;const state=await f.repo.save({...old,remoteId:undefined,remoteUrl:undefined,editUrl:undefined,intent:action==='draft-create'?{id:'unqualified-create',action:'create',sourceRevision:source().sourceRevision,expectedDigest:contentFingerprint(expectedContent(source())),createdAt:now}:undefined},old.version);
  const {FileAttendedExchange}=await import('./substack-attended'),{ComputerUseDraftPort}=await import('./substack-draft-computer-use'),{replyWithDraftExecutor}=await import('./substack-draft-executor');
  const exchange=await FileAttendedExchange.create<DraftExchangeRequest>(root+'/requests',root+'/source',1000,10,async file=>replyWithDraftExecutor(file,{policy:{...f.policy,allowCreate,executor:process.execPath,browserName:'chrome',evidenceDirectory:root+'/evidence'},source:source(),timeoutMs:1000,check:async()=>state,execute:async()=>{dispatched++;throw Error('UNQUALIFIED_DISPATCH');}}));
  const port=new ComputerUseDraftPort(source(),f.repo,exchange.exchange,async()=>{});
  await assert.rejects(action==='draft-find'?port.find(source()):port.create(source()),/SUBSTACK_DRAFT_CREATION_DISABLED/);assert.equal(dispatched,0);const after=(await f.repo.bySlug('trial'))!;assert.equal(after.remoteId,undefined);assert.deepEqual(after.intent,state.intent);
 }finally{f.db.close();await fs.rm(root,{recursive:true,force:true});}
});
for(const action of ['draft-find','draft-create'] as const)test('direct executor rejects unqualified '+action+' before any process',async()=>{
 const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-direct-disabled-'));
 try{
  const request=root+'/request.json';await fs.writeFile(request,JSON.stringify({request:{action,article:source().article}}));const executable=root+'/sentinel.cjs';await fs.writeFile(executable,'#!'+process.execPath+'\n'+`require('node:fs').writeFileSync(${JSON.stringify(root+'/spawned')},'yes');`,{mode:0o700});
  const {executeDraftRequest}=await import('./substack-draft-executor');await assert.rejects(executeDraftRequest(request,{directory:root,executor:executable,timeoutMs:1000},root+'/observation.json'),/SUBSTACK_DRAFT_CREATION_DISABLED/);await assert.rejects(fs.access(root+'/spawned'),{code:'ENOENT'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});


for (const owner of ['round', 'caller'] as const) test('media abort classification retains '+owner+' deadline ownership with an early wall clock', async(t) => {
 const f=await fixture();await f.core.sync('trial');const path=await import('node:path'),os=await import('node:os');const root=await fs.mkdtemp(path.join(os.tmpdir(),'draft-deadline-owner-'));let running:Promise<unknown>|undefined;
 try {
  await fs.mkdir(root+'/src/content/posts',{recursive:true});await fs.writeFile(root+'/src/content/posts/trial.md','---\nstatus: ready\n---\nBody');
  const config=root+'/policy.json';await fs.writeFile(config,JSON.stringify({draftSync:{...f.policy,maxArticles:1,timeoutMs:100,maxRoundMs:120}}));
  const round=new AbortController(),caller=new AbortController();const nativeTimeout=AbortSignal.timeout.bind(AbortSignal);let wall=Date.now();const start=wall;
  t.mock.method(Date,'now',()=>wall);
  t.mock.method(AbortSignal,'timeout',(milliseconds:number)=>milliseconds<=120?round.signal:milliseconds===30000?caller.signal:nativeTimeout(milliseconds));
  let providerCalls=0,cancelled=false;const before=await f.repo.bySlug('trial');
  const fetcher=(async(_input,options)=>new Promise<Response>((_resolve,reject)=>{
   options?.signal?.addEventListener('abort',()=>{cancelled=true;reject(options.signal!.reason);},{once:true});
   queueMicrotask(()=>{wall=start+(owner==='round'?119:1);(owner==='round'?round:caller).abort(new DOMException('controlled timeout','TimeoutError'));});
  })) as typeof fetch;
  const {runDraftSyncRound}=await import('./substack-draft-round');
  running=runDraftSyncRound(root,new SqliteD1Database(f.db),config,{now:()=>now,verifyActivation:async()=>{},fetcher,
   readSource:async(_root,_slug,readFetch)=>{await (readFetch??fetcher)('https://source.example/slow.png',{signal:AbortSignal.timeout(30000)});return source();},assertMain:async()=>{},
   provider:()=>({find:async()=>{providerCalls++;throw Error('unexpected provider');},read:async()=>{providerCalls++;return f.post;},create:async()=>{providerCalls++;return '123';},update:async()=>{providerCalls++;}})});
  const rows=await running as {code?:string;status:string}[];
  assert.equal(rows[0].code,owner==='round'?'SUBSTACK_DRAFT_BUDGET_EXHAUSTED':'SUBSTACK_DRAFT_READ_INCONCLUSIVE');
  assert.notEqual(rows[0].status,'observed');assert.equal(cancelled,true);assert.equal(providerCalls,0);assert.equal((await f.repo.bySlug('trial'))?.intent,before?.intent);
 } finally {await running;f.db.close();await fs.rm(root,{recursive:true,force:true});}
});
