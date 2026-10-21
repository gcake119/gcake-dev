/** Foreground preview adapter; excluded from the public bundle and Worker. */
import { search } from '../../src/lib/discovery/search';
import type { Corpus } from '../../src/lib/discovery/types';
import { normalizeVector, rankLocal, fuseLocal, type LocalIndex } from './ollama';
export function decodeCachedVector(bytes:Buffer,dimensions:number){
    if(bytes.length!==dimensions*4)throw Error('INVALID_CACHE');
    const values=Array.from({length:dimensions},(_,i)=>bytes.readFloatLE(i*4));
    normalizeVector(values,dimensions);
    if(Math.abs(Math.hypot(...values)-1)>.001)throw Error('INVALID_CACHE');
    return new Float32Array(values);
}
export function previewHtml(html:string){return html.replace(/data-semantic=""/g,'data-semantic="/gcake-dev/local-search" data-local-semantic="true"');}
export function createLocalSearch(corpus:Corpus,index:LocalIndex,embed:(signal:AbortSignal,q:string)=>Promise<number[]>,available=()=>true,timeoutMs=4000){
    if(index.space.corpusId!==corpus.corpusId||index.items.length!==corpus.passages.length||index.vectors.length!==index.items.length)throw Error('CORPUS_MISMATCH');
    let busy=false;
    const fail=(status:number)=>Response.json({error:'LOCAL_SEARCH_UNAVAILABLE'},{status});
    return async(request:Request):Promise<Response>=>{
        const url=new URL(request.url),origin=request.headers.get('origin');
        if(!['127.0.0.1','[::1]'].includes(url.hostname)||(origin&&origin!==url.origin))return fail(403);
        if(request.method!=='POST')return fail(405);
        let b:any;
        try{const text=await request.text();if(Buffer.byteLength(text)>4096)throw Error();b=JSON.parse(text);
            if(!b||typeof b.q!=='string'||!b.q.trim()||[...b.q].length>200||typeof b.corpusId!=='string'||b.limit!==10||!Number.isSafeInteger(b.page)||b.page<1||!['relevance','newest'].includes(b.sort)||typeof b.topic!=='string'||typeof b.series!=='string'||Object.keys(b).some(k=>!['q','corpusId','topic','series','page','sort','limit'].includes(k)))throw Error();
        }catch{return fail(400);}
        if(b.corpusId!==corpus.corpusId)return fail(409);
        if(!available())return fail(503);
        if(busy)return fail(429);
        busy=true;
        const deadline=new AbortController(),signal=AbortSignal.any([request.signal,deadline.signal]);
        const timer=setTimeout(()=>deadline.abort(),timeoutMs);
        try{
            const aborted=new Promise<never>((_,reject)=>{if(signal.aborted)reject(Error('ABORTED'));else signal.addEventListener('abort',()=>reject(Error('ABORTED')),{once:true});});
            const values=await Promise.race([embed(signal,b.q.trim()),aborted]);
            if(signal.aborted)throw Error('ABORTED');
            const dense=rankLocal(index,{space:index.space,values});
            const lexical=Array.from({length:5},(_,i)=>search(corpus,b.q,{...b,page:i+1}).results).flat();
            const eligible=new Map(corpus.articles.filter(a=>(!b.topic||a.topics.includes(b.topic))&&(!b.series||a.series===b.series)).map(a=>[a.articleId,a]));
            const ranked=fuseLocal(lexical.map(r=>r.articleId),dense.map(r=>r.articleId),dense.map(r=>r.passageRank)).filter(r=>eligible.has(r.articleId));
            if(b.sort==='newest')ranked.sort((a,b)=>eligible.get(b.articleId)!.publishedAt.localeCompare(eligible.get(a.articleId)!.publishedAt)||a.articleId.localeCompare(b.articleId));
            const total=ranked.length,page=Math.min(b.page,Math.max(1,Math.ceil(total/10)));
            const results=ranked.slice((page-1)*10,page*10).map(r=>{const a=eligible.get(r.articleId)!,hit=dense.find(d=>d.articleId===r.articleId),p=corpus.passages.find(p=>p.articleId===r.articleId&&p.passageId===hit?.passageId&&p.revision===a.sourceRevision);return {...r,passageId:p?.passageId,title:a.title,readingHref:p?.href??a.href,excerpt:[...(p?.text??a.description)].slice(0,120).join(''),series:a.seriesTitle,topics:a.topics};});
            return Response.json({corpusId:corpus.corpusId,mode:'hybrid',total,page,hasMore:page*10<total,candidateLimited:ranked.length===50,results});
        }catch{return fail(503);}finally{clearTimeout(timer);busy=false;}
    };
}
