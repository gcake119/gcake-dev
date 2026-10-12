import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {chromium} from 'playwright';
import {D1PublicationRepository} from '../../apps/admin-worker/src/publication-operations';
import {DistributionCoordinator} from '../../apps/admin-worker/src/distribution-coordinator';
import {SqliteD1Database} from './sqlite-d1';
import {AttendedSubstackAdapter,FileAttendedExchange,anonymousSubstackReader} from './substack-attended';
import type {SubstackUiContract} from './substack-browser';
const origin='https://gcakedev.substack.com';
const remote={id:'123',url:origin+'/publish/post/123'},publicRemote={id:'123',url:origin+'/p/trial'};
test('file handoff → real Chrome saved editor → SQLite state → anonymous public read, without newsletter or duplicate publish',{timeout:60_000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-side-e2e-'));
 const db=new DatabaseSync(path.join(dir,'state.sqlite'));
 let saved={title:'',html:'',date:''},published=false,creates=0,publishes=0,sends=0;
 const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://localhost');
  const body=async()=>{let raw='';for await(const chunk of req)raw+=chunk;return JSON.parse(raw);};
  res.setHeader('content-type','text/html; charset=utf-8');
  if(url.pathname==='/create'){creates++;res.writeHead(302,{location:'/editor'});res.end();return;}
  if(url.pathname==='/save'){saved={...saved,...await body()};res.end('ok');return;}
  if(url.pathname==='/publish'){const b=await body();publishes++;if(b.email)sends++;published=true;res.end('ok');return;}
  if(url.pathname==='/home'){res.end('<h1>Authenticated fixture</h1><button onclick="location.href=\'/create\'">Create</button>');return;}
  if(url.pathname==='/editor'){res.end(`<input aria-label="Title" id="title" value="${escape(saved.title)}"><div aria-label="Body" role="textbox" contenteditable id="body">${saved.html}</div><button id="saved">Saved</button><input aria-label="Date" id="date" value="${escape(saved.date)}"><button onclick="save()">Save</button><label><input id="email" type="checkbox" checked>Send email</label><button onclick="publish()">Publish</button><script>async function save(){saved.hidden=true;await fetch('/save',{method:'POST',body:JSON.stringify({title:title.value,html:body.innerHTML,date:date.value})});saved.hidden=false;}async function publish(){await fetch('/publish',{method:'POST',body:JSON.stringify({email:email.checked})});location.href='/p/trial';}</script>`);return;}
  if(url.pathname==='/p/trial'&&published){assert.equal(req.headers.cookie,undefined);res.end(`<link rel="canonical" href="${publicRemote.url}"><h1 class="post-title">${escape(saved.title)}</h1><time datetime="${saved.date}"></time><article>${saved.html}</article>`);return;}
  res.writeHead(404);res.end('missing');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const local=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();
 try{
  db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql',import.meta.url),'utf8'));
  db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0006_distribution_checkpoints.sql',import.meta.url),'utf8'));
  const repository=new D1PublicationRepository(new SqliteD1Database(db));
  const article={slug:'trial',title:'Full saved title',sourceRevision:'r1',body:'# Heading\n\nFull **body** [Original](https://gcake119.github.io/gcake-dev/posts/trial/)',publishedAt:'2026-09-27T16:00:00Z',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/trial/',assets:[]};
  const approval={target:'substack' as const,slug:article.slug,sourceRevision:article.sourceRevision,approved:true as const,newsletter:'skip' as const,substackPolicy:'full-mirror' as const};
  const evidence=async()=>({id:remote.id,url:remote.url,title:await page.getByRole('textbox',{name:'Title',exact:true}).inputValue(),text:await page.locator('#body').innerText(),links:await page.locator('#body a').evaluateAll(elements=>elements.map(e=>(e as HTMLAnchorElement).href)),images:[],saved:await page.locator('#saved').isVisible()});
  const session=await FileAttendedExchange.create(dir,process.cwd(),10_000,5,async file=>{
   const envelope=JSON.parse(await fs.readFile(file,'utf8')),request=envelope.request;
   let result:unknown;
   if(['create','update','publish','metadata'].includes(request.action))assert.equal((await repository.runtime.checkpoint(article.slug,'substack'))?.operation,request.action);
   if(request.action==='preflight'){await page.goto(local+'/home');result={origin,loggedIn:true};}
   else if(request.action==='find')result={complete:true,scanned:['draft','published','scheduled'],items:[]};
   else if(request.action==='create'){await page.getByRole('button',{name:'Create',exact:true}).click();await page.waitForURL(local+'/editor');result=remote;}
   else if(request.action==='update'){await page.goto(local+'/editor');await page.getByRole('textbox',{name:'Title',exact:true}).fill(article.title);await page.locator('#body').evaluate((element,html)=>{element.innerHTML=html;},request.html);await page.getByRole('textbox',{name:'Date',exact:true}).fill(article.publishedAt);await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('saved')!.hidden);await page.reload();result=await evidence();}
   else if(request.action==='readDraft'){await page.goto(local+'/editor');result=await evidence();}
   else if(request.action==='checkPublish'){await page.locator('#email').uncheck();result={...await evidence(),emailDisabled:!await page.locator('#email').isChecked(),scheduleDisabled:true};}
   else if(request.action==='publish'){assert.equal(await page.locator('#email').isChecked(),false);await page.getByRole('button',{name:'Publish',exact:true}).click();await page.waitForURL(local+'/p/trial');result={...publicRemote,emailDisabled:true,scheduleDisabled:true};}
   else throw Error('unexpected fixture action '+request.action);
   await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...envelope,ok:true,result}),{flag:'wx',mode:0o600});
  });
  const ui={publicBody:'article',publicTitle:'.post-title',publicDate:'time'} as SubstackUiContract;
  const publicReader=anonymousSubstackReader(ui,((url,init)=>fetch(local+new URL(String(url)).pathname,init)) as typeof fetch);
  const coordinator=(op:'prepare'|'publish')=>new DistributionCoordinator(repository,new AttendedSubstackAdapter(article,op,repository.runtime,session.exchange,publicReader));
  assert.equal((await coordinator('prepare').run(article,'substack','prepare',approval)).status,'prepare_ready');
  assert.equal(publishes,0);
  assert.equal((await coordinator('publish').run(article,'substack','publish',approval)).status,'verified');
  assert.equal((await coordinator('publish').run(article,'substack','publish',approval)).status,'verified');
  assert.equal(creates,1);assert.equal(publishes,1);assert.equal(sends,0);
  assert.equal(await repository.runtime.checkpoint(article.slug,'substack'),undefined);
 }finally{await context.close();await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();await fs.rm(dir,{recursive:true,force:true});}
});
