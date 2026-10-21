import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import { createRequire } from 'node:module';
import { deployedReader, manifestUrl } from '../../apps/search-worker/src/deployed';
test('Fixed deployed manifest rejects malicious asset URLs before fetching external content', async () => { const calls: string[] = []; const read = deployedReader(async (input) => { calls.push(String(input)); return Response.json({ schemaVersion: 1, corpusId: 'a'.repeat(64), assets: { index: { href: 'https://evil.invalid/corpus', digest: 'a'.repeat(64) } } }); }); await assert.rejects(read(new AbortController().signal)); assert.deepEqual(calls, [manifestUrl]); });
test('Manifest digest mismatch is rejected', async () => { let calls = 0; const read = deployedReader(async () => ++calls === 1 ? Response.json({ schemaVersion: 1, corpusId: 'a'.repeat(64), assets: { index: { href: '/gcake-dev/discovery/' + 'a'.repeat(64) + '/index.json', digest: '0'.repeat(64) } } }) : Response.json({})); await assert.rejects(read(new AbortController().signal), /DIGEST/); });
test('Admission SQL enforces durable verified-window caps atomically', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    try {
        db.exec(await readFile('apps/search-worker/migrations/0001_admission.sql', 'utf8'));
        db.prepare('INSERT INTO discovery_windows VALUES (?,?,?,?,?,?,?,?,?)').run('2026-10-21', 10000, 1, 1000, 100, 10, 10, 100, 5000000);
        const reserve = db.prepare('INSERT INTO discovery_reservations VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        reserve.run('first', '2026-10-21', 'hash-only', 1, 1, 1, 1, 1, 1, 1, 0);
        assert.throws(() => reserve.run('second', '2026-10-21', 'hash-only', 1, 1, 1, 1, 1, 1, 1, 0), /QUOTA_EXCEEDED/);
        assert.equal(db.prepare('SELECT count(*) AS n FROM discovery_reservations').get()!.n, 1);
        assert.equal(db.prepare('SELECT requests FROM discovery_windows').get()!.requests, 0);
    }
    finally {
        db.close();
    }
});

