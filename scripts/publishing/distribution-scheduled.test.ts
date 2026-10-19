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
  assert.equal(report.articles[0].run,undefined);assert.equal(report.articles[0].targets.substack?.reason,'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
  const metadata=await prepareAllDistribution(root,all as never,out,async(slug,target)=>({locked:false,state:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,status:'uncertain',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'},checkpoint:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,operation:'metadata',substackPolicy:'full-mirror',createdAt:'now'}}),prove as never);
  assert.equal(metadata.articles[0].run,undefined);assert.equal(metadata.articles[0].targets.substack?.reason,'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
  const manual=await prepareAllDistribution(root,all as never,out,async(slug,target)=>({locked:false,state:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,status:'manual_required',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'}}),prove as never);
  assert.equal(manual.articles[0].run,undefined);assert.equal(manual.articles[0].targets.substack?.reason,'DISTRIBUTION_MANUAL_REQUIRED');
  const fresh=await prepareAllDistribution(root,all as never,out,async()=>({locked:false}),prove as never);
  assert.equal(fresh.articles[0].run,undefined);assert.equal(fresh.articles[0].targets.substack?.reason,'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
  assert.equal((await fs.readdir(out)).length,0);
  const verified=await prepareAllDistribution(root,all as never,out,async(slug,target)=>({locked:false,state:{postSlug:slug,target,sourceRevision:bundle.sourceRevision,status:'verified',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/first',updatedAt:'now'}}),prove as never);
  const run=verified.articles[0].run!;assert.deepEqual(run.commands.map(c=>c.operation),['verify']);assert.deepEqual(run.recoveries,[]);
  const scoped=JSON.parse(await fs.readFile(run.configFile,'utf8'));assert.equal(scoped.trial.writeEnabled,false);assert.equal(scoped.substack.writeEnabled,false);
  assert.ok(!(await fs.readdir(run.directory)).some(file=>file.includes('prepare-approval')||file.includes('publish-approval')||file.includes('finalize-approval')));
  await fs.writeFile(path.join(root,'src/content/posts/first.md'),'changed');await assert.rejects(prepareAllDistribution(root,all as never,out,async()=>({locked:false})),/NOT_FIXED_MAIN/);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});

test('advance review prepares a finalized future article before Pages exists without provider writes',async()=>{
 const {execFileSync}=await import('node:child_process');const {main}=await import('./run-distribution');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'advance-source-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'advance-review-'));
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\ntitle: Trial\nstatus: ready\n---\nComplete article.\n');
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('update-ref','refs/remotes/origin/main','HEAD');
  const file=path.join(out,'config.json');await fs.writeFile(file,JSON.stringify({scheduled:{policyVersion:'scheduled-source-first-delivery-v1',writeEnabled:false},substack:{ui:{origin:'https://gcakedev.substack.com'}}}));
  const receipt=path.join(out,'review.json');await main(['prepare-draft','trial','substack','--config',file,'--out',receipt,'--source-root',root]);
  const result=JSON.parse(await fs.readFile(receipt,'utf8'));assert.equal(result.source.slug,'trial');assert.equal(result.source.article.title,'Trial');assert.equal(result.externalWriteEnabled,false);assert.equal(result.source.sourceCommit.length,40);assert.match(result.source.article.body,/Complete article/);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});

for(const kind of ['draft','mdx','duplicate','incomplete','media'])test('advance source blocks '+kind+' before preparing any draft',async()=>{
 const {execFileSync}=await import('node:child_process');const {buildScheduledSource}=await import('./scheduled-source');const root=await fs.mkdtemp(path.join(os.tmpdir(),'advance-invalid-'));
 try{await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.'+(kind==='mdx'?'mdx':'md')),'---\ntitle: Trial\nstatus: '+(kind==='draft'?'draft':'ready')+'\n---\nComplete body.\n'+(kind==='media'?'\n![A](https://example.com/missing.png)':''));
 if(kind==='duplicate'){await fs.mkdir(path.join(root,'src/content/posts/nested'));await fs.writeFile(path.join(root,'src/content/posts/nested/trial.md'),'---\ntitle: Duplicate\nstatus: ready\n---\nOther.');}
 if(kind==='incomplete'){await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});await fs.writeFile(path.join(root,'src/content/series/sample.yaml'),JSON.stringify({slug:'sample',sections:[{posts:[{slug:'trial',status:'ready'},{slug:'unfinished',status:'draft'}]}]}));}
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('update-ref','refs/remotes/origin/main','HEAD');
 let mediaReads=0;await assert.rejects(buildScheduledSource(root,'trial',async()=>{mediaReads++;return new Response('missing',{status:404});}),/SUBSTACK_SOURCE_/);assert.equal(mediaReads,kind==='media'?1:0);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('background observer includes vanished sources and source-read failure retains prior evidence',async()=>{
 const {execFileSync}=await import('node:child_process');const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {ScheduleRepository}=await import('../../apps/admin-worker/src/substack-schedules');const {observeSubstackSchedules}=await import('./observe-substack-schedules');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'advance-observer-'));const sql=new DatabaseSync(':memory:');try{await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/other.md'),'---\ntitle: Other\nstatus: ready\n---\nOther.');const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('update-ref','refs/remotes/origin/main','HEAD');
 for(const name of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])sql.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+name,import.meta.url),'utf8'));sql.exec("CREATE TABLE release_queue_runtime (id INTEGER PRIMARY KEY,version INTEGER,document TEXT)");sql.prepare('INSERT INTO release_queue_runtime VALUES (1,1,?)').run('{"overrides":{}}');const db=new SqliteD1Database(sql),repo=new ScheduleRepository(db),at='2026-10-21T23:00:00.000Z';await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:'deleted',slug:'deleted',remoteId:'123',version:0,observedState:'scheduled',observedTime:at,delivery:'armed',updatedAt:'2026-10-19T00:00:00Z'},0);
 let publicReads=0;const read=async()=>{publicReads++;throw Error('PUBLIC_FORBIDDEN');};const first=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T00:00:00Z',read);assert.equal(first[0].operation,'cancel-schedule');assert.equal(first[0].stillArmedUntilConfirmed,true);assert.equal(first[0].observedTime,at);assert.equal(publicReads,0);const saved=JSON.stringify(await repo.get('deleted'));await fs.writeFile(path.join(root,'src/content/posts/other.md'),'dirty');const second=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T00:00:00Z',read);assert.equal(second[0].status,'blocked');assert.equal(JSON.stringify(await repo.get('deleted')),saved);assert.equal(publicReads,0);
 }finally{sql.close();await fs.rm(root,{recursive:true,force:true});}
});

for(const [kind,flags] of [['paused',{status:'paused'}],['publication-paused',{publication:{status:'paused'}}],['external',{source:{type:'external'}}]] as const)test('audit regression: '+kind+' series blocks preparation and requests cancellation of its armed article',async()=>{
 const {execFileSync}=await import('node:child_process');const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {ScheduleRepository}=await import('../../apps/admin-worker/src/substack-schedules');const {buildScheduledSource}=await import('./scheduled-source');const {observeSubstackSchedules}=await import('./observe-substack-schedules');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'audit-series-')),sql=new DatabaseSync(':memory:');try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts/trial.md'),'---\ntitle: Trial\nstatus: ready\n---\nComplete body.\n');
  const manifest={slug:'series',sections:[{posts:[{slug:'trial',status:'ready'}]}]},file=path.join(root,'src/content/series/series.yaml');await fs.writeFile(file,JSON.stringify(manifest));const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');
  const commit=()=>{git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');git('update-ref','refs/remotes/origin/main','HEAD');};commit();const original=await buildScheduledSource(root,'trial');
  for(const name of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])sql.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+name,import.meta.url),'utf8'));sql.exec('CREATE TABLE release_queue_runtime (id INTEGER PRIMARY KEY,version INTEGER,document TEXT)');const at='2026-10-21T23:00:00.000Z',slot={reservationId:'fixed:trial:'+at,queueVersion:1,slug:'trial',scheduledAt:at,confirmed:true};sql.prepare('INSERT INTO release_queue_runtime VALUES (1,1,?)').run(JSON.stringify({overrides:{trial:at}}));
  const db=new SqliteD1Database(sql),repo=new ScheduleRepository(db);const {contentFingerprint,expectedContent}=await import('./substack-schedule');await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:'tracked',slug:'trial',remoteId:'123',sourceRevision:original.sourceRevision,contentVerifiedRevision:original.sourceRevision,contentDigest:contentFingerprint(expectedContent(original)),version:0,observedState:'scheduled',observedTime:at,slot,delivery:'armed',updatedAt:'2026-10-19T00:00:00Z'},0);
  await fs.writeFile(file,JSON.stringify({...manifest,...flags}));commit();
  let publicReads=0;const results=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T01:00:00Z',async()=>{publicReads++;throw Error('public read forbidden');});
  assert.equal(results[0].operation,'cancel-schedule');assert.equal(results[0].status,'manual_required');assert.equal(results[0].stillArmedUntilConfirmed,true);assert.equal(results[0].observedTime,at);assert.equal(publicReads,0);assert.equal((await repo.get('tracked'))?.remoteId,'123');
  await assert.rejects(buildScheduledSource(root,'trial'),/SUBSTACK_SOURCE_SERIES_/);
 }finally{sql.close();await fs.rm(root,{recursive:true,force:true});}
});

