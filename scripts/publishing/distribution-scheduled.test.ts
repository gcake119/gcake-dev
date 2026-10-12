import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareScheduledDistribution} from './schedule-distribution';
const config={substack:{writeEnabled:false,ui:{origin:'https://gcakedev.substack.com',publicationPolicy:'full-mirror'}},unattended:{enabled:true,slug:'trial',policy:'pages-first-no-newsletter',targets:['substack']}};
test('scheduled policy derives exact operation approvals only after current anonymous Pages proof',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-scheduled-source-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-scheduled-out-'));let reads=0;
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\ntitle: Trial\nstatus: published\npublishedAt: 2026-09-28\n---\nFull body.\n');
  const prove=async(bundle:{sourceRevision:string})=>{reads++;return {sourceRevision:bundle.sourceRevision};};
  const run=await prepareScheduledDistribution('trial',root,config as never,out,prove as never);
  assert.equal(reads,1);assert.equal(run.commands.length,2);
  const scoped=JSON.parse(await fs.readFile(run.configFile,'utf8'));assert.equal(scoped.trial.writeEnabled,true);assert.equal(scoped.substack.writeEnabled,false);
  for(const command of run.commands){const approval=JSON.parse(await fs.readFile(command.approvalFile,'utf8'));assert.equal(approval.approved,true);assert.equal(approval.authorization,'pages-first-unattended');assert.equal(approval.operation,command.operation);assert.equal(approval.newsletter,'skip');assert.equal(approval.sourceRevision,scoped.trial.sourceRevision);}
  await assert.rejects(prepareScheduledDistribution('other',root,config as never,out,prove as never),/UNATTENDED_POLICY/);
  await assert.rejects(prepareScheduledDistribution('trial',root,{...config,unattended:{...config.unattended,enabled:false}} as never,out,prove as never),/UNATTENDED_POLICY/);
  await assert.rejects(prepareScheduledDistribution('trial',root,config as never,out,(async()=>{throw Error('PAGES_PUBLIC_HTTP_FAILED');}) as never),/PAGES_PUBLIC_HTTP/);
  assert.equal((await fs.readdir(out)).length,1);
  await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\ntitle: Trial\nstatus: ready\n---\nFull body.\n');
  await assert.rejects(prepareScheduledDistribution('trial',root,config as never,out,prove as never),/UNPUBLISHED_POST/);
  assert.equal((await fs.readdir(out)).length,1);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});

test('all-article policy derives separate exact scopes from a clean fixed source without promoting gates',async()=>{
 const {execFileSync}=await import('node:child_process');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-fixed-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-scopes-'));
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});for(const slug of ['first','second'])await fs.writeFile(path.join(root,`src/content/posts/${slug}.md`),'---\ntitle: Example\nstatus: published\npublishedAt: 2026-09-28\n---\nBody.\n');
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('update-ref','refs/remotes/origin/main','HEAD');
  const all={...config,unattended:{enabled:true,scope:'all-formal-markdown',repository:'gcake119/gcake-dev',branch:'main',policy:'pages-first-no-newsletter',targets:['substack']}};
  const prove=async(bundle:{sourceRevision:string})=>({sourceRevision:bundle.sourceRevision});
  const first=await prepareScheduledDistribution('first',root,all as never,out,prove as never);const second=await prepareScheduledDistribution('second',root,all as never,out,prove as never);
  const a=JSON.parse(await fs.readFile(first.configFile,'utf8')),b=JSON.parse(await fs.readFile(second.configFile,'utf8'));assert.equal(a.trial.slug,'first');assert.equal(b.trial.slug,'second');assert.equal(a.substack.writeEnabled,false);assert.equal(b.substack.writeEnabled,false);assert.notEqual(first.directory,second.directory);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});

test('all plans isolate platform failure and unknown intent without issuing unused write approvals',async()=>{
 const {execFileSync}=await import('node:child_process');const {prepareAllDistribution}=await import('./plan-all-distribution');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-fixed-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'distribution-scopes-'));
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/first.md'),'---\ntitle: Example\nstatus: published\npublishedAt: 2026-09-28\n---\nBody.\n');
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('update-ref','refs/remotes/origin/main','HEAD');
  const all={...config,unattended:{enabled:true,scope:'all-formal-markdown',repository:'gcake119/gcake-dev',branch:'main',policy:'pages-first-no-newsletter',targets:['substack']}};
  const {buildDistributionBundle}=await import('./prepare-distribution');const bundle=await buildDistributionBundle('first',path.join(root,'src/content/posts'));
  const prove=async()=>({sourceRevision:bundle.sourceRevision}) as never;
  const report=await prepareAllDistribution(root,all as never,out,async(slug,target)=>{
   return {locked:false,checkpoint:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,operation:'publish',createdAt:'now'}};
  },prove as never);
  const run=report.articles[0].run!;assert.deepEqual(run.commands.map(c=>[c.target,c.operation]),[['substack','retry']]);assert.equal(run.recoveries.length,0);
  const scoped=JSON.parse(await fs.readFile(run.configFile,'utf8'));assert.equal(scoped.trial.writeEnabled,false);assert.equal(scoped.substack.writeEnabled,false);
  assert.ok(!(await fs.readdir(run.directory)).some(file=>file.includes('prepare-approval')||file.includes('publish-approval')));
  const metadata=await prepareAllDistribution(root,all as never,out,async(slug,target)=>({locked:false,state:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,status:'uncertain',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'},checkpoint:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,operation:'metadata',substackPolicy:'full-mirror',createdAt:'now'}}),prove as never);
  assert.equal(metadata.articles[0].run!.recoveries.length,1);assert.equal(metadata.articles[0].run!.recoveries[0].operation,'finalize');
  await fs.writeFile(path.join(root,'src/content/posts/first.md'),'changed');await assert.rejects(prepareAllDistribution(root,all as never,out,async()=>({locked:false})),/NOT_FIXED_MAIN/);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});
