import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DistributionCoordinator } from '../../apps/admin-worker/src/distribution-coordinator';
import { InMemoryPublicationRepository } from '../../apps/admin-worker/src/publication-operations';
import { AttendedSubstackAdapter, FileAttendedExchange } from './substack-attended';
import { renderedArticle } from './substack-browser';
const article={slug:'trial',sourceRevision:'r1',title:'Trial',body:'# Complete\n\n[Original](https://example.com/original)',canonicalUrl:'https://example.com/original',publishedAt:'2026-10-11T16:00:00Z',assets:[]};
const remote={id:'123',url:'https://gcakedev.substack.com/publish/post/123'};
const publicRemote={id:'123',url:'https://gcakedev.substack.com/p/trial'};
const approval={slug:article.slug,sourceRevision:article.sourceRevision,target:'substack' as const,approved:true as const,newsletter:'skip' as const,substackPolicy:'full-mirror' as const};
const draft=()=>({...remote,...renderedArticle(article),title:article.title,saved:true});
const publicEvidence=()=>({title:article.title,text:renderedArticle(article).text,links:renderedArticle(article).links,images:[],canonical:publicRemote.url,publishedAt:article.publishedAt});
function fixture(operation:'prepare'|'publish'|'retry'='prepare',badReply=false) {
  const repository=new InMemoryPublicationRepository(),actions:string[]=[];
  const adapter=new AttendedSubstackAdapter(article,operation,repository.runtime,async request=>{
    actions.push(request.action);
    if (['create','update','publish','metadata'].includes(request.action)) {
      assert.equal((await repository.runtime.checkpoint(article.slug,'substack'))?.operation,request.action);
    }
    if (request.action==='preflight') return {origin:'https://gcakedev.substack.com',loggedIn:true};
    if (request.action==='find') return {complete:true,scanned:['draft','published','scheduled'],items:[]};
    if (request.action==='create') return remote;
    if (request.action==='update'||request.action==='readDraft') return {...draft(),text:badReply?'stale':draft().text};
    if (request.action==='checkPublish') return {...draft(),emailDisabled:true,scheduleDisabled:true};
    if (request.action==='publish') return {...publicRemote,emailDisabled:true,scheduleDisabled:true};
    throw new Error('SUBSTACK_TEST_UNEXPECTED_ACTION');
  },async()=>publicEvidence());
  const coordinator=new DistributionCoordinator(repository,adapter);
  return {repository,adapter,coordinator,actions};
}
test('attended draft uses coordinator intent before writes and records exact saved evidence',async()=>{
  const f=fixture(); const state=await f.coordinator.run(article,'substack','prepare',approval);
  assert.equal(state.status,'prepare_ready'); assert.equal(state.remoteId,remote.id);
  assert.deepEqual(f.actions,['preflight','find','create','update']);
  assert.equal(await f.repository.runtime.checkpoint(article.slug,'substack'),undefined);
  await f.coordinator.run(article,'substack','prepare',approval);
  assert.equal(f.actions.filter(action=>action==='create').length,1);
  assert.equal(f.actions.filter(action=>action==='update').length,1);
});
test('attended stale draft reply retains remote identity and cannot replay a write on retry',async()=>{
  const f=fixture('prepare',true); const state=await f.coordinator.run(article,'substack','prepare',approval);
  assert.equal(state.status,'uncertain'); assert.equal(state.remoteId,remote.id);
  const next=await f.coordinator.run(article,'substack','retry');
  assert.equal(next.status,'uncertain');
  assert.equal(f.actions.filter(action=>action==='create').length,1);
  assert.equal(f.actions.filter(action=>action==='update').length,1);
});
test('publish transport cannot create a draft and anonymous mismatch prevents verified',async()=>{
  const f=fixture('publish');
  const missing=await f.coordinator.run(article,'substack','publish',approval);
  assert.equal(missing.status,'uncertain'); assert.equal(f.actions.includes('create'),false);
  await f.repository.runtime.clear(article.slug,'substack');
  await f.repository.putState({postSlug:article.slug,target:'substack',sourceRevision:article.sourceRevision,status:'prepare_ready',remoteId:remote.id,remoteUrl:remote.url,updatedAt:'now'});
  const state=await f.coordinator.run(article,'substack','publish',approval);
  assert.equal(state.status,'verified'); assert.equal(state.remoteUrl,publicRemote.url);
  assert.equal(f.actions.filter(action=>action==='publish').length,1);
  await f.coordinator.run(article,'substack','publish',approval);
  assert.equal(f.actions.filter(action=>action==='publish').length,1);
  const rejecting=new AttendedSubstackAdapter(article,'retry',f.repository.runtime,async()=>{throw Error('unexpected');},async()=>({...publicEvidence(),text:'wrong public body'}));
  await assert.rejects(rejecting.verify(publicRemote,article),/PUBLIC_EVIDENCE/);
});
test('file handoff rejects stale request replies and timeout never reissues a write request',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-attended-'));
  try {
    const session=await FileAttendedExchange.create(dir,process.cwd(),80,5,async requestFile=>{
      const request=JSON.parse(await fs.readFile(requestFile,'utf8'));
      await fs.writeFile(path.join(path.dirname(requestFile),'reply.json'),JSON.stringify({...request,requestId:'stale',result:{loggedIn:true}}),{flag:'wx'});
    });
    await assert.rejects(session.exchange({action:'preflight',article,operation:'prepare'}),/ATTENDED_REPLY_MISMATCH/);
    let requests=0;
    const waiting=await FileAttendedExchange.create(dir,process.cwd(),30,5,async()=>{requests++;});
    await assert.rejects(waiting.exchange({action:'create',article,operation:'prepare'}),/ATTENDED_TIMEOUT/);
    assert.equal(requests,1);
    await assert.rejects(FileAttendedExchange.create(path.join(process.cwd(),'.bad-session'),process.cwd()),/SESSION_OUTSIDE_GIT/);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('a browser write without durable intent is rejected before emitting a request',async()=>{
 const f=fixture();
 await assert.rejects(f.adapter.update(remote,article),/INTENT_REQUIRED/);
 assert.deepEqual(f.actions,[]);
});
test('anonymous readback bypasses stale edge HTML while retaining article canonical identity',async()=>{
 const {anonymousSubstackReader}=await import('./substack-attended');
 let requested='';
 const ui={publicBody:'.body',publicTitle:'h1',publicDate:'time'} as never;
 const read=anonymousSubstackReader(ui,async(url,options)=>{
  requested=String(url);assert.equal(options?.redirect,'error');
  return new Response(`<html><head><link rel="canonical" href="${publicRemote.url}"></head><body><h1>Trial</h1><time datetime="2026-10-12T03:56:00.165Z"></time><div class="body"><p>Complete</p></div></body></html>`);
 });
 const evidence=await read(publicRemote);
 assert.equal(new URL(requested).pathname,'/p/trial');
 assert.ok(new URL(requested).searchParams.get('verification'));
 assert.equal(evidence.canonical,publicRemote.url);
 assert.equal(evidence.publishedAt,'2026-10-12T03:56:00.165Z');
});