test('attention reasons distinguish new series drafts, content drift, cancellation, postponement and uncertain arm',async()=>{
 const {execFileSync}=await import('node:child_process');const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {ScheduleRepository}=await import('../../apps/admin-worker/src/substack-schedules');const {observeSubstackSchedules}=await import('./observe-substack-schedules');const {buildScheduledSource}=await import('./scheduled-source');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'series-attention-')),sql=new DatabaseSync(':memory:');
 try{
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});const slugs=['new-draft','content','postponed','unknown-arm'];
  for(const slug of slugs)await fs.writeFile(path.join(root,'src/content/posts',slug+'.md'),'---\ntitle: '+slug+'\nstatus: ready\n---\nComplete article.\n');
  await fs.writeFile(path.join(root,'src/content/series/series.yaml'),JSON.stringify({slug:'series',sections:[{posts:slugs.map(slug=>({slug,status:'ready'}))}]}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','series');git('update-ref','refs/remotes/origin/main','HEAD');
  for(const name of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])sql.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+name,import.meta.url),'utf8'));
  sql.exec('CREATE TABLE release_queue_runtime (id INTEGER PRIMARY KEY,version INTEGER,document TEXT)');sql.prepare('INSERT INTO release_queue_runtime VALUES (1,1,?)').run(JSON.stringify({overrides:{postponed:'2026-10-26T07:00:00+08:00'}}));
  const db=new SqliteD1Database(sql),repo=new ScheduleRepository(db),now='2026-10-19T00:00:00Z';
  for(const [i,slug] of ['content','cancelled-source','postponed','unknown-arm'].entries()){
   const source=slug==='cancelled-source'?undefined:await buildScheduledSource(root,slug);
   await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:slug,slug,remoteId:String(100+i),version:0,sourceRevision:source?.sourceRevision,observedState:slug==='content'?'draft_prepared':'scheduled',observedTime:'2026-10-21T23:00:00Z',delivery:slug==='content'?'not_armed':'armed',pendingAction:slug==='content'?'sync-content':undefined,...(slug==='unknown-arm'?{intent:{id:'arm-intent',action:'arm' as const,createdAt:now},pendingAction:'sync-content'}:{}),updatedAt:now},0);
  }
  let providerReads=0;const rows=await observeSubstackSchedules(root,db,{} as never,now,async()=>{providerReads++;throw Error('forbidden');});
  assert.deepEqual(Object.fromEntries(rows.map(r=>[r.slug,r.code])),{'cancelled-source':'SUBSTACK_SCHEDULE_CANCEL_REQUIRED',content:'SUBSTACK_CONTENT_SYNC_REQUIRED',postponed:'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED','unknown-arm':'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED','new-draft':'SUBSTACK_DRAFT_PREPARATION_REQUIRED'});assert.equal(providerReads,0);
  const unknown=(await repo.get('unknown-arm'))!;assert.equal(unknown.intent?.id,'arm-intent');assert.equal(unknown.remoteId,'103');
  const newSource=await buildScheduledSource(root,'new-draft');const {contentFingerprint,expectedContent}=await import('./substack-schedule');
  await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:'new-draft',slug:'new-draft',remoteId:'104',version:0,sourceRevision:newSource.sourceRevision,contentVerifiedRevision:newSource.sourceRevision,contentDigest:contentFingerprint(expectedContent(newSource)),observedState:'draft_prepared',delivery:'not_armed',updatedAt:now},0);
  const following=await observeSubstackSchedules(root,db,{} as never,now,async()=>{providerReads++;throw Error('forbidden');});
  assert.equal(following.find(r=>r.slug==='new-draft')?.status,'observed');assert.equal(following.find(r=>r.slug==='new-draft')?.code,undefined);assert.equal(providerReads,0);

 }finally{sql.close();await fs.rm(root,{recursive:true,force:true});}
});

