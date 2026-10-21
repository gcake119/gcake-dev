/** Explicit foreground loopback preview. No deployment or persistent service configuration. */
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { digest } from '../../src/lib/discovery/build';
import type { Corpus } from '../../src/lib/discovery/types';
import { OllamaEmbeddingClient, formatInput, type PinnedModel, type LocalIndex } from './ollama';
import { createLocalSearch, decodeCachedVector, previewHtml } from './local-search';
import { createPreviewEvidence } from './preview-evidence';
if(process.argv.slice(2).length!==1||process.argv[2]!=='--run')throw Error('FOREGROUND_PREVIEW_REQUIRES_--run');
const root=await realpath('dist'),experiment=resolve('output/discovery/ollama/comparison-20261021');
const evidenceRun=await createPreviewEvidence(resolve('output/discovery/local-preview'));
const evidence=evidenceRun.path;
const manifestText=await readFile(join(root,'discovery-manifest.json'),'utf8'),manifest=JSON.parse(manifestText),plan=JSON.parse(await readFile(join(experiment,'plan.json'),'utf8'));
// UI-only rebuilds can change the manifest; source/corpus/config and each asset must still match the pinned vector space.
const asset=async(kind:string)=>{const href=manifest.assets[kind].href;assert.ok(href.startsWith('/gcake-dev/discovery/')&&!href.includes('..'));const path=await realpath(join(root,href.replace('/gcake-dev/','')));assert.ok(path.startsWith(root+sep));const text=await readFile(path,'utf8');assert.equal(digest(text),manifest.assets[kind].digest);return JSON.parse(text);};
const corpus:Corpus=await asset('index');corpus.passages=await asset('passages');
assert.equal(corpus.corpusId,manifest.corpusId);assert.equal(corpus.corpusId,plan.corpusId);assert.equal(corpus.configurationDigest,plan.configurationDigest);
const profile:PinnedModel={name:'bge-m3:latest',dimensions:1024,format:'plain-title-text-v1',digest:'7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab'};
const client=new OllamaEmbeddingClient(),before=await client.snapshot();
await client.verify(profile);const show=await client.show(profile);
const modelConfig=digest({profile,corpusId:corpus.corpusId,ollama:before.version,details:show.details,truncate:false,normalization:'l2-f32le',documentInformation:'same-article-title-and-passage'});
const saved=(JSON.parse(await readFile(join(experiment,'indexes.json'),'utf8')) as {model:string;space:LocalIndex['space']}[]).find(x=>x.model===profile.name)!;
assert.deepEqual(saved.space,{corpusId:corpus.corpusId,modelConfig,dimensions:1024},'VECTOR_SPACE_MISMATCH');
const index:LocalIndex={space:saved.space,items:corpus.passages.map(p=>({articleId:p.articleId,passageId:p.passageId,revision:p.revision})),vectors:[]};
for(const p of corpus.passages){const text=formatInput(profile,'document',p.text,corpus.articles.find(a=>a.articleId===p.articleId)!.title);index.vectors.push(decodeCachedVector(await readFile(join(experiment,'cache',modelConfig,digest({space:index.space,text})+'.f32')),1024));}
const owned=!(before.loaded.models??[]).some((m:{name:string})=>m.name===profile.name);
const counts={semanticRequests:0,embeddingCalls:0,embeddingCompleted:0,embeddingFailed:0,cloudCalls:0,generationCalls:0,downloadCalls:0};
let paused=false,used=false,stopping=false;
const active=new Set<AbortController>();
const handler=createLocalSearch(corpus,index,async(signal,q)=>{
    await client.verify(profile);
    if(signal.aborted)throw Error('ABORTED');
    used=true;counts.embeddingCalls++;
    try{const value=await client.embed(profile,[formatInput(profile,'query',q)],signal);counts.embeddingCompleted++;return value.vectors[0];}
    catch(e){counts.embeddingFailed++;throw e;}
},()=>!paused);
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
let origin='';
const server=createServer(async(req,res)=>{
    const reply=(status:number,text:string,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(text);};
    const controller=new AbortController();active.add(controller);
    req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    const bodyTimer=setTimeout(()=>{controller.abort();if(!res.headersSent)reply(408,'REQUEST_TIMEOUT');req.destroy();},5000);
    try{
        if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)){reply(403,'LOOPBACK_ORIGIN_ONLY');return;}
        const url=new URL(req.url??'/',origin);
        if(url.pathname==='/gcake-dev/local-search'){
            counts.semanticRequests++;
            if(req.method!=='POST'){reply(405,'POST_ONLY');return;}
            const chunks:Buffer[]=[];let size=0;
            for await(const chunk of req){size+=chunk.length;if(size>4096){reply(400,'BODY_LIMIT');return;}chunks.push(Buffer.from(chunk));}
            clearTimeout(bodyTimer);
            const response=await handler(new Request(url,{method:'POST',headers:{origin:req.headers.origin??origin},body:Buffer.concat(chunks),signal:controller.signal}));
            reply(response.status,await response.text(),'application/json; charset=utf-8');return;
        }
        if(!['GET','HEAD'].includes(req.method??'')){reply(405,'READ_ONLY');return;}
        if(!url.pathname.startsWith('/gcake-dev/')){reply(404,'NOT_FOUND');return;}
        const relative=decodeURIComponent(url.pathname.slice('/gcake-dev/'.length));
        let path=await realpath(join(root,relative));if(!path.startsWith(root+sep)&&path!==root)throw Error('PATH_BOUNDARY');
        if((await stat(path)).isDirectory())path=await realpath(join(path,'index.html'));
        if(!path.startsWith(root+sep))throw Error('PATH_BOUNDARY');
        const type=mime[extname(path)]??'application/octet-stream',bytes=await readFile(path);
        res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        res.end(req.method==='HEAD'?undefined:type.startsWith('text/html')?previewHtml(bytes.toString('utf8')):bytes);
    }catch{if(!res.headersSent)reply(404,'NOT_FOUND');else res.end();}finally{clearTimeout(bodyTimer);active.delete(controller);}
});
const save=evidenceRun.save;
await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
const identity={origin,corpusId:corpus.corpusId,configurationDigest:corpus.configurationDigest,manifestDigest:digest(manifestText),model:profile,space:index.space,articles:corpus.articles.length,passages:index.items.length,documentEmbeddings:0,loadedBefore:before.loaded,startedAt:new Date().toISOString(),sourceDigests:Object.fromEntries(await Promise.all(['scripts/discovery/local-preview.ts','scripts/discovery/local-search.ts','scripts/discovery/ollama.ts','scripts/discovery/preview-evidence.ts'].map(async p=>[p,digest(await readFile(p,'utf8'))])))};
await save('started.json',identity);
console.log(JSON.stringify({status:'READY',url:origin+'/gcake-dev/search/',evidence,commands:'pause | resume | status | stop',...counts}));
const input=createInterface({input:process.stdin});
const lifetime=setTimeout(()=>void stop('lifetime'),30*60*1000);
async function stop(reason:string){
    if(stopping)return;stopping=true;paused=true;clearTimeout(lifetime);input.close();process.stdin.destroy();for(const c of active)c.abort();server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    let released=false,error:string|undefined;
    if(owned&&used)try{await client.release(profile);released=true;}catch(e){error=String(e);process.exitCode=1;}
    let loadedAfter:unknown;try{loadedAfter=(await client.snapshot()).loaded;}catch(e){error=String(e);process.exitCode=1;}
    const receipt={...identity,endedAt:new Date().toISOString(),reason,counts,listenerClosed:!server.listening,ownedModel:owned,released,loadedAfter,error,sharedDaemonUnchanged:true};
    await save('finished.json',receipt);console.log(JSON.stringify({status:'STOPPED',counts,listenerClosed:!server.listening,released,error}));
}
input.on('line',line=>{if(line==='pause')paused=true;else if(line==='resume')paused=false;else if(line==='stop')void stop('stdin');console.log(JSON.stringify({paused,...counts}));void save('status.json',{paused,...counts});});
input.on('close',()=>{if(!stopping)void stop('stdin-closed');});
process.once('SIGINT',()=>void stop('SIGINT'));process.once('SIGTERM',()=>void stop('SIGTERM'));
