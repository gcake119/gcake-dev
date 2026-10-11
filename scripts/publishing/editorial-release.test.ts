import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import {execFileSync} from 'node:child_process';
import {readSnapshot,prepareRelease,commitChanges,pushRelease,verifyPublic} from './editorial-release';
import {emptyQueue} from '../../src/lib/publishing/editorial-state';
async function fixture(t:any){const root=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'src/content/posts/nested'),{recursive:true});await fs.mkdir(path.join(root,'src/content/series'),{recursive:true});for(const slug of ['a','b'])await fs.writeFile(path.join(root,'src/content/posts/nested',slug+'.md'),`---\ntitle: ${slug}\ndescription: description\nstatus: ready\ntopics: [ai]\n---\n\nBody ${slug} untouched.\n`);await fs.writeFile(path.join(root,'src/content/series/s.yaml'),'slug: s\nsource: {type: local}\nsections:\n  - id: one\n    posts:\n      - {slug: a, status: ready}\n      - {slug: b, status: ready}\n');return root;}
test('CMS-shaped content prepares one coherent post/manifest/journal update without body changes',async t=>{
 const root=await fixture(t);let snap=await readSnapshot(root);
 const first=prepareRelease(snap,emptyQueue(),'2026-10-11T20:00:00+08:00',false);
 const before=snap.posts.find(p=>p.slug==='a')!.raw;
 const plan=prepareRelease(snap,first.state,'2026-10-12T07:37:00+08:00',true);
 assert.equal(plan.state.pending?.slug,'a');assert.equal(plan.changes.size,3);
 const raw=plan.changes.get('src/content/posts/nested/a.md')!;
 assert.equal(matter(raw).content,matter(before).content);
 assert.equal(matter(raw).data.status,'published');assert.equal(matter(raw).data.publishedAt,'2026-10-12T07:00:00+08:00');
 const manifest=YAML.parse(plan.changes.get('src/content/series/s.yaml')!);
 assert.deepEqual(manifest.sections[0].posts.map((p:any)=>[p.slug,p.status]),[['a','published'],['b','ready']]);
 for(const [file,value] of plan.changes){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),value);}
 snap=await readSnapshot(root);
 const retry=prepareRelease(snap,plan.state,'2026-10-15T07:37:00+08:00',true);
 assert.equal(retry.state.pending?.slug,'a');assert.equal(retry.changes.size,0);
});
test('real six-body preservation and manifest completeness with disabled preparation',async()=>{
 const snap=await readSnapshot(process.cwd());const group=snap.manifests.find(m=>m.slug==='ithome-2026-extensions')!;
 assert.equal(group.posts.length,6);
 // Exercise the original all-ready contract after later legitimate publications too.
 const members=new Set(group.posts.map(p=>p.slug));
 snap.posts=snap.posts.map(p=>members.has(p.slug)?{...p,status:'ready',publishedAt:undefined}:p);
 group.posts=group.posts.map(p=>({...p,status:'ready'}));
 const plan=prepareRelease(snap,emptyQueue(),'2026-10-11T20:00:00+08:00',false);
 assert.equal(plan.state.pending,undefined);assert.equal(plan.changes.size,1);
 assert.ok(plan.state.groups['series:ithome-2026-extensions']);
});
test('optimistic Git transaction refuses CMS race and writes disabled by default',async t=>{
 const root=await fixture(t);const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('add','.');git('commit','-m','initial');
 const base=git('rev-parse','HEAD');
 assert.throws(()=>commitChanges(root,base,new Map([['src/data/editorial-queue.json','{}']]),false),/disabled/i);
 await fs.writeFile(path.join(root,'cms.txt'),'CMS update');git('add','cms.txt');git('commit','-m','CMS save');
 assert.throws(()=>commitChanges(root,base,new Map([['src/data/editorial-queue.json','{}']]),true),/conflict/i);
 assert.equal(await fs.readFile(path.join(root,'cms.txt'),'utf8'),'CMS update');
});
test('CMS commits within one polling interval retain first-ready FIFO across body edits',async t=>{
 const root=await fixture(t);await fs.rm(path.join(root,'src/content/series/s.yaml'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');
 const commit=(date:string)=>{git('add','.');execFileSync('git',['commit','-m','CMS save'],{cwd:root,env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}});};
 const file=path.join(root,'src/content/posts/nested/a.md');const original=await fs.readFile(file,'utf8');
 await fs.writeFile(file,original.replace('status: ready','status: draft'));commit('2026-10-11T10:00:00+08:00');
 await fs.writeFile(file,original);commit('2026-10-11T10:05:00+08:00');
 await fs.writeFile(path.join(root,'src/content/posts/nested/b.md'),(await fs.readFile(path.join(root,'src/content/posts/nested/b.md'),'utf8'))+'Body edit');commit('2026-10-11T10:10:00+08:00');
 const snap=await readSnapshot(root);const ingested=prepareRelease(snap,emptyQueue(),'2026-10-11T10:37:00+08:00',false);
 const reserved=prepareRelease(snap,ingested.state,'2026-10-12T07:00:00+08:00',true);
 assert.equal(reserved.state.pending?.slug,'b');
});
test('CMS content revision change during pending recovery is rejected',async t=>{
 const root=await fixture(t);const snap=await readSnapshot(root);
 const first=prepareRelease(snap,emptyQueue(),'2026-10-11T20:00:00+08:00',false);
 const planned=prepareRelease(snap,first.state,'2026-10-12T07:37:00+08:00',true);
 for(const [file,raw] of planned.changes){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),raw);}
 const file=path.join(root,'src/content/posts/nested/a.md');await fs.appendFile(file,'CMS edited body');
 const updated=await readSnapshot(root);
 assert.throws(()=>prepareRelease(updated,planned.state,'2026-10-15T07:00:00+08:00',true),/revision.*repair/i);
});
test('CMS draft and ready transitions between polls restart standalone FIFO eligibility',async t=>{
 const root=await fixture(t);await fs.rm(path.join(root,'src/content/series/s.yaml'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');
 const commit=(date:string)=>{git('add','.');execFileSync('git',['commit','-m','CMS save'],{cwd:root,env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}});};
 const a=path.join(root,'src/content/posts/nested/a.md'),b=path.join(root,'src/content/posts/nested/b.md');
 const original=await fs.readFile(a,'utf8');const bOriginal=await fs.readFile(b,'utf8');
 await fs.writeFile(b,bOriginal.replace('status: ready','status: draft'));commit('2026-10-11T10:00:00+08:00');
 const seeded=prepareRelease(await readSnapshot(root),emptyQueue(),'2026-10-11T10:01:00+08:00',false);
 await fs.writeFile(b,bOriginal);commit('2026-10-11T10:05:00+08:00');
 await fs.writeFile(a,original.replace('status: ready','status: draft'));commit('2026-10-11T10:10:00+08:00');
 await fs.writeFile(a,original);commit('2026-10-11T10:15:00+08:00');
 const snap=await readSnapshot(root);const ingested=prepareRelease(snap,seeded.state,'2026-10-11T10:37:00+08:00',false);
 const release=prepareRelease(snap,ingested.state,'2026-10-12T07:00:00+08:00',true);
 assert.equal(release.state.pending?.slug,'b');
 assert.equal(new Date(ingested.state.groups['post:a'].readyAt).toISOString(),'2026-10-11T02:15:00.000Z');
});
test('atomic Git release commits all changes and non-force push preserves a competing CMS commit',async t=>{
 const root=await fixture(t);const git=(cwd:string,...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(root,'init','-b','main');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');git(root,'add','.');git(root,'commit','-m','initial');
 const remote=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-remote-'));const cms=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-cms-'));t.after(()=>fs.rm(remote,{recursive:true,force:true}));t.after(()=>fs.rm(cms,{recursive:true,force:true}));
 git(root,'clone','--bare',root,remote);git(root,'remote','add','origin',remote);git(root,'clone',remote,cms);git(cms,'config','user.name','CMS');git(cms,'config','user.email','cms@example.invalid');
 const base=git(root,'rev-parse','HEAD');const snap=await readSnapshot(root);const seeded=prepareRelease(snap,emptyQueue(),'2026-10-11T20:00:00+08:00',false);const planned=prepareRelease(snap,seeded.state,'2026-10-12T07:00:00+08:00',true);
 await fs.writeFile(path.join(cms,'cms.txt'),'concurrent CMS content');git(cms,'add','.');git(cms,'commit','-m','CMS save');git(cms,'push','origin','main');
 const local=commitChanges(root,base,planned.changes,true);
 assert.notEqual(local,base);assert.equal(git(root,'diff-tree','--no-commit-id','--name-only','-r',local).split('\n').length,3);
 assert.throws(()=>git(root,'push','origin','HEAD:refs/heads/main'));
 assert.equal(git(remote,'show','main:cms.txt'),'concurrent CMS content');
 assert.throws(()=>git(remote,'show','main:src/data/editorial-queue.json'));
});

