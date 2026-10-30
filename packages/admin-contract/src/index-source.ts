import {boundedJson,boundedText,type SourceTotal} from './index-status.js';
const manifestUrl='https://gcake119.github.io/gcake-dev/discovery-manifest.json';
const hash=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
/** Cache verified source totals only, keyed by all immutable asset descriptors. Never cache status. */
export interface PublicSourceCache {identity:string;assets:Record<string,string>;}
interface CacheStore {load?:()=>Promise<PublicSourceCache|null>;save?:(value:PublicSourceCache)=>Promise<void>;}
export function createIndexSourceReader(fetcher:typeof fetch=fetch,store:CacheStore={}){
 let cached:SourceTotal|undefined;
 async function manifest(signal:AbortSignal){
  const s=AbortSignal.any([signal,AbortSignal.timeout(2000)]);
  const m:any=await boundedJson(await fetcher(manifestUrl,{signal:s,redirect:'manual',cache:'no-store'}),s,32768);
  if(m?.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(m.corpusId))throw Error('INVALID_SOURCE');
  for(const k of ['index','passages','connections']){const a=m.assets?.[k];if(typeof a?.href!=='string'||!/^[a-f0-9]{64}$/.test(a?.digest))throw Error('INVALID_SOURCE');const u=new URL(a.href,manifestUrl);if(u.origin!==new URL(manifestUrl).origin||u.pathname!==`/gcake-dev/discovery/${m.corpusId}/${k}.json`||u.search||u.hash)throw Error('INVALID_SOURCE');}
  return {m,identity:JSON.stringify([m.corpusId,...['index','passages','connections'].flatMap(k=>[m.assets[k].href,m.assets[k].digest])])};
 }
 return async(signal:AbortSignal):Promise<SourceTotal>=>{
  const before=await manifest(signal);let value=cached?.sourceIdentity===before.identity?cached:undefined;
  let toSave:PublicSourceCache|undefined;
  if(!value){
   const saved=await store.load?.();
   const texts:Record<string,string>={};
   const s=AbortSignal.any([signal,AbortSignal.timeout(15000)]),abort=new AbortController(),bounded=AbortSignal.any([s,abort.signal]);
   let assets:any[];
   try{assets=await Promise.all(['index','passages','connections'].map(async k=>{const text=saved?.identity===before.identity?saved.assets[k]:await boundedText(await fetcher(new URL(before.m.assets[k].href,manifestUrl),{signal:bounded,redirect:'manual',cache:'no-store'}),bounded,8*1024*1024);if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>8*1024*1024||await hash(text)!==before.m.assets[k].digest)throw Error('SOURCE_DIGEST_MISMATCH');texts[k]=text;return JSON.parse(text);}));}finally{abort.abort();}
   const [index,passages,connections]=assets;
   if(!object(index)||index.schemaVersion!==1||index.corpusId!==before.m.corpusId||!Array.isArray(index.articles)||!Array.isArray(passages)||!object(connections))throw Error('INVALID_SOURCE');
   const articles=new Map(index.articles.map((a:any)=>[a.articleId,a.sourceRevision]));const ids=new Set<string>();
   for(const p of passages){if(!object(p)||typeof p.passageId!=='string'||!p.passageId||ids.has(p.passageId)||!articles.has(p.articleId)||articles.get(p.articleId)!==p.revision)throw Error('INVALID_SOURCE');ids.add(p.passageId);}
   value={corpusId:before.m.corpusId,total:passages.length,sourceIdentity:before.identity};
   if(saved?.identity!==before.identity)toSave={identity:before.identity,assets:texts};
  }
  const after=await manifest(signal);if(after.identity!==before.identity)throw Error('SOURCE_CHANGED');
  if(toSave)await store.save?.(toSave);cached=value;return {...value};
 };
}
