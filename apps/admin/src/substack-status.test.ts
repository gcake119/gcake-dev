import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatusReader, statusPresentation, type DraftStatus } from './substack-status';
const original:DraftStatus={schemaVersion:1,slug:'original',providerId:'221099415',version:1,sync:{status:'verified',checkedAt:'2026-10-19T16:05:00Z',unresolvedOperation:false,code:null},publication:{state:'scheduled',confirmedTime:'2026-10-21T23:00:00Z'},delivery:{evidence:'armed',subscriberReceipt:'unknown'},attention:{pendingAction:null,code:null},actions:['foreground-review']};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const page=(rows:DraftStatus[],offset=0,hasMore=false)=>({schemaVersion:1,drafts:rows,page:{limit:50,offset,hasMore}});

test('independent evidence presents saved draft, actual Taipei schedule and arranged delivery without recipient success',()=>{
 const v=statusPresentation(original);assert.equal(v.sync.label,'已保存並驗證');assert.equal(v.publication.label,'已排程');assert.match(v.publication.detail,/2026\/10\/22 07:00/);assert.equal(v.delivery.label,'已安排寄送');assert.equal(v.receipt,'尚無實收證據');assert.match(v.checkedAt,/2026\/10\/20 00:05/);assert.equal(v.attention,null);
 const excluded=statusPresentation({...original,sync:{...original.sync,status:'excluded'}});assert.equal(excluded.sync.label,'不自動編輯');assert.equal(excluded.attention,null);
 const held=statusPresentation({...original,attention:{pendingAction:'reconcile-schedule',code:'SUBSTACK_REMOTE_IDENTITY_MISMATCH'}});assert.match(held.attention!,/人工查核/);
 const unknown=statusPresentation({...original,sync:{...original.sync,status:'future-status'},delivery:{evidence:'future-result',subscriberReceipt:'unknown'}});assert.equal(unknown.sync.tone,'neutral');assert.equal(unknown.delivery.label,'寄送結果待確認');
});

test('GET reader consumes list and per-slug API with explicit same-origin no-store and truthful pagination',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];const reader=createStatusReader(()=>{},(async (input,init)=>{calls.push({url:String(input),init:init!});return String(input).includes('?')?response(page([original],50,true)):response({draft:original});}) as typeof fetch);
 await reader.load(undefined,50);assert.equal(reader.state.page?.offset,50);assert.equal(reader.state.page?.hasMore,true);await reader.load('original');assert.equal(reader.state.rows[0].providerId,'221099415');assert.deepEqual(calls.map(c=>c.url),['/api/v1/substack/drafts?limit=50&offset=50','/api/v1/substack/drafts/original']);assert.ok(calls.every(c=>c.init.method==='GET'&&c.init.credentials==='same-origin'&&c.init.cache==='no-store'));reader.dispose();
});

test('failed refresh retains last evidence; expired authentication hides private rows; untracked is not provider absence',async()=>{
 let mode=200;const reader=createStatusReader(()=>{},(async()=> mode===200?response({draft:original}):response({error:{code:mode===503?'SUBSTACK_STATE_UNAVAILABLE':mode===401?'UNAUTHENTICATED':'ARTICLE_NOT_FOUND'}},mode)) as typeof fetch);
 await reader.load('original');mode=503;await reader.load('original');assert.equal(reader.state.rows[0].providerId,'221099415');assert.match(reader.state.error!,/上次/);mode=401;await reader.load('original');assert.equal(reader.state.rows.length,0);assert.equal(reader.state.loginRequired,true);mode=404;await reader.load('original');assert.equal(reader.state.untracked,true);assert.equal(reader.state.rows.length,0);reader.dispose();
});

test('late replies cannot replace another article and disposing stops further presentation',async()=>{
 const resolvers:((r:Response)=>void)[]=[];const signals:AbortSignal[]=[];let updates=0;const reader=createStatusReader(()=>{updates++;},((_input,init)=>{signals.push(init!.signal!);return new Promise(resolve=>resolvers.push(resolve));}) as typeof fetch);
 const a=reader.load('original');const b=reader.load('next');assert.equal(signals[0].aborted,true);assert.equal(reader.state.rows.length,0);resolvers[1](response({draft:{...original,slug:'next'}}));await b;resolvers[0](response({draft:original}));await a;assert.equal(reader.state.rows[0].slug,'next');const c=reader.load('next');reader.dispose();const before=updates;resolvers[2](response({draft:original}));await c;assert.equal(updates,before);assert.equal(signals[2].aborted,true);
});

test('malformed and wrong-identity responses cannot replace verified evidence or leak backend errors',async()=>{
 let bad=false;const reader=createStatusReader(()=>{},(async()=>bad?response({draft:{...original,slug:'another'}}):response({draft:original})) as typeof fetch);await reader.load('original');bad=true;await reader.load('original');assert.equal(reader.state.rows[0].slug,'original');assert.ok(reader.state.error);reader.dispose();
});