async function fakePush(t:any, remote:string){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-auth-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const output=path.join(root,'push.json');
 await fs.writeFile(path.join(root,'git'),`#!/usr/bin/env python3
import json,os,sys
if sys.argv[1:]==['branch','--show-current']: print(os.environ.get('TEST_PUSH_BRANCH','main'))
elif sys.argv[1:]==['remote','get-url','origin'] or sys.argv[1:]==['remote','get-url','--push','--all','origin']:
 with open(os.environ['TEST_PUSH_LOG']+'.remote','w') as f: json.dump({'rawToken':os.environ.get('EDITORIAL_GIT_TOKEN')},f)
 print(os.environ.get('TEST_PUSH_REMOTE',os.environ['TEST_REMOTE']) if '--push' in sys.argv else os.environ['TEST_REMOTE'])
else:
 with open(os.environ['TEST_PUSH_LOG'],'w') as f: json.dump({'args':sys.argv[1:],'header':os.environ.get('GIT_CONFIG_VALUE_0'),'redirects':os.environ.get('GIT_CONFIG_VALUE_1'),'rawToken':os.environ.get('EDITORIAL_GIT_TOKEN')},f)
 if os.environ.get('TEST_PUSH_FAILURE'): print('synthetic-token',file=sys.stderr); sys.exit(1)
`);
 await fs.chmod(path.join(root,'git'),0o700);
 const old={PATH:process.env.PATH,TEST_REMOTE:process.env.TEST_REMOTE,TEST_PUSH_LOG:process.env.TEST_PUSH_LOG,EDITORIAL_RELEASE_ENABLED:process.env.EDITORIAL_RELEASE_ENABLED};
 Object.assign(process.env,{PATH:root+path.delimiter+old.PATH,TEST_REMOTE:remote,TEST_PUSH_LOG:output,EDITORIAL_RELEASE_ENABLED:'true'});
 t.after(()=>{for(const [k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 return {root,output};
}
test('unattended writer refuses missing credentials before any push',async t=>{
 const f=await fakePush(t,'https://github.com/gcake119/gcake-dev.git');
 assert.throws(()=>pushRelease(f.root),/credential/i);
 await assert.rejects(fs.stat(f.output),/ENOENT/);
});
test('unattended writer refuses wrong destination before any authenticated push',async t=>{
 const f=await fakePush(t,'https://example.invalid/other.git');
 assert.throws(()=>pushRelease(f.root,'synthetic-token'),/destination/i);
 await assert.rejects(fs.stat(f.output),/ENOENT/);
});
test('unattended writer authenticates one non-force push without credential arguments or persisted Git config',async t=>{
 const f=await fakePush(t,'https://github.com/gcake119/gcake-dev.git');
 process.env.EDITORIAL_GIT_TOKEN='synthetic-token';t.after(()=>delete process.env.EDITORIAL_GIT_TOKEN);
 pushRelease(f.root,'synthetic-token');
 const event=JSON.parse(await fs.readFile(f.output,'utf8'));
 assert.deepEqual(event.args,['push','origin','HEAD:refs/heads/main']);
 assert.equal(event.header,'AUTHORIZATION: basic '+Buffer.from('x-access-token:synthetic-token').toString('base64'));
 assert.equal(event.rawToken,null);
 assert.equal(JSON.parse(await fs.readFile(f.output+'.remote','utf8')).rawToken,null);
 assert.equal(event.redirects,'false');
 assert.equal(process.env.GIT_CONFIG_VALUE_0,undefined);
});

test('push errors never expose transport credentials',async t=>{
 const f=await fakePush(t,'https://github.com/gcake119/gcake-dev.git');
 process.env.TEST_PUSH_FAILURE='true';t.after(()=>delete process.env.TEST_PUSH_FAILURE);
 assert.throws(()=>pushRelease(f.root,'synthetic-token'),error=>{assert.doesNotMatch(String(error),/synthetic-token/);return true;});
});

test('public verification subprocess never receives the App credential',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-verify-env-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const old=process.env.PATH;process.env.PATH=root+path.delimiter+old;process.env.EDITORIAL_GIT_TOKEN='synthetic-token';
 t.after(()=>{process.env.PATH=old;delete process.env.EDITORIAL_GIT_TOKEN;});
 const output=path.join(root,'credential-present');
 await fs.writeFile(path.join(root,'python3'),`#!/bin/sh
if [ -n "\${EDITORIAL_GIT_TOKEN:-}" ]; then touch '${output}'; fi
`);await fs.chmod(path.join(root,'python3'),0o700);
 await verifyPublic(root,'https://gcake119.github.io/gcake-dev/posts/test/','synthetic-revision');
 await assert.rejects(fs.stat(output),/ENOENT/);
});

test('writer refuses overridden or multiple push URLs despite an allowed fetch URL',async t=>{
 const f=await fakePush(t,'https://github.com/gcake119/gcake-dev.git');
 t.after(()=>delete process.env.TEST_PUSH_REMOTE);
 for(const remote of ['https://example.invalid/other.git','https://github.com/gcake119/gcake-dev.git\nhttps://example.invalid/other.git']){
  process.env.TEST_PUSH_REMOTE=remote;
  assert.throws(()=>pushRelease(f.root,'synthetic-token'),/destination/i);
  await assert.rejects(fs.stat(f.output),/ENOENT/);
 }
});

test('direct push interface cannot bypass production activation or main branch',async t=>{
 const f=await fakePush(t,'https://github.com/gcake119/gcake-dev.git');
 process.env.EDITORIAL_RELEASE_ENABLED='false';
 assert.throws(()=>pushRelease(f.root,'synthetic-token'),/disabled/i);
 process.env.EDITORIAL_RELEASE_ENABLED='true';process.env.TEST_PUSH_BRANCH='feat/test';
 t.after(()=>delete process.env.TEST_PUSH_BRANCH);
 assert.throws(()=>pushRelease(f.root,'synthetic-token'),/main/i);
 await assert.rejects(fs.stat(f.output),/ENOENT/);
});
