import { readFile, writeFile, mkdir, rename, appendFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cpus, loadavg, totalmem } from 'node:os';
import assert from 'node:assert/strict';
import { digest } from '../../src/lib/discovery/build';
import { search } from '../../src/lib/discovery/search';
import type { Corpus } from '../../src/lib/discovery/types';
import { OllamaEmbeddingClient, modelProfiles, formatInput, normalizeVector, rankLocal, fuseLocal, judgedMetrics, type PinnedModel, type LocalIndex, type VectorSpace } from './ollama';

const args=process.argv.slice(2);
if(args.some(a=>!['--run','--resume'].includes(a)))throw Error('UNKNOWN_ARGUMENT');
const execute=args.includes('--run'),resume=args.includes('--resume');
const root=resolve('output/discovery/ollama/comparison-20261021');
const save=async(name:string,value:unknown)=>{const path=join(root,name);await mkdir(resolve(path,'..'),{recursive:true});const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n');await rename(tmp,path);};
await mkdir(root,{recursive:true});
const manifestText=await readFile('dist/discovery-manifest.json','utf8'),manifest=JSON.parse(manifestText);
const asset=async(kind:string)=>{const text=await readFile('dist/'+manifest.assets[kind].href.replace('/gcake-dev/',''),'utf8');assert.equal(digest(text),manifest.assets[kind].digest);return JSON.parse(text);};
const corpus:Corpus=await asset('index');corpus.passages=await asset('passages');corpus.connections=await asset('connections');
const sampleText=await readFile('test/discovery/retrieval-judgments-current.json','utf8'),sample=JSON.parse(sampleText);
assert.equal(corpus.corpusId,manifest.corpusId);assert.equal(sample.corpusId,corpus.corpusId);assert.equal(sample.configurationDigest,corpus.configurationDigest);
type Query={id:string;category:string;q:string;judgments:{articleId:string;grade:number;sourceRevision:string}[];};
const queries:Query[]=sample.queries.filter((q:{status?:string})=>!q.status);
for(const q of queries)for(const j of q.judgments)assert.ok(corpus.articles.some(a=>a.articleId===j.articleId&&a.sourceRevision===j.sourceRevision));
const client=new OllamaEmbeddingClient();
const snapshot=await client.snapshot();
const profiles:PinnedModel[]=modelProfiles.map(p=>{const found=snapshot.tags.models.find((m:{name:string})=>m.name===p.name);if(!found)throw Error('MODEL_IDENTITY:'+p.name);return {...p,digest:found.digest};});
const show=await Promise.all(profiles.map(p=>client.show(p)));
const plan={schemaVersion:1,authorized:'Foreground local Ollama comparison only',createdAt:new Date().toISOString(),corpusId:corpus.corpusId,configurationDigest:corpus.configurationDigest,manifestDigest:digest(manifestText),judgmentsDigest:digest(sampleText),runnerDigest:digest(await readFile('scripts/discovery/ollama-compare.ts','utf8')),adapterDigest:digest(await readFile('scripts/discovery/ollama.ts','utf8')),articles:corpus.articles.length,passages:corpus.passages.length,queries:queries.length,noMatch:sample.noMatch.length,batchSize:16,retries:0,queryWarmRepeatsPerModel:5,truncate:false,ollama:snapshot.version,models:profiles.map((p,i)=>({...p,details:show[i].details,modelInfo:show[i].model_info,template:show[i].template})),loadedBefore:snapshot.loaded,host:{logicalCpus:cpus().length,totalMemoryBytes:totalmem(),loadAverage:loadavg()},limitations:['Pinned installed GGUF/F16 and MLX/NVFP4 configurations differ; not a weights-only or controlled runner comparison','Previously observed limited expected-target labels; not exhaustive relevance judgments or fresh held-out acceptance','Local brute-force cosine top-50 passage pool then source article deduplication; no real Vectorize call','Local results do not prove Cloudflare availability, quality, billing or activation'],cloudCallsAuthorized:false,productionActivation:false};
if(resume){const previous=JSON.parse(await readFile(join(root,'plan.json'),'utf8'));for(const key of ['corpusId','configurationDigest','manifestDigest','judgmentsDigest','runnerDigest','adapterDigest'] as const)assert.equal(previous[key],plan[key],`RESUME_PIN_MISMATCH:${key}`);assert.deepEqual(previous.models,plan.models,'RESUME_MODEL_MISMATCH');}
else {try{await stat(join(root,'plan.json'));throw Error('EXISTING_RUN_REQUIRES_EXPLICIT_RESUME');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await save('plan.json',plan);await save('judgments.json',sample);}
if(!execute){console.log(JSON.stringify({status:'PLANNED_NO_INFERENCE',root,articles:plan.articles,passages:plan.passages,queries:plan.queries,models:profiles}));process.exit(0);}

const initiallyLoaded=new Set((snapshot.loaded.models??[]).map((m:{name:string})=>m.name));
const owned=new Map<string,PinnedModel>(),calls:Record<string,unknown>[]=[],indexes=new Map<string,LocalIndex>();
const indexReports:unknown[]=[],scored:Record<string,unknown>[]=[],warm:Record<string,unknown>[]=[],failures:Record<string,unknown>[]=[];
const wallStart=performance.now();let success=false;
async function embed(profile:PinnedModel,input:string[],purpose:string){
    if(!initiallyLoaded.has(profile.name))owned.set(profile.name,profile);
    const start=performance.now();
    try{const result=await client.embed(profile,input);const record={model:profile.name,purpose,inputs:input.length,inputDigest:digest(input),...result,vectors:undefined};calls.push(record);await appendFile(join(root,'calls.jsonl'),JSON.stringify(record)+'\n');return result;}
    catch(e){const failure={model:profile.name,purpose,inputs:input.length,inputDigest:digest(input),wallMs:performance.now()-start,error:String(e)};failures.push(failure);await appendFile(join(root,'calls.jsonl'),JSON.stringify(failure)+'\n');throw e;}
}
async function storeVector(path:string,values:number[]){const vector=new Float32Array(values);const bytes=Buffer.alloc(vector.length*4);vector.forEach((v,i)=>bytes.writeFloatLE(v,i*4));await writeFile(path,bytes);}
async function loadVector(path:string,dimensions:number){try{const data=await readFile(path);assert.equal(data.length,dimensions*4,'INVALID_CACHE');const values=Array.from({length:dimensions},(_,i)=>data.readFloatLE(i*4));normalizeVector(values,dimensions);return new Float32Array(values);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e;}}
const lexIds=(q:string)=>[...new Set(Array.from({length:5},(_,i)=>search(corpus,q,{page:i+1,limit:10}).results).flat().map(r=>r.articleId))].slice(0,50);
function retrieve(profile:PinnedModel,values:number[],q:string){const index=indexes.get(profile.name)!,start=performance.now();const dense=rankLocal(index,{space:index.space,values});const lexical=lexIds(q);const hybrid=fuseLocal(lexical,dense.map(r=>r.articleId),dense.map(r=>r.passageRank));return {lexical,dense,hybrid,rankingMs:performance.now()-start};}
try{
    for(const profile of profiles){
        await client.verify(profile);
        const modelConfig=digest({profile,corpusId:corpus.corpusId,ollama:snapshot.version,details:show[profiles.indexOf(profile)].details,truncate:false,normalization:'l2-f32le',documentInformation:'same-article-title-and-passage'});
        const space:VectorSpace={corpusId:corpus.corpusId,modelConfig,dimensions:profile.dimensions};
        const cache=join(root,'cache',modelConfig);await mkdir(cache,{recursive:true});
        const input=corpus.passages.map(p=>formatInput(profile,'document',p.text,corpus.articles.find(a=>a.articleId===p.articleId)!.title));
        const paths=input.map(text=>join(cache,digest({space,text})+'.f32'));
        const index:LocalIndex={space,items:corpus.passages.map(p=>({articleId:p.articleId,passageId:p.passageId,revision:p.revision})),vectors:[]};
        const start=performance.now();let computed=0,reused=0;
        for(let offset=0;offset<input.length;offset+=16){
            const batch=input.slice(offset,offset+16);const cached=await Promise.all(batch.map((_,i)=>loadVector(paths[offset+i],profile.dimensions)));
            const missing=cached.flatMap((v,i)=>v?[]:[i]);
            if(missing.length){const result=await embed(profile,missing.map(i=>batch[i]),'index');for(const [j,i] of missing.entries()){await storeVector(paths[offset+i],result.vectors[j]);cached[i]=new Float32Array(result.vectors[j]);}computed+=missing.length;}
            reused+=batch.length-missing.length;index.vectors.push(...cached as Float32Array[]);
            await client.verify(profile);
            await save(profile.name.split(':')[0]+'-checkpoint.json',{space,completed:index.vectors.length,total:input.length,computed,reused});
            if(offset%128===0||offset+16>=input.length)console.log(JSON.stringify({model:profile.name,stage:'index',completed:index.vectors.length,total:input.length,computed,reused,elapsedSeconds:Math.round((performance.now()-start)/1000)}));
        }
        indexes.set(profile.name,index);indexReports.push({model:profile.name,space,computed,reused,passages:index.items.length,indexWallMs:performance.now()-start,float32Bytes:index.vectors.length*profile.dimensions*4});
        await save('indexes.json',indexReports);
    }
    const all=[...queries,...sample.noMatch.map((q:{q:string},i:number)=>({id:'no-match-'+i,category:'no-match',q:q.q,judgments:[]}))];
    for(const [i,q] of all.entries()){
        const order=i%2?[...profiles].reverse():profiles;
        for(const profile of order){
            await client.verify(profile);const result=await embed(profile,[formatInput(profile,'query',q.q)],'evaluation');
            const ranked=retrieve(profile,result.vectors[0],q.q);const dense=ranked.dense.map(r=>r.articleId),hybrid=ranked.hybrid.map(r=>r.articleId);
            scored.push({id:q.id,category:q.category,q:q.q,model:profile.name,judgments:q.judgments,lexical:ranked.lexical,dense,hybrid,passages:ranked.dense.slice(0,5),metrics:{lexical:judgedMetrics(ranked.lexical,q.judgments),dense:judgedMetrics(dense,q.judgments),hybrid:judgedMetrics(hybrid,q.judgments)},embeddingWallMs:result.wallMs,rankingMs:ranked.rankingMs,loadDurationNs:result.loadDurationNs,tokens:result.tokens});
        }
        await save('queries.json',scored);
        if(i%10===0)console.log(JSON.stringify({stage:'query',completed:i+1,total:all.length}));
    }
    const repeated=queries.find(q=>q.category==='paraphrase')??queries[0];
    if(repeated)for(let i=0;i<5;i++)for(const profile of i%2?[...profiles].reverse():profiles){const r=await embed(profile,[formatInput(profile,'query',repeated.q)],'warm-repeat');const ranked=retrieve(profile,r.vectors[0],repeated.q);warm.push({model:profile.name,queryId:repeated.id,embeddingWallMs:r.wallMs,rankingMs:ranked.rankingMs,totalMs:r.wallMs+ranked.rankingMs,loadDurationNs:r.loadDurationNs,top:ranked.hybrid.slice(0,5).map(r=>r.articleId)});}
    await save('warm.json',warm);
    for(const p of profiles)await client.verify(p);
    success=true;
}catch(error){await save('failure.json',{error:String(error),failures,indexReports,completedQueries:scored.length,elapsedMs:performance.now()-wallStart});console.error(String(error));process.exitCode=1;}
finally{
    const cleanup=[];
    for(const profile of owned.values()){try{await client.release(profile);cleanup.push({model:profile.name,released:true});}catch(e){cleanup.push({model:profile.name,released:false,error:String(e)});process.exitCode=1;}}
    const summary=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length?{n:s.length,median:s[Math.floor(s.length/2)],p95:s[Math.ceil(s.length*.95)-1],min:s[0],max:s.at(-1)}:null;};
    const average=(values:(number|null)[])=>{const valid=values.filter((v):v is number=>v!==null);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;};
    const reports=profiles.map(profile=>{
        const rows=scored.filter((r:any)=>r.model===profile.name&&r.category!=='no-match') as any[];
        const byCategory=Object.fromEntries([...new Set(rows.map(r=>r.category))].map(category=>[category,Object.fromEntries(['lexical','dense','hybrid'].map(mode=>[mode,{targetRecall5:average(rows.filter(r=>r.category===category).map(r=>r.metrics[mode].targetRecall5)),ndcg5:average(rows.filter(r=>r.category===category).map(r=>r.metrics[mode].ndcg5))}]))]));
        return {model:profile.name,digest:profile.digest,dimensions:profile.dimensions,judgedQueries:rows.length,metrics:Object.fromEntries(['lexical','dense','hybrid'].map(mode=>[mode,{targetRecall5:average(rows.map(r=>r.metrics[mode].targetRecall5)),ndcg5:average(rows.map(r=>r.metrics[mode].ndcg5))}])),byCategory,exactTitleRegressions:rows.filter(r=>r.category==='exact-technical'&&r.hybrid[0]!==r.judgments[0]?.articleId).map(r=>r.id),warm:summary(warm.filter((r:any)=>r.model===profile.name).map((r:any)=>r.totalMs)),queryEmbeddingWallMs:summary(rows.map(r=>r.embeddingWallMs)),noMatchDenseNonempty:scored.filter((r:any)=>r.model===profile.name&&r.category==='no-match'&&r.dense.length>0).length};
    });
    await save('result.json',{complete:success&&process.exitCode!==1,corpusId:corpus.corpusId,judgmentsDigest:digest(sampleText),models:reports,indexes:indexReports,calls:calls.length,failures,elapsedMs:performance.now()-wallStart,cleanup,loadedAfter:await client.snapshot().then(s=>s.loaded),cloudCalls:0,generationCalls:0,productionActivation:false,limitations:plan.limitations});
    console.log(JSON.stringify({complete:success,root,models:reports,calls:calls.length,failures:failures.length,cleanup}));
}