test('three legacy public originals clear false content attention while failed reads retain the snapshot',async()=>{
 const {execFileSync}=await import('node:child_process');const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {ScheduleRepository}=await import('../../apps/admin-worker/src/substack-schedules');const {observeSubstackSchedules}=await import('./observe-substack-schedules');const {buildScheduledSource}=await import('./scheduled-source');const {expectedContent}=await import('./substack-schedule');const {publishAttentionSnapshot}=await import('./distribution-attention');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'legacy-content-attention-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'legacy-attention-feed-')),sql=new DatabaseSync(':memory:');
 try{
  const originals=[['ithome-2026-astro-choice','221069931'],['ithome-2026-chatgpt-writing-workflow','220011124'],['ithome-2026-publishing-toolchain','220473117']];
  await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});
  for(const [slug] of originals)await fs.writeFile(path.join(root,'src/content/posts',slug+'.md'),'---\ntitle: '+slug+'\ndescription: Source description\nstatus: ready\n---\n## Heading\n\nComplete original.\n\n```text\na  b\n```\n');
  await fs.writeFile(path.join(root,'src/content/series/series.yaml'),JSON.stringify({slug:'series',sections:[{posts:originals.map(([slug])=>({slug,status:'ready'}))}]}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','originals');git('update-ref','refs/remotes/origin/main','HEAD');
  for(const name of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])sql.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+name,import.meta.url),'utf8'));sql.exec('CREATE TABLE release_queue_runtime (id INTEGER PRIMARY KEY,version INTEGER,document TEXT)');sql.prepare('INSERT INTO release_queue_runtime VALUES (1,1,?)').run('{"overrides":{}}');
  const db=new SqliteD1Database(sql),repo=new ScheduleRepository(db),observations=new Map<string,import('./substack-schedule').ScheduleObservation>();
  for(const [slug,id] of originals){const source=await buildScheduledSource(root,slug);await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:slug,slug,remoteId:id,version:0,sourceRevision:source.sourceRevision,legacyPublished:true,observedState:'published_unverified',publicationMinute:'2026-10-18T23:00:00Z',pendingAction:'sync-content',lastErrorCode:'SUBSTACK_PUBLIC_EVIDENCE_MISMATCH',delivery:'not_armed',updatedAt:'before'},0);const actual=expectedContent(source);actual.description='Provider preview';actual.html=actual.html.replace(/(<\/code><\/pre>)/,' $1');observations.set(id,{id,slug,state:'published',saved:true,content:actual,canonical:'https://gcakedev.substack.com/p/'+slug,publishedAt:'2026-10-18T23:00:00Z'});}
  let reads=0;const rows=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T00:00:00Z',async(id)=>{reads++;return observations.get(id)!;});
  assert.equal(reads,3);assert.ok(rows.every(r=>r.status==='observed'&&r.code===undefined));for(const s of await repo.list()){assert.equal(s.pendingAction,undefined);assert.equal(s.verification?.status,'presentation_only');assert.equal(s.contentVerifiedRevision,undefined);}
  const feed=path.join(out,'status.json');await fs.writeFile(feed,JSON.stringify({schema:1,issues:originals.map(([slug])=>({slug,code:'SUBSTACK_CONTENT_SYNC_REQUIRED'}))}));await publishAttentionSnapshot(feed,{status:'completed',results:rows},[]);assert.deepEqual(JSON.parse(await fs.readFile(feed,'utf8')).issues,[]);
  const prior=JSON.stringify({schema:1,issues:[{slug:'genuine-unresolved',code:'SUBSTACK_CONTENT_SYNC_REQUIRED'}]});await fs.writeFile(feed,prior);const failed=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T01:00:00Z',async()=>{throw Error('network failure');});assert.ok(failed.every(r=>r.status==='blocked'&&r.code==='SUBSTACK_PUBLIC_VERIFICATION_INCONCLUSIVE'));assert.equal((await publishAttentionSnapshot(feed,{status:'attention',results:failed},[])).status,'retained');assert.equal(await fs.readFile(feed,'utf8'),prior);
 }finally{sql.close();await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});

