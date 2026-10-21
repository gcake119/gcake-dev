import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchService, approvedModel, type SearchPolicy } from '../../apps/search-worker/src/service';
import { MemoryAdmission } from '../../apps/search-worker/src/admission';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
const corpus = buildPublicDiscovery([{ source: 'local', id: 'automation', title: '流程自動化', href: '/gcake-dev/posts/automation/', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/automation/', status: 'published', topics: ['workflow'], series: 's', html: '<h2 id="tools">工作流程</h2><p>自動化 repeated manual work recovery</p>' }], { now: '2026-10-21T00:00:00Z', baseUrl: 'https://gcake119.github.io/gcake-dev', sourceTree: 'tree', snapshotDigest: 'snapshot' });
const policy: SearchPolicy = { enabled: true, activeCorpusId: corpus.corpusId, model: approvedModel, modelConfig: 'offline-fixture', dimensions: 1024, format: 'plain', inputLimit: 8192, billing: { model: approvedModel, id: 'fixture-evidence', validUntil: '2099-01-01', rate: 1075 / 1e6, freeVerified: true, noChargeBoundary: true, account: 'fixture', providerResetVerified: true, windowId: "2026-10-21", services: ['embedding', 'vector-query', 'vector-storage', 'worker', 'admission'] }, limits: { requests: 100, tokens: 100000, units: 1000, vectorQueries: 100, storage: 5000000, worker: 100, admission: 1000 }, paidOverage: 0, throttleSecret: 'offline-only-secret', qualityVerified: true, providerInputVerified: true };
function harness(p: Partial<SearchPolicy> = {}, reserve = new MemoryAdmission()) { let calls = 0; const service = createSearchService({ policy: { ...policy, ...p }, admission: reserve, manifest: async () => ({ corpusId: corpus.corpusId, corpus }), embed: async () => { calls++; return Array.from({ length: 1024 }, (_, i) => i === 0 ? 1 : 0); }, vectors: async () => [{ id: corpus.passages[0].passageId, revision: corpus.passages[0].revision, articleId: corpus.articles[0].articleId }], now: () => Date.parse('2026-10-21T00:00:00Z') }); return { service, calls: () => calls }; }
const request = (patch: Record<string, unknown> = {}) => new Request('https://search.invalid/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: '如何減少每天重複操作', corpusId: corpus.corpusId, page: 1, sort: 'relevance', limit: 10, ...patch }) });
test('Different wording finds same meaning with compatible embedding and zero generation', async () => { const h = harness(), r = await h.service(request()); assert.equal(r.status, 200); const body = await r.json(); assert.equal(body.results[0].articleId, 'local:automation'); assert.equal(body.mode, 'hybrid'); assert.equal(h.calls(), 1); });
test('Provider release mismatch and malicious caller URL reject before embedding', async () => {
    for (const patch of [{ corpusId: 'old' }, { manifestUrl: 'https://evil.invalid' }, { topic: 'secret' }, { limit: 11 }, { q: 'x'.repeat(201) }, { q: ' ' }, { q: '😀'.repeat(2000) }]) {
        const h = harness(), r = await h.service(request(patch));
        assert.ok([400, 409].includes(r.status));
        assert.equal(h.calls(), 0);
    }
});
test('Budget exhausted, unavailable admission, absent billing and Paid uncoordinated consumers produce zero calls', async () => {
    for (const patch of [{ enabled: false }, { limits: { ...policy.limits, requests: 0 } }, { billing: { ...policy.billing, noChargeBoundary: false } }, { billing: { ...policy.billing, freeVerified: false } }, { billing: { ...policy.billing, providerResetVerified: false } }, { billing: { ...policy.billing, id: '' } }, { paidOverage: 1 }, { qualityVerified: false }]) {
        const h = harness(patch), r = await h.service(request());
        assert.ok([429, 503].includes(r.status));
        assert.equal(h.calls(), 0);
    }
});
test('Prohibited or unidentified fallback and incompatible model dimensions produce zero calls', async () => {
    for (const model of ['@cf/baai/bge-small-en-v1.5', '@cf/baai/bge-reranker-base', 'qwen', 'unknown', '@cf/google/embeddinggemma-300m']) {
        const h = harness({ model }), r = await h.service(request());
        assert.equal(r.status, 503);
        assert.equal(h.calls(), 0);
    }
    const h = harness({ dimensions: 768 });
    assert.equal((await h.service(request())).status, 503);
    assert.equal(h.calls(), 0);
});
test('Concurrent requests compete for final free units; unknown reservations are retained', async () => { const limits = { ...policy.limits, requests: 1 }; const h = harness({ limits }); const responses = await Promise.all([h.service(request()), h.service(request())]); assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]); assert.equal(h.calls(), 1); });
test('Admission unavailable makes no model call', async () => { const admission = new MemoryAdmission(); admission.available = false; const h = harness({}, admission); assert.equal((await h.service(request())).status, 503); assert.equal(h.calls(), 0); });
test('No answer or write endpoints', async () => {
    const h = harness();
    for (const path of ['/v1/answer', '/admin', '/vectors'])
        assert.equal((await h.service(new Request('https://search.invalid' + path, { method: 'POST' }))).status, 404);
    assert.equal(h.calls(), 0);
});
test('Stale, hidden and incompatible vector metadata never restores withdrawn knowledge', async () => { const service = createSearchService({ policy, now: () => Date.parse('2026-10-21T00:00:00Z'), admission: new MemoryAdmission(), manifest: async () => ({ corpusId: corpus.corpusId, corpus }), embed: async () => Array.from({ length: 1024 }, () => 1), vectors: async () => [{ id: 'old', articleId: 'local:hidden', revision: 'old' }, { id: corpus.passages[0].passageId, articleId: 'local:automation', revision: 'obsolete' }] }); const r = await service(request()); assert.equal(r.status, 200); assert.equal((await r.json()).total, 0); });
test('Manifest change while request is in flight discards remote results', async () => { let reads = 0; const service = createSearchService({ policy, now: () => Date.parse('2026-10-21T00:00:00Z'), admission: new MemoryAdmission(), manifest: async () => ({ corpusId: ++reads === 1 ? corpus.corpusId : 'new-release', corpus }), embed: async () => Array.from({ length: 1024 }, () => 1), vectors: async () => [{ id: corpus.passages[0].passageId, articleId: 'local:automation', revision: corpus.passages[0].revision }] }); assert.equal((await service(request())).status, 409); });
test('Local calendar rollover never fabricates a newly verified provider window', async () => { let calls = 0; const service = createSearchService({ policy, admission: new MemoryAdmission(), manifest: async () => ({ corpusId: corpus.corpusId, corpus }), now: () => Date.parse('2026-10-22T00:00:00Z'), embed: async () => { calls++; return Array(1024).fill(1); }, vectors: async () => [] }); assert.equal((await service(request())).status, 503); assert.equal(calls, 0); });
test('Zero model rate needs explicit applicable no-charge evidence', async () => { const h = harness({ billing: { ...policy.billing, rate: 0 } }); assert.equal((await h.service(request())).status, 503); assert.equal(h.calls(), 0); });
test('Vector adapter binds release namespace and topic/series before provider query', async () => { const { vectorRetrieval } = await import('../../apps/search-worker/src/provider'); let captured: unknown; const binding = { query: async (_v: number[], options: unknown) => { captured = options; return { matches: [{ id: 'p', metadata: { articleId: 'local:a', revision: 'r' } }] }; } }; const result = await vectorRetrieval(binding, Array(1024).fill(1), 'release', { topic: 'workflow', series: 's' }, new AbortController().signal); assert.deepEqual(captured, { namespace: 'release', topK: 50, returnMetadata: 'all', filter: { topic_workflow: true, series: 's' } }); assert.deepEqual(result, [{ id: 'p', articleId: 'local:a', revision: 'r' }]); });
test('Unbound Worker validates its public contract and stays disabled', async () => { const worker = (await import('../../apps/search-worker/src/index')).default; assert.equal((await worker.fetch(request({ q: ' ' }))).status, 400); assert.equal((await worker.fetch(request())).status, 503); assert.equal((await worker.fetch(new Request('https://search.invalid/v1/answer', { method: 'POST' }))).status, 404); });
test('Expired embedding cannot begin a later vector request after the response deadline',async()=>{let resolveEmbedding:(value:number[])=>void=()=>{};let vectorCalls=0;const pending=new Promise<number[]>(resolve=>resolveEmbedding=resolve);const service=createSearchService({policy,now:()=>Date.parse('2026-10-21T00:00:00Z'),admission:new MemoryAdmission(),manifest:async()=>({corpusId:corpus.corpusId,corpus}),embed:async()=>pending,vectors:async()=>{vectorCalls++;return [];}});const response=await service(request());assert.equal(response.status,503);resolveEmbedding(Array(1024).fill(1));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(vectorCalls,0);});

test('Missing usage ceilings and nonfinite input bounds reject before model or manifest access', async () => {
    for (const patch of [{ limits: {} }, { inputLimit: Infinity }, { inputLimit: NaN }]) {
        const h = harness(patch as Partial<SearchPolicy>);
        assert.equal((await h.service(request())).status, 503);
        assert.equal(h.calls(), 0);
    }
});
test('Unknown provider outcome keeps its reservation and throttle keys contain no raw query or IP', async () => {
    const admission = new MemoryAdmission(); let embeddings = 0; const keys: string[] = [];
    const service = createSearchService({ policy: { ...policy, limits: { ...policy.limits, requests: 1 } }, now: () => Date.parse('2026-10-21T00:00:00Z'), admission: { reserve: async (...args) => {keys.push(args[1]);return admission.reserve(...args);} }, manifest: async () => ({ corpusId: corpus.corpusId, corpus }), embed: async () => { embeddings++; throw new Error('unknown outcome'); }, vectors: async () => {throw Error('must not query');} });
    const make = () => {const r=request();r.headers.set('CF-Connecting-IP','192.0.2.123');return r;};
    assert.equal((await service(make())).status,503);
    assert.equal((await service(make())).status,429);
    assert.equal(embeddings,1);assert.match(keys[0],/^[a-f0-9]{64}$/);assert.equal(keys[0],keys[1]);
    assert.ok(!keys[0].includes('192.0.2.123'));assert.ok(!keys[0].includes('如何'));
});
test('Explicit no-charge terms allow a zero-rate fixture; expired evidence keeps calls at zero',async()=>{
    const allowed=harness({billing:{...policy.billing,rate:0,noChargeTerms:'offline applicable no-charge evidence'}});
    assert.equal((await allowed.service(request())).status,200);assert.equal(allowed.calls(),1);
    const expired=harness({billing:{...policy.billing,validUntil:'2026-10-20T00:00:00Z'}});
    assert.equal((await expired.service(request())).status,503);assert.equal(expired.calls(),0);
});
test('Authored references to prohibited runtime models remain searchable',()=>{
    const c=buildPublicDiscovery([{source:'local',id:'models',title:'模型比較',status:'published',href:'/gcake-dev/posts/models/',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/models/',topics:[],html:'<p>BGE Qwen 是這篇討論的技術主題。</p>'}],{now:'2026-10-21T00:00:00Z',baseUrl:'https://gcake119.github.io/gcake-dev',sourceTree:'fixture',snapshotDigest:'fixture'});
    assert.ok(c.postings.qwen['local:models']);assert.ok(c.postings.bge['local:models']);
});

test('Request deadline cancels a caller body that never finishes before any model work',async()=>{
    let cancelled=false;
    const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}});
    const incoming=new Request('https://search.invalid/v1/search',{method:'POST',body:stream,duplex:'half'} as RequestInit);
    const h=harness();assert.equal((await h.service(incoming)).status,503);
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(cancelled,true);assert.equal(h.calls(),0);
});