test('Evaluation follows empty, sparse, growing and withdrawn public evidence without quotas', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gcake-discovery-sample-'));
    const source = (id: string, html: string) => ({ source: 'local', id, title: id, href: `/gcake-dev/posts/${id}/`, canonicalUrl: `https://gcake119.github.io/gcake-dev/posts/${id}/`, status: 'published', topics: [], html });
    const a = source('a', '<p>工作流程</p>'), b = source('b', '<p>Retrieval-Augmented Generation（RAG）</p>');
    try {
        await mkdir(join(root, 'dist'), { recursive: true });
        await mkdir(join(root, 'test/discovery'), { recursive: true });
        for (const sources of [[], [a], [a, b], [a]]) {
            const c = buildPublicDiscovery(sources, { now: '2026-10-21T00:00:00Z', sourceTree: 'test', snapshotDigest: 'test', baseUrl: 'https://gcake119.github.io/gcake-dev' });
            const assets = Object.fromEntries(['index', 'passages', 'connections'].map(kind => [kind, { href: `/gcake-dev/${kind}.json` }]));
            await writeFile(join(root, 'dist/discovery-manifest.json'), JSON.stringify({ corpusId: c.corpusId, configurationDigest: c.configurationDigest, assets }));
            for (const [kind, data] of Object.entries({ index: c, passages: c.passages, connections: c.connections })) await writeFile(join(root, `dist/${kind}.json`), JSON.stringify(data));
            for (const name of ['freeze-sample', 'evaluate']) execFileSync(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL(`../../scripts/discovery/${name}.ts`, import.meta.url))], { cwd: root, stdio: 'pipe' });
            const sample = JSON.parse(await readFile(join(root, 'test/discovery/retrieval-judgments-current.json'), 'utf8'));
            const result = JSON.parse(await readFile(join(root, 'output/discovery/evaluation.json'), 'utf8'));
            assert.equal(sample.queries.length, c.articles.length + c.aliases.length);
            assert.ok(sample.queries.every((q: { status?: string; judgments: unknown[] }) => !q.status && q.judgments.length));
            assert.equal(result.sourceGroundedQueries, sample.queries.length);
            assert.equal(result.panels.length, c.articles.length);
            assert.equal(result.metricsAreReleaseGates, false);
            assert.equal(result.evaluationStatus, sources.length ? 'OBSERVATIONAL' : 'NO_JUDGED_DATA');
            if (!sources.length) assert.equal(result.judgedTargetRecall5, null);
            assert.ok(!('unresolvedAliasSlots' in result));
            assert.ok(!('releaseQualityGate' in result));
        }
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('Durable admission respects configured ceilings, atomic final slot, expiry and hashed-key cleanup', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { D1Admission } = await import('../../apps/search-worker/src/admission');
    const db = new DatabaseSync(':memory:');
    const database = { prepare(sql: string) {
        const statement=db.prepare(sql);let values: (string|number)[]=[];
        const bound={bind(...next:(string|number)[]){values=next;return bound;},async first(){return statement.get(...values)??null;},async run(){return statement.run(...values);}};return bound;
    }};
    try {
        db.exec(await readFile('apps/search-worker/migrations/0001_admission.sql','utf8'));
        db.prepare('INSERT INTO discovery_windows VALUES (?,?,?,?,?,?,?,?,?)').run('window',10000,2,100,100,100,100,100,100);
        const admission=new D1Admission(database as import('../../apps/search-worker/src/admission').AdmissionDatabase);
        const cost={requests:1,tokens:1,units:1,vectorQueries:1,worker:1,admission:1,storage:0};
        const limits={requests:1,tokens:100,units:100,vectorQueries:100,worker:100,admission:100,storage:100};
        assert.equal(await admission.reserve('window','a'.repeat(64),cost,limits,1),false);
        assert.equal(db.prepare('SELECT count(*) AS n FROM discovery_reservations').get()!.n,0);
        db.exec('UPDATE discovery_windows SET requests=1');
        assert.deepEqual((await Promise.all(['a','b'].map(k=>admission.reserve('window',k.repeat(64),cost,limits,1)))).sort(),[false,true]);
        assert.equal(db.prepare('SELECT count(*) AS n FROM discovery_reservations').get()!.n,1);
        assert.equal(await admission.reserve('window','c'.repeat(64),{...cost,tokens:-1},limits,2),false);
        assert.equal(await admission.reserve('window','c'.repeat(64),cost,limits,10001),false);
        await admission.reserve('window','c'.repeat(64),cost,limits,600002);
        assert.equal(db.prepare('SELECT count(*) AS n FROM discovery_clients').get()!.n,0);
    } finally {db.close();}
});

test('Actual article connection component omits empty groups and renders accessible escaped links',async()=>{
    const require=createRequire(import.meta.resolve('astro/package.json'));
    const {transform}=await import(require.resolve('@astrojs/compiler-rs'));
    const {experimental_AstroContainer}=await import('astro/container');
    const template=await readFile('src/components/ArticleConnections.astro','utf8');
    const compiled=transform(template,{filename:'ArticleConnections.astro',resultScopedSlot:true,resolvePath:(specifier:string)=>specifier,internalURL:import.meta.resolve('astro/compiler-runtime')}).code;
    const source=(id:string,html:string)=>({source:'local',id,title:id==='b'?'<script>unsafe title</script>':id,href:`/gcake-dev/posts/${id}/`,canonicalUrl:`https://gcake119.github.io/gcake-dev/posts/${id}/`,status:'published',topics:['workflow'],html});
    const config={now:'2026-10-21T00:00:00Z',sourceTree:'fixture',snapshotDigest:'fixture',baseUrl:'https://gcake119.github.io/gcake-dev'};
    const container=await experimental_AstroContainer.create();
    const render=async(corpus:ReturnType<typeof buildPublicDiscovery>,placement:string)=>{
        const data='data:text/javascript,'+encodeURIComponent('export const loadDiscovery=async()=>({corpus:'+JSON.stringify(corpus)+'});');
        const code=compiled.replaceAll('"../lib/discovery/site"',JSON.stringify(data));
        const component=await import('data:text/javascript,'+encodeURIComponent(code));
        return container.renderToString(component.default,{props:{articleId:'local:a',placement}});
    };
    const empty=buildPublicDiscovery([source('a','<p>的了和</p>')],config);
    for(const placement of ['related','further','references']) assert.doesNotMatch(await render(empty,placement),/<(?:section|h2|details|button)\b/);
    const filled=buildPublicDiscovery([source('a','<p>workflow recovery <a href="/gcake-dev/posts/b/">B</a><a href="https://example.com/reference">Reference</a></p>'),source('b','<p>workflow recovery</p>')],config);
    const related=await render(filled,'related');assert.match(related,/aria-label="相關文章"/);assert.match(related,/href="\/gcake-dev\/posts\/b\/"/);assert.doesNotMatch(related,/<script>/);assert.match(related,/&lt;script&gt;/);
    const references=await render(filled,'references');assert.match(references,/<summary>引用與反向連結<\/summary>/);assert.match(references,/rel="noopener noreferrer"/);
});

