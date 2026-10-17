import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewDigest} from './run-distribution';
import {createProfileTransport} from './substack-profile';
const article={slug:'demo',sourceRevision:'r1',title:'Demo',description:undefined,body:'Hello [original](https://gcake119.github.io/gcake-dev/posts/demo/)',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/demo/',publishedAt:'2026-10-12T03:56:38Z',substackDatePrecision:'minute' as const,assets:[]};
test('profile authorization is distinct from side-browser receipts',()=>{assert.notEqual(reviewDigest(article,'substack','profile'),reviewDigest(article,'substack'));});
test('same-version profile verification is independent of Codex, login and file handoffs',async()=>{let opens=0;const config={substack:{transport:'profile',profile:'/private/tmp/profile',profileContractReviewed:true,ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror'}},trial:{}} as never;const repository={runtime:{}} as never;const result=await createProfileTransport(article,'verify',repository,config,'/private/tmp/runtime',async()=>{opens++;throw Error('must not launch');},async()=>{},async()=>({title:article.title,text:'Hello original',canonical:'https://gcakedev.substack.com/p/demo',publishedAt:'2026-10-12T03:56:00.123Z',links:[article.canonicalUrl],images:[]}));assert.equal((await result.adapter.verify({id:'123',url:'https://gcakedev.substack.com/p/demo'},article))?.id,'123');assert.equal(opens,0);assert.equal(result.context,undefined);});
test('profile writes require reviewed controls without lifting general capability flags',async()=>{const config={substack:{transport:'profile',profileContractReviewed:false}} as never;await assert.rejects(createProfileTransport(article,'prepare',{} as never,config,'/tmp/runtime',async()=>{throw Error('unexpected browser');},async()=>{},async()=>({} as never)),/PROFILE_CONTRACT/);});

const publicState={postSlug:'demo',target:'substack',status:'verified',sourceRevision:'r1',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/demo',updatedAt:'now'};
const backgroundConfig={substack:{transport:'profile',profile:'/private/tmp/profile',profileContractReviewed:true,ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror',discoveryScopes:['published','draft','scheduled'].map(state=>({state})),appNotification:{},schedule:{},immediateUpdate:{},websiteOnlyConfirm:{}}}} as never;
test('background preparation refuses before opening even a reviewed browser',async()=>{
 let opens=0;
 const repo={listStates:async()=>[publicState],runtime:{checkpoint:async()=>undefined}} as never;
 await assert.rejects(createProfileTransport(article,'prepare',repo,backgroundConfig,'/tmp/runtime',async()=>{opens++;throw Error('BROWSER_OPENED');},async()=>{},async()=>({} as never),true),/SUBSTACK_BACKGROUND_ATTENDED_REQUIRED/);
 assert.equal(opens,0);
});
test('background verification rechecks manual holds, changed versions and unsettled intents before public reads',async()=>{
 let reads=0,opens=0;
 for(const state of [{...publicState,status:'manual_required'}, {...publicState,sourceRevision:'old'},publicState]){
  const repo={listStates:async()=>[state],runtime:{checkpoint:async()=>state===publicState?{operation:'metadata',sourceRevision:'r1'}:undefined}} as never;
  await assert.rejects(createProfileTransport(article,'verify',repo,backgroundConfig,'/tmp/runtime',async()=>{opens++;throw Error('BROWSER_OPENED');},async()=>{},async()=>{reads++;return {} as never;},true),/DISTRIBUTION_MANUAL_REQUIRED|SUBSTACK_BACKGROUND_ATTENDED_REQUIRED/);
 }
 assert.equal(reads,0);assert.equal(opens,0);
});
test('background same-version native verification uses anonymous evidence without native identity or permissions',async()=>{
 let reads=0,opens=0;
 const repo={listStates:async()=>[publicState],runtime:{checkpoint:async()=>undefined}} as never;
 const config={substack:{transport:'macos-chrome',ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror'}}} as never;
 const result=await createProfileTransport(article,'verify',repo,config,'/tmp/runtime',async()=>{opens++;throw Error('BROWSER_OPENED');},async()=>{},async()=>{reads++;return {title:article.title,text:'Hello original',canonical:publicState.remoteUrl,publishedAt:'2026-10-12T03:56:00.123Z',links:[article.canonicalUrl],images:[]};},true);
 assert.equal((await result.adapter.verify({id:'123',url:publicState.remoteUrl},article))?.id,'123');
 assert.equal(reads,1);assert.equal(opens,0);assert.equal(result.context,undefined);
});
test('background CLI rejects writing commands before loading source or provider state',async()=>{
 const {main}=await import('./run-distribution');
 for(const operation of ['prepare','publish','finalize','retry','login'])await assert.rejects(main([operation,'missing','substack','--background','--mode','controlled-trial']),/SUBSTACK_BACKGROUND_ATTENDED_REQUIRED/);
 await assert.rejects(main(['verify','missing','substack','--background']),/SUBSTACK_BACKGROUND_ATTENDED_REQUIRED/);
});

test('background coordinator preserves a hold acquired after transport selection without any public read',async()=>{
 const {DistributionCoordinator}=await import('../../apps/admin-worker/src/distribution-coordinator');
 const {InMemoryPublicationRepository}=await import('../../apps/admin-worker/src/publication-operations');
 const repo=new InMemoryPublicationRepository();await repo.putState({...publicState,target:'substack',status:'verified'});
 let reads=0,opens=0;const acquire=repo.runtime.acquire.bind(repo.runtime);
 const held={...publicState,target:'substack' as const,status:'manual_required' as const,lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS',updatedAt:'foreground'};
 const selected=await createProfileTransport(article,'verify',repo,backgroundConfig,'/tmp/runtime',async()=>{opens++;throw Error('BROWSER_FORBIDDEN');},async()=>{},async()=>{reads++;return {title:article.title,text:'Hello original',canonical:publicState.remoteUrl,publishedAt:'2026-10-12T03:56:00.123Z',links:[article.canonicalUrl],images:[]};},true);
 repo.runtime.acquire=async(...args)=>{await repo.putState(held);return acquire(...args);};
 await assert.rejects(new DistributionCoordinator(repo,selected.adapter).run(article,'substack','verify',undefined,true),/DISTRIBUTION_MANUAL_REQUIRED/);
 assert.deepEqual((await repo.listStates('demo'))[0],held);assert.equal(reads,0);assert.equal(opens,0);assert.equal(repo.runtime.locks.size,0);
});

test('locked background rejection retains changed revisions and new checkpoints while explicit foreground verify remains available',async()=>{
 const {DistributionCoordinator}=await import('../../apps/admin-worker/src/distribution-coordinator');const {InMemoryPublicationRepository}=await import('../../apps/admin-worker/src/publication-operations');
 for(const scenario of ['revision','checkpoint','foreground'] as const){
  const repo=new InMemoryPublicationRepository();await repo.putState({...publicState,target:'substack',status:'verified'});let reads=0;
  const selected=await createProfileTransport(article,'verify',repo,backgroundConfig,'/tmp/runtime',async()=>{throw Error('BROWSER_FORBIDDEN');},async()=>{},async()=>{reads++;return {title:article.title,text:'Hello original',canonical:publicState.remoteUrl,publishedAt:'2026-10-12T03:56:00.123Z',links:[article.canonicalUrl],images:[]};},true);
  const state={...publicState,target:'substack' as const,status:scenario==='foreground'?'manual_required' as const:'verified' as const,sourceRevision:scenario==='revision'?'changed':'r1',lastErrorCode:'RETAIN_DIAGNOSTIC'};await repo.putState(state);
  const checkpoint={postSlug:'demo',target:'substack' as const,sourceRevision:'r1',operation:'metadata' as const,substackPolicy:'full-mirror' as const,createdAt:'now'};
  if(scenario==='checkpoint')await repo.runtime.record(checkpoint);
  const coordinator=new DistributionCoordinator(repo,selected.adapter);
  if(scenario==='foreground'){
   assert.equal((await coordinator.run(article,'substack','verify')).status,'verified');assert.equal(reads,1);
  }else{
   await assert.rejects(coordinator.run(article,'substack','verify',undefined,true),/SUBSTACK_BACKGROUND_ATTENDED_REQUIRED/);assert.deepEqual((await repo.listStates('demo'))[0],state);assert.equal(reads,0);
   assert.deepEqual(await repo.runtime.checkpoint('demo','substack'),scenario==='checkpoint'?checkpoint:undefined);
  }
  assert.equal(repo.runtime.locks.size,0);
 }
});