test('same-time queue revision clears a false postpone attention without changing the armed provider commitment',async()=>{
 const {execFileSync}=await import('node:child_process');const {DatabaseSync}=await import('node:sqlite');const {SqliteD1Database}=await import('./sqlite-d1');const {ScheduleRepository}=await import('../../apps/admin-worker/src/substack-schedules');const {observeSubstackSchedules}=await import('./observe-substack-schedules');const {buildScheduledSource}=await import('./scheduled-source');const {contentFingerprint,expectedContent}=await import('./substack-schedule');const {publishAttentionSnapshot}=await import('./distribution-attention');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'queue-attention-')),out=await fs.mkdtemp(path.join(os.tmpdir(),'queue-attention-feed-')),sql=new DatabaseSync(':memory:');
 try{
  const slug='ithome-2026-publishing-in-production',when='2026-10-22T07:00:00+08:00',observed='2026-10-21T23:00:00.000Z';await fs.mkdir(path.join(root,'src/content/posts'),{recursive:true});await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});await fs.writeFile(path.join(root,'src/content/posts',slug+'.md'),'---\ntitle: Production publishing\nstatus: ready\n---\nComplete article.\n');await fs.writeFile(path.join(root,'src/content/series/series.yaml'),JSON.stringify({slug:'series',sections:[{posts:[{slug,status:'ready'}]}]}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});git('init');git('remote','add','origin','https://github.com/gcake119/gcake-dev.git');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','article');git('update-ref','refs/remotes/origin/main','HEAD');
  for(const name of ['0003_publication_operations.sql','0006_distribution_checkpoints.sql','0007_substack_schedules.sql'])sql.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/'+name,import.meta.url),'utf8'));sql.exec('CREATE TABLE release_queue_runtime (id INTEGER PRIMARY KEY,version INTEGER,document TEXT)');sql.prepare('INSERT INTO release_queue_runtime VALUES (1,165,?)').run(JSON.stringify({overrides:{[slug]:when}}));
  const db=new SqliteD1Database(sql),repo=new ScheduleRepository(db),source=await buildScheduledSource(root,slug),slot={reservationId:'fixed:'+slug+':'+when,queueVersion:162,slug,scheduledAt:when,confirmed:true};
  await repo.save({policyVersion:'scheduled-source-first-delivery-v1',scheduleId:slug,slug,remoteId:'221098688',sourceRevision:source.sourceRevision,contentVerifiedRevision:source.sourceRevision,contentDigest:contentFingerprint(expectedContent(source)),version:0,observedState:'scheduled',observedTime:observed,slot,pendingAction:'postpone-schedule',desiredTime:when,delivery:'armed',emailEnabled:true,appInboxEnabled:true,updatedAt:'before'},0);
  let reads=0;const rows=await observeSubstackSchedules(root,db,{} as never,'2026-10-19T00:00:00Z',async()=>{reads++;throw Error('pre-due public read forbidden');});assert.equal(rows[0].status,'observed');assert.equal(rows[0].code,undefined);assert.equal(rows[0].operation,'observe-schedule');assert.equal(rows[0].stillArmedUntilConfirmed,true);assert.equal(reads,0);
  const s=(await repo.get(slug))!;assert.equal(s.pendingAction,undefined);assert.equal(s.remoteId,'221098688');assert.equal(s.observedTime,observed);assert.deepEqual(s.slot,slot);assert.equal(s.emailEnabled,true);assert.equal(s.appInboxEnabled,true);assert.equal(s.delivery,'armed');assert.equal(s.intent,undefined);
  const feed=path.join(out,'status.json');await fs.writeFile(feed,JSON.stringify({schema:1,issues:[{slug,code:'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED'}]}));await publishAttentionSnapshot(feed,{status:'completed',results:rows},[]);assert.deepEqual(JSON.parse(await fs.readFile(feed,'utf8')).issues,[]);
 }finally{sql.close();await fs.rm(root,{recursive:true,force:true});await fs.rm(out,{recursive:true,force:true});}
});
