import test from 'node:test';
import assert from 'node:assert/strict';
import {createCmsSession,InMemorySessionStore} from './auth';
import {createPhase1Handler} from './router';
import {draftStatusView,type DraftStatusStore} from './substack-draft-api';
import type {ScheduleRecord} from './substack-schedules';
const record:ScheduleRecord={policyVersion:'scheduled-source-first-delivery-v1',scheduleId:'substack:trial',slug:'trial',remoteId:'123',version:2,observedState:'scheduled',observedTime:'2026-10-21T23:00:00Z',delivery:'unknown',intent:{id:'private-intent',action:'update-draft',createdAt:'now'},draftSync:{status:'reconciliation-required',code:'SUBSTACK_DRAFT_OUTCOME_UNKNOWN',desiredRevision:'new',savedRevision:'old',checkedAt:'now',transport:'computer-use'},updatedAt:'now'};
async function fixture(store?:DraftStatusStore){const sessions=new InMemorySessionStore();await createCmsSession({githubUserId:'119',login:'owner'},sessions,{now:()=>1000,randomToken:()=> 'session',randomCsrfToken:()=> 'csrf'});const handle=createPhase1Handler({oauth:{authorizationUrl:()=>'',exchangeCode:async()=>'',fetchIdentity:async()=>({githubUserId:'119',login:'owner'})},sessions,allowedGitHubUserIds:new Set(['119']),oauthStateSecret:'secret',now:()=>1001,drafts:store??{get:async slug=>slug==='trial'?record:undefined,list:async()=>[record]}});return (path='',method='GET',login=true)=>handle(new Request('https://admin.test/api/v1/substack/drafts'+path,{method,headers:login?{cookie:'gcake_session=session'}:{}}));}
test('authenticated frontend sees independent draft, publication and delivery evidence without private payloads',async()=>{const request=await fixture();const r=await request('/trial');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const {draft}=await r.json() as any;assert.equal(draft.providerId,'123');assert.equal(draft.sync.status,'reconciliation-required');assert.equal(draft.publication.state,'scheduled');assert.equal(draft.delivery.evidence,'unknown');assert.deepEqual(draft.actions,['foreground-reconcile']);assert.ok(!JSON.stringify(draft).includes('private-intent'));assert.deepEqual(draft,draftStatusView(record));});
test('status routes authenticate, reject writes, bound pagination and distinguish missing/unavailable',async()=>{const request=await fixture();assert.equal((await request('', 'GET',false)).status,401);assert.equal((await request('/trial','POST')).status,405);assert.equal((await request('/missing')).status,404);assert.equal((await request('?limit=0')).status,400);assert.equal((await request('?limit=1&offset=0')).status,200);const failed=await fixture({get:async()=>{throw Error('private error');},list:async()=>{throw Error('private error');}});const r=await failed('/trial');assert.equal(r.status,503);assert.ok(!(await r.text()).includes('private error'));});
test('status projection never calls unknown or stale draft verified current',()=>{const r=draftStatusView({...record,intent:undefined,observedState:'draft_prepared',draftSync:{...record.draftSync!,status:'verified',desiredRevision:'new',savedRevision:'old'}});assert.equal(r.sync.status,'pending');assert.notEqual(r.delivery.evidence,'received');});

test('D1 status reader pages actual durable records and reports missing identity without mutation',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');try{
 db.exec('CREATE TABLE publication_schedules(schedule_id TEXT PRIMARY KEY,post_slug TEXT UNIQUE,record_json TEXT)');
 for(const slug of ['a','b','c'])db.prepare('INSERT INTO publication_schedules VALUES (?,?,?)').run(slug,slug,JSON.stringify({...record,slug,scheduleId:slug}));
 const {D1DraftStatusStore}=await import('./substack-draft-api');
 const store=new D1DraftStatusStore({prepare(sql:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},async first<T>(){return db.prepare(sql).get(...args as any[]) as T??null;},async run(){throw Error('read-only');}};}});
 assert.deepEqual((await store.list(1,1)).map(r=>r.slug),['b']);assert.equal((await store.get('c'))?.slug,'c');assert.equal(await store.get('missing'),undefined);
 }finally{db.close();}
});

test('page hasMore is based on an additional row; unknown creation never claims a saved provider draft',async()=>{
 const request=await fixture({get:async()=>({...record,remoteId:undefined}),list:async limit=>[record,{...record,slug:'second'}].slice(0,limit)});
 const first=await request('?limit=1');const page=await first.json() as any;assert.equal(page.drafts.length,1);assert.equal(page.page.hasMore,true);
 const last=await request('?limit=2');assert.equal((await last.json() as any).page.hasMore,false);
 assert.equal((await (await request('/trial')).json() as any).draft.publication.state,'not-observed');
});

test('independent publication holds remain visible even when the last draft save verified',()=>{
 const view=draftStatusView({...record,intent:undefined,observedState:'draft_prepared',lastErrorCode:'SUBSTACK_REMOTE_IDENTITY_MISMATCH',pendingAction:'reconcile-schedule',draftSync:{...record.draftSync!,status:'verified',desiredRevision:'same',savedRevision:'same'}});
 assert.equal(view.attention.code,'SUBSTACK_REMOTE_IDENTITY_MISMATCH');assert.equal(view.attention.pendingAction,'reconcile-schedule');assert.deepEqual(view.actions,['foreground-review']);
});


test('checkpoint reconciliation without an intent exposes an unresolved operation and foreground route',async()=>{
 const row={...record,intent:undefined,observedState:'draft_prepared' as const,draftSync:{...record.draftSync!,status:'reconciliation-required' as const}};
 const request=await fixture({get:async()=>row,list:async()=>[row]});
 for(const route of ['/trial','']){
  const response=await request(route);const body=await response.json() as any;const view=route?body.draft:body.drafts[0];
  assert.equal(view.sync.status,'reconciliation-required');assert.equal(view.sync.unresolvedOperation,true);assert.deepEqual(view.actions,['foreground-reconcile']);
 }
});
