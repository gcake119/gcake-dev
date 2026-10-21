import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRelease, promoteRelease } from '../../scripts/discovery/lifecycle';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import { search } from '../../src/lib/discovery/search';
import { createSearchService, approvedModel, type SearchPolicy } from '../../apps/search-worker/src/service';
import { MemoryAdmission } from '../../apps/search-worker/src/admission';
const build = (html: string) => buildPublicDiscovery([{ source: 'local', id: 'a', title: 'A', status: 'published', href: '/gcake-dev/posts/a/', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/a/', topics: [], html }], { now: '2026-10-21T00:00:00Z', sourceTree: 'tree', snapshotDigest: 'snapshot', baseUrl: 'https://gcake119.github.io/gcake-dev' });
test('Stage changed-only content, read-after-write readiness and verified deployed promotion', async () => { const a = build('<p>oldword</p>'), b = build('<p>newword</p>'); let embedded = 0; const adapter = { embed: async () => { embedded++; return Array.from({ length: 1024 }, () => 1); }, upsert: async () => { }, ready: async () => true }; const cache = new Map(); const first = await stageRelease(a, 'model-v1', adapter, cache, 5000000); assert.equal(embedded, a.passages.length); await stageRelease(a, 'model-v1', adapter, cache, 5000000); assert.equal(embedded, a.passages.length); const next = await stageRelease(b, 'model-v1', adapter, cache, 5000000); assert.ok(embedded > a.passages.length); assert.equal(promoteRelease(next, a.corpusId, 'model-v1'), null); assert.equal(promoteRelease(next, b.corpusId, 'model-v1'), b.corpusId); assert.equal(promoteRelease({ ...first, ready: false }, a.corpusId, 'model-v1'), null); });
test('Storage limits include initial, staged and retained indexes; failed enrichment preserves static release', async () => { const a = build('<p>public</p>'); let calls = 0; await assert.rejects(stageRelease(a, 'model-v1', { embed: async () => { calls++; return Array.from({ length: 1024 }, () => 1); }, upsert: async () => { }, ready: async () => true }, new Map(), 0)); assert.equal(calls, 0); });

test('Staging rejects invalid capacity and unusable vectors, including cached dimensions',async()=>{
    const a=build('<p>public</p>');let calls=0;
    const adapter={embed:async()=>{calls++;return Array(1024).fill(1);},upsert:async()=>{},ready:async()=>true};
    for(const remaining of [NaN,Infinity,-1]) await assert.rejects(stageRelease(a,'model-v1',adapter,new Map(),remaining));
    assert.equal(calls,0);
    await assert.rejects(stageRelease(a,'model-v1',{...adapter,embed:async()=>Array(1024).fill(0)},new Map(),5000000),/INVALID_VECTOR/);
    const cache=new Map();await stageRelease(a,'model-v1',adapter,cache,5000000);
    const reduced={...adapter,embed:async()=>{calls++;return Array(768).fill(1);}};
    await stageRelease(a,'model-v1',reduced,cache,5000000,768);
    assert.equal(calls,2);
});

test('Promotion requires matching document and query model configuration and dimensions',()=>{
    const staged={corpusId:'release',ready:true,modelConfig:'document-model',dimensions:1024};
    const promote=promoteRelease as (value:typeof staged,corpusId:string,modelConfig:string,dimensions:number)=>string|null;
    assert.equal(promote(staged,'release','query-model',1024),null);
    assert.equal(promote(staged,'release','document-model',768),null);
    assert.equal(promote(staged,'release','document-model',1024),'release');
});

test('Offline publication rehearsal joins staged, deployed and active releases across add edit rename and withdrawal',async()=>{
    const make=(id:string,html:string)=>({source:'local',id,title:id,status:'published',href:`/gcake-dev/posts/${id}/`,canonicalUrl:`https://gcake119.github.io/gcake-dev/posts/${id}/`,topics:['workflow'],html});
    const a=make('a','<p>stable workflow</p>'),b=make('b','<p>old recovery</p>'),edited=make('b','<p>new retries</p>'),renamed=make('c','<p>new retries</p>');
    const config={now:'2026-10-21T00:00:00Z',sourceTree:'fixture',snapshotDigest:'fixture',baseUrl:'https://gcake119.github.io/gcake-dev'};
    const releases=[[a],[a,b],[a,edited],[a,renamed],[a]].map(sources=>buildPublicDiscovery(sources,config));
    const uploaded=new Map<string,{id:string;articleId:string;revision:string}[]>(),cache=new Map<string,number[]>();
    let stableEmbeddings=0,totalEmbeddings=0;
    const adapter={embed:async(text:string)=>{totalEmbeddings++;if(text==='stable workflow')stableEmbeddings++;return Array(1024).fill(1);},upsert:async(id:string,v:{id:string;articleId:string;revision:string}[])=>{uploaded.set(id,v);},ready:async(id:string,ids:string[])=>ids.every(p=>uploaded.get(id)?.some(v=>v.id===p))};
    let deployed=releases[0],active='';
    const makeService=()=>createSearchService({policy:{enabled:true,activeCorpusId:active,model:approvedModel,modelConfig:'offline-bge-fixture',dimensions:1024,format:'plain',inputLimit:8192,billing:{model:approvedModel,id:'offline-evidence',validUntil:'2099-01-01',rate:1,freeVerified:true,noChargeBoundary:true,account:'offline',providerResetVerified:true,windowId:'2026-10-21',services:['embedding','vector-query','vector-storage','worker','admission']},limits:{requests:100,tokens:100000,units:100000,vectorQueries:100,storage:5000000,worker:100,admission:1000},paidOverage:0,throttleSecret:'offline-only',qualityVerified:true,providerInputVerified:true} satisfies SearchPolicy,admission:new MemoryAdmission(),now:()=>Date.parse(config.now),manifest:async()=>({corpusId:deployed.corpusId,corpus:deployed}),embed:async()=>Array(1024).fill(1),vectors:async()=>[...uploaded.values()].flat()});
    const request=(id:string)=>new Request('https://search.invalid/v1/search',{method:'POST',body:JSON.stringify({q:'unmatchedSemanticQuery',corpusId:id})});
    for(const candidate of releases){
        const staged=await stageRelease(candidate,'offline-bge-fixture',adapter,cache,5000000);
        assert.equal(staged.ready,true);
        if(active && candidate.corpusId!==deployed.corpusId) assert.equal(promoteRelease(staged,deployed.corpusId,'offline-bge-fixture'),null);
        deployed=candidate;active=promoteRelease(staged,deployed.corpusId,'offline-bge-fixture')!;
        const response=await makeService()(request(candidate.corpusId));assert.equal(response.status,200);
        const body=await response.json();assert.deepEqual(body.results.map((r:{articleId:string})=>r.articleId).sort(),candidate.articles.map(a=>a.articleId).sort());
        assert.ok(body.results.every((r:{readingHref:string})=>candidate.passages.some(p=>p.href===r.readingHref)));
    }
    assert.equal(stableEmbeddings,1);assert.equal(totalEmbeddings,4);
    // Failed publication keeps the preceding deployed and active corpus.
    const pending=await stageRelease(releases[1],'offline-bge-fixture',adapter,cache,5000000);
    assert.equal(promoteRelease(pending,deployed.corpusId,'offline-bge-fixture'),null);assert.equal(active,deployed.corpusId);
    // Withdraw during unavailable optional enrichment: current static corpus wins.
    deployed=releases[2];active=deployed.corpusId;
    await assert.rejects(stageRelease(releases[4],'offline-bge-fixture',{...adapter,upsert:async()=>{throw Error('offline enrichment unavailable');}},cache,5000000));
    deployed=releases[4];assert.equal((await makeService()(request(deployed.corpusId))).status,409);
    assert.equal(search(deployed,'new retries').total,0);
    assert.equal((await makeService()(request(releases[2].corpusId))).status,409);
});