test('Ollama evaluation permits only pinned installed models on loopback and uses embedding requests without truncation',async()=>{
    const {OllamaEmbeddingClient,modelProfiles,formatInput}=await import('../../scripts/discovery/ollama');
    const profile={...modelProfiles[0],digest:'a'.repeat(64)};const calls:{url:string;body:Record<string,unknown>}[]=[];
    const fetcher=async(input:string|URL|Request,init?:RequestInit)=>{const url=String(input);const body=JSON.parse(String(init?.body??'{}'));calls.push({url,body});if(url.endsWith('/api/tags'))return Response.json({models:[{name:profile.name,digest:profile.digest}]});return Response.json({model:profile.name,embeddings:(body.input as string[]).map(()=>Array(profile.dimensions).fill(1)),total_duration:10,load_duration:0,prompt_eval_count:3});};
    assert.throws(()=>new OllamaEmbeddingClient('https://cloud.invalid',fetcher as typeof fetch),/LOOPBACK/);
    assert.throws(()=>new OllamaEmbeddingClient('http://user@127.0.0.1:11434/',fetcher as typeof fetch),/LOOPBACK/);
    const client=new OllamaEmbeddingClient('http://127.0.0.1:11434',fetcher as typeof fetch);
    await client.verify(profile);
    const result=await client.embed(profile,['public paragraph']);assert.equal(result.vectors[0].length,1024);assert.ok(Math.abs(Math.hypot(...result.vectors[0])-1)<1e-6);
    assert.equal(calls.at(-1)!.body.truncate,false);assert.ok(calls.every(c=>!c.url.includes('chat')&&!c.url.includes('generate')&&!c.url.includes('pull')));
    assert.equal(formatInput(modelProfiles[0],'query','query text'),'query text');
    assert.equal(formatInput(modelProfiles[1],'query','query text'),'task: search result | query: query text');
    assert.equal(formatInput(modelProfiles[1],'document','body','title'),'title: title | text: body');
    await assert.rejects(client.verify({...profile,digest:'b'.repeat(64)}),/MODEL_IDENTITY/);
    await assert.rejects(client.verify({...profile,name:'unknown:cloud'}),/MODEL_IDENTITY/);
});
test('Ollama invalid output fails once and a vector cannot cross corpus or model spaces',async()=>{
    const {OllamaEmbeddingClient,modelProfiles,rankLocal,fuseLocal}=await import('../../scripts/discovery/ollama');
    const profile={...modelProfiles[0],digest:'a'.repeat(64)};let calls=0;
    for(const output of [{embeddings:[Array(768).fill(1)]},{embeddings:[Array(1024).fill(0)]},{embeddings:[Array(1024).fill(null)]},{error:'input too long'}]){
        const client=new OllamaEmbeddingClient('http://127.0.0.1:11434',async()=>{calls++;return Response.json({model:profile.name,...output});});
        await assert.rejects(client.embed(profile,['text']));
    }assert.equal(calls,4);
    const space={corpusId:'current',modelConfig:'model-a',dimensions:2};const index={space,items:[{articleId:'a',passageId:'p1',revision:'r1'},{articleId:'a',passageId:'p2',revision:'r1'},{articleId:'b',passageId:'p3',revision:'r2'}],vectors:[new Float32Array([1,0]),new Float32Array([.9,.1]),new Float32Array([0,1])]};
    assert.deepEqual(rankLocal(index,{space,values:[1,0]}).map(r=>r.articleId),['a','b']);
    assert.throws(()=>rankLocal(index,{space:{...space,modelConfig:'model-b'},values:[1,0]}),/VECTOR_SPACE/);
    assert.throws(()=>rankLocal(index,{space:{...space,corpusId:'old'},values:[1,0]}),/VECTOR_SPACE/);
    assert.deepEqual(fuseLocal(['b'],['a','b']).map(r=>r.articleId),['b','a']);
});
