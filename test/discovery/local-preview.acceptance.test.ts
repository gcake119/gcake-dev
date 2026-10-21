import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import { createLocalSearch, previewHtml, decodeCachedVector } from '../../scripts/discovery/local-search';
const corpus=buildPublicDiscovery(Array.from({length:12},(_,i)=>({source:'local',id:String(i),title:'workflow '+i,href:'/gcake-dev/posts/'+i+'/',canonicalUrl:'https://example.org/'+i,status:'published',publishedAt:'2026-01-01',topics:[i<6?'a':'b'],series:'test',html:'<p>workflow recovery '+i+'</p>'})),{now:'2026-10-21T00:00:00Z',sourceTree:'test',snapshotDigest:'test',baseUrl:'https://example.org/gcake-dev'});
const index={space:{corpusId:corpus.corpusId,modelConfig:'test',dimensions:2},items:corpus.passages.map(p=>({articleId:p.articleId,passageId:p.passageId,revision:p.revision})),vectors:corpus.passages.map(()=>new Float32Array([1,0]))};
const request=(body:unknown,origin='http://127.0.0.1:1234')=>new Request('http://127.0.0.1:1234/gcake-dev/local-search',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const body={q:'workflow',corpusId:corpus.corpusId,page:1,limit:10,sort:'relevance',topic:'',series:''};
test('Local preview returns real contract with filtered pagination and source passages',async()=>{let calls=0;const run=createLocalSearch(corpus,index,async()=>{calls++;return [1,0];});const r=await run(request(body));assert.equal(r.status,200);const data=await r.json();assert.equal(data.mode,'hybrid');assert.equal(data.total,12);assert.equal(data.results.length,10);const page=await (await run(request({...body,page:2}))).json();assert.equal(page.results.length,2);assert.ok(page.results.every((r:any)=>!data.results.some((p:any)=>p.articleId===r.articleId)));const filtered=await (await run(request({...body,topic:'a'}))).json();assert.equal(filtered.total,6);assert.ok(filtered.results.every((r:any)=>corpus.articles.find(a=>a.articleId===r.articleId)?.topics.includes('a')));assert.equal(calls,3);});
test('Bad local requests, stale corpus and paused service perform zero inference',async()=>{let calls=0;const run=createLocalSearch(corpus,index,async()=>{calls++;return [1,0];},()=>false);for(const value of [{...body,q:''},{...body,q:'字'.repeat(201)},{...body,page:0},{...body,limit:11},{...body,sort:'evil'},{...body,topic:{}},{...body,q:'a'.repeat(5000)}])assert.equal((await run(request(value))).status,400);assert.equal((await run(request({...body,corpusId:'stale'}))).status,409);assert.equal((await run(request(body,'https://evil.example'))).status,403);assert.equal((await run(request(body))).status,503);assert.equal(calls,0);});
test('Cancellation, overload and retry recover without changing article identity',async()=>{let release:()=>void=()=>{};const run=createLocalSearch(corpus,index,signal=>new Promise<number[]>((resolve,reject)=>{release=()=>resolve([1,0]);signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});}),()=>true,20);const first=run(request(body));await new Promise(r=>setTimeout(r,1));assert.equal((await run(request(body))).status,429);assert.equal((await first).status,503);const recovered=run(request(body));await new Promise(r=>setTimeout(r,1));release();assert.equal((await recovered).status,200);});
test('Preview rewrites only its served copy and rejects corrupt cached vectors',()=>{const original='<ul data-semantic=""></ul>';const rewritten=previewHtml(original);assert.match(rewritten,/data-semantic="\/gcake-dev\/local-search"/);assert.doesNotMatch(rewritten,/本機測試|search-privacy/);assert.match(rewritten,/data-local-semantic="true"/);assert.match(original,/data-semantic=""/);assert.throws(()=>decodeCachedVector(Buffer.alloc(8),2));assert.throws(()=>decodeCachedVector(Buffer.alloc(4),2));const b=Buffer.alloc(8);b.writeFloatLE(1,0);assert.deepEqual([...decodeCachedVector(b,2)],[1,0]);});


import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewEvidence } from '../../scripts/discovery/preview-evidence';
test('Repeated foreground previews retain independent start, status and finish receipts',async()=>{
    const root=await mkdtemp(join(tmpdir(),'gcake-preview-evidence-'));
    try{const first=await createPreviewEvidence(root);
        for(const name of ['started.json','status.json','finished.json'])await first.save(name,{run:'first',name});
        const second=await createPreviewEvidence(root);
        for(const name of ['started.json','status.json','finished.json'])await second.save(name,{run:'second',name});
        for(const name of ['started.json','status.json','finished.json']){assert.equal(JSON.parse(await readFile(join(first.path,name),'utf8')).run,'first');assert.equal(JSON.parse(await readFile(join(second.path,name),'utf8')).run,'second');}
        assert.notEqual(first.path,second.path);
    }finally{await rm(root,{recursive:true,force:true});}
});
