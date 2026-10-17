import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inventoryDistribution, planTarget, assertGeneralPolicy } from './distribution-inventory';
const source='---\ntitle: Example\nstatus: published\npublishedAt: 2026-09-28\n---\nFull [link](https://example.com).\n';
test('all articles include first public backfill, nested posts and every excluded source without provider writes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-inventory-'));let reads=0;
 try{
  await fs.mkdir(path.join(root,'src/content/posts/nested'),{recursive:true});
  for(const [file,body] of Object.entries({'first.md':source,'nested/second.md':source,'ready.md':source.replace('status: published','status: ready'),'future.md':source.replace('2026-09-28','2099-09-28'),'component.mdx':source,'summary.md':source.replace('status: published','distribution:\n  mode: interactive-summary\n  fallback: Summary\nstatus: published'),'stale.md':source}))await fs.writeFile(path.join(root,'src/content/posts',file),body);
  await fs.mkdir(path.join(root,'src/data/external'),{recursive:true});await fs.writeFile(path.join(root,'src/data/external/ithome.generated.json'),JSON.stringify({source:'gcake119/ithome-2026',posts:[{slug:'day-01',title:'External'}]}));
  const report=await inventoryDistribution(root,'a'.repeat(40),async bundle=>{reads++;if(bundle.slug==='stale')throw Error('PAGES_PUBLIC_EVIDENCE_MISMATCH');return {sourceRevision:bundle.sourceRevision} as never;},()=> '2026-10-12T00:00:00Z');
  assert.equal(report.entries.length,8);assert.equal(reads,3);assert.deepEqual(report.entries.filter(e=>e.status==='eligible').map(e=>e.slug),['first','second']);
  for(const [slug,reason] of [['ready','DISTRIBUTION_SOURCE_NOT_PUBLISHED'],['future','DISTRIBUTION_SOURCE_FUTURE'],['component','DISTRIBUTION_MDX_REQUIRES_FULL_SOURCE_REVIEW'],['summary','DISTRIBUTION_SUMMARY_NOT_FULL_MIRROR'],['stale','PAGES_PUBLIC_EVIDENCE_MISMATCH'],['day-01','DISTRIBUTION_EXTERNAL_SOURCE_NOT_FORMAL']])assert.equal(report.entries.find(e=>e.slug===slug)?.reason,reason);
  assert.equal(report.externalWriteEnabled,false);assert.equal(report.sourceCommit,'a'.repeat(40));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('duplicate slug and invalid sources are fully reported; empty source has no operations',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-inventory-'));
 try{await fs.mkdir(path.join(root,'src/content/posts/sub'),{recursive:true});
  assert.equal((await inventoryDistribution(root,'b'.repeat(40))).entries.length,0);
  await fs.writeFile(path.join(root,'src/content/posts/same.md'),source);await fs.writeFile(path.join(root,'src/content/posts/sub/same.md'),source);
  const report=await inventoryDistribution(root,'b'.repeat(40),async()=>{throw Error('must not prove duplicates');});assert.equal(report.entries.length,2);assert.ok(report.entries.every(e=>e.reason==='DISTRIBUTION_DUPLICATE_SLUG'));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('target plans preserve independent versions, original intent and same-ID updates',()=>{
 const revision='r2';const state={postSlug:'first',target:'substack' as const,status:'verified' as const,sourceRevision:revision,remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'};
 assert.deepEqual(planTarget(revision).operations,['prepare','publish']);
 assert.deepEqual(planTarget(revision,state).operations,['verify']);
 assert.deepEqual(planTarget(revision,{...state,sourceRevision:'r1'}).operations,['prepare']);
 assert.deepEqual(planTarget(revision,{...state,status:'uncertain'},{postSlug:'first',target:'substack',sourceRevision:revision,operation:'publish',createdAt:'now'}).operations,['retry']);
 assert.equal(planTarget(revision,state,{postSlug:'first',target:'substack',sourceRevision:'r1',operation:'create',createdAt:'now'}).reason,'DISTRIBUTION_INTENT_REVISION_MISMATCH');
 assert.equal(planTarget(revision,state,undefined,true).reason,'DISTRIBUTION_LOCKED');
 assert.equal(planTarget(revision,{...state,status:'uncertain'}).reason,'DISTRIBUTION_RECONCILIATION_REQUIRED');
});
test('general policy is explicitly bounded to repository branch publications and zero delivery',()=>{
 const config={unattended:{enabled:true,scope:'all-formal-markdown',repository:'gcake119/gcake-dev',branch:'main',policy:'pages-first-no-newsletter',targets:['substack']},substack:{ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror'}}};
 assert.doesNotThrow(()=>assertGeneralPolicy(config as never));
 for(const unattended of [{...config.unattended,repository:'other/repo'},{...config.unattended,branch:'develop'},{...config.unattended,enabled:false},{...config.unattended,targets:[]},{...config.unattended,targets:['paragraph','substack']},{...config.unattended,targets:['substack','substack']}])assert.throws(()=>assertGeneralPolicy({...config,unattended} as never),/UNATTENDED_POLICY/);
});

test('malformed and nonportable formal bodies are explicit source blockers before Pages or provider calls',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-inventory-'));
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/no-date.md'),source.replace('publishedAt: 2026-09-28\n',''));await fs.writeFile(path.join(root,'src/content/posts/component-body.md'),source+'\n<Widget client:load />');
  const report=await inventoryDistribution(root,'c'.repeat(40),async()=>{throw Error('must not call Pages for invalid source');});
  assert.equal(report.entries.find(e=>e.slug==='no-date')?.reason,'DISTRIBUTION_SOURCE_INVALID');assert.equal(report.entries.find(e=>e.slug==='component-body')?.reason,'DISTRIBUTION_NONPORTABLE_BODY');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('manual-required target stays held across source changes and retained checkpoints until attended resolution',()=>{
 const held={postSlug:'first',target:'substack' as const,status:'manual_required' as const,sourceRevision:'r1',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS',updatedAt:'now'};
 for(const revision of ['r1','r2'])for(const checkpoint of [undefined,{postSlug:'first',target:'substack' as const,sourceRevision:revision,operation:'metadata' as const,createdAt:'now'}]){
  assert.deepEqual(planTarget(revision,held,checkpoint),{operations:[],reason:'DISTRIBUTION_MANUAL_REQUIRED'});
 }
 assert.deepEqual(planTarget('r1',{...held,status:'verified'}).operations,['verify']);
 assert.equal(held.lastErrorCode,'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS');
});

test('background plans only unchanged public verification and defers all browser work',()=>{
 const state={postSlug:'first',target:'substack' as const,status:'verified' as const,sourceRevision:'r1',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'};
 for(const status of ['verified','published'] as const)assert.deepEqual(planTarget('r1',{...state,status},undefined,false,true),{operations:['verify']});
 for(const item of [undefined,{...state,sourceRevision:'r0'},{...state,status:'prepare_ready' as const},{...state,remoteUrl:'https://gcakedev.substack.com/publish/post/123'},{...state,remoteUrl:'https://other.example/p/first'}]){
  assert.deepEqual(planTarget('r1',item,undefined,false,true),{operations:[],reason:'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED'});
 }
 assert.deepEqual(planTarget('r1',state,{postSlug:'first',target:'substack',sourceRevision:'r1',operation:'metadata',createdAt:'now'},false,true),{operations:[],reason:'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED'});
});
