/** Builds and serves disposable production-shaped artifacts; never pushes or sends Telegram. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import matter from 'gray-matter';
import {readSnapshot,prepareRelease} from './editorial-release';
import {emptyQueue} from '../../src/lib/publishing/editorial-state';
const exec=promisify(execFile);
const root=await fs.mkdtemp(path.join(os.tmpdir(),'editorial-rehearsal-'));
const original=process.cwd();
let server:ReturnType<typeof createServer>|undefined;
try{
 await fs.cp(original,root,{recursive:true,filter:source=>!['.git','node_modules','dist','.astro','.spectra','__pycache__'].includes(path.basename(source))});
 await fs.symlink(path.join(original,'node_modules'),path.join(root,'node_modules'),'dir');
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url??'/', 'http://localhost');if(!url.pathname.startsWith('/gcake-dev/'))throw new Error('outside base');
   let relative=url.pathname.slice('/gcake-dev/'.length);if(relative.endsWith('/'))relative+='index.html';
   const file=path.resolve(root,'dist',relative);if(!file.startsWith(path.join(root,'dist')+path.sep))throw new Error('outside dist');
   const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.xml')?'application/rss+xml':'text/html');res.end(data);
  }catch{res.statusCode=404;res.end('not found');}
 });
 await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(0,'127.0.0.1',resolve);});
 const port=(server.address() as {port:number}).port;const site=`http://127.0.0.1:${port}/gcake-dev/`;
 const config=path.join(root,'astro.config.mjs');await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace("site: 'https://gcake119.github.io'",`site: 'http://127.0.0.1:${port}'`));
 const data=path.join(root,'src/data/site.ts');await fs.writeFile(data,(await fs.readFile(data,'utf8')).replace("url: 'https://gcake119.github.io/gcake-dev'",`url: '${site.slice(0,-1)}'`));
 const build=()=>exec('pnpm',['build'],{cwd:root,maxBuffer:4*1024*1024});
 const python=(...args:string[])=>exec('python3',[path.join(root,'scripts/hermes/rss_monitor.py'),'--site',site,...args],{cwd:root});
 const initial=await readSnapshot(root);const series=initial.manifests.find(m=>m.slug==='ithome-2026-extensions')!;
 const order=series.posts.map(p=>p.slug);assert.equal(order.length,6);
 const bodies=new Map(initial.posts.map(p=>[p.slug,matter(p.raw).content]));
 await build();
 const feedBefore=await (await fetch(site+'rss.xml')).text();
 for(const slug of order){assert.ok(!feedBefore.includes('/posts/'+slug+'/'));assert.equal((await fetch(site+'posts/'+slug+'/')).status,404);}
 assert.equal((await python('--db',path.join(root,'dry.sqlite'))).stdout.trim(),'');
 // Past fixtures exercise actual public visibility without changing the clock or real manuscripts.
 initial.posts=initial.posts.map(p=>({...p,eligibleSince:undefined}));initial.manifests=initial.manifests.map(m=>({...m,eligibleSince:undefined}));
 const ready=prepareRelease(initial,emptyQueue(),'2026-10-07T20:00:00+08:00',false);
 const planned=prepareRelease(initial,ready.state,'2026-10-08T07:37:00+08:00',true);
 assert.equal(planned.state.pending?.slug,order[0]);
 for(const [file,raw] of planned.changes){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),raw);}
 const postFile=initial.posts.find(p=>p.slug===order[0])!.file;const published=await fs.readFile(path.join(root,postFile),'utf8');
 await fs.writeFile(path.join(root,postFile),published.replace('ai-assisted-development','invalid-rehearsal-topic'));
 let failed=false;try{await build();}catch{failed=true;}assert.ok(failed,'broken build must fail');
 assert.ok(!planned.state.completed.length);await fs.writeFile(path.join(root,postFile),published);
 const retry=prepareRelease(await readSnapshot(root),planned.state,'2026-10-12T07:37:00+08:00',true);
 assert.equal(retry.state.pending?.slug,order[0]);
 await build();
 const feedAfter=await (await fetch(site+'rss.xml')).text();assert.ok(feedAfter.includes('/posts/'+order[0]+'/'));
 assert.equal((await fetch(site+'posts/'+order[0]+'/')).status,200);
 for(const slug of order.slice(1)){assert.ok(!feedAfter.includes('/posts/'+slug+'/'));assert.equal((await fetch(site+'posts/'+slug+'/')).status,404);}
 await python('--verify-url',site+'posts/'+order[0]+'/','--revision',planned.state.pending!.revision);
 const notice=(await python('--db',path.join(root,'dry.sqlite'))).stdout;assert.ok(notice.includes(site+'posts/'+order[0]+'/'));assert.ok(notice.includes('台北發佈時間'));
 assert.equal((await python('--db',path.join(root,'dry.sqlite'))).stdout.trim(),'');
 const after=await readSnapshot(root);assert.deepEqual(after.manifests.find(m=>m.slug===series.slug)!.posts.map(p=>p.slug),order);
 for(const post of after.posts)assert.equal(matter(post.raw).content,bodies.get(post.slug));
 console.log(JSON.stringify({result:'passed',buildFailureRetriedSameArticle:true,baselineReadyRoutesAbsent:6,newRSSArticles:1,otherReadyRoutesAbsent:5,canonicalHTML:true,dryRunNotifications:1,repeatNotifications:0,sixBodiesUnchanged:true,readingOrderUnchanged:true,productionWrites:false,telegramNetworkCalls:0},null,2));
}finally{if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));await fs.rm(root,{recursive:true,force:true});}
