import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {expectedContent,assertScheduleMedia,type ScheduleContent,type ScheduleObservation} from './substack-schedule';
import type {ScheduledSource} from './scheduled-source';
export const DRAFT_MEDIA_PROFILE='original-sha256-png-v1';
export interface SourceImageDigest {src:string;sha256:string;bytes:number;contentType:string;format:'png'|'other'}
const MAX_IMAGES=8,MAX_BYTES=8*1024*1024;
const canonical=(sha:string)=>'urn:gcake:image:sha256:'+sha;
function unavailable():never{throw Error('SUBSTACK_SOURCE_MEDIA_UNAVAILABLE');}
/** Hash public original bytes, not a resized display rendition. No binaries are persisted. */
export async function readImageDigest(src:string,fetcher:typeof fetch=fetch):Promise<SourceImageDigest>{
 let url:URL;try{url=new URL(src);}catch{return unavailable();}
 if(url.protocol!=='https:'||url.username||url.password)return unavailable();
 const response=await fetcher(src,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
 const contentType=response.headers.get('content-type')?.split(';')[0].trim()??'';
 if(!response.ok||!contentType.startsWith('image/')||!response.body){void response.body?.cancel();return unavailable();}
 const declared=Number(response.headers.get('content-length'));if(declared>MAX_BYTES){void response.body.cancel();return unavailable();}
 const reader=response.body.getReader(),hash=createHash('sha256');let bytes=0;const signature:number[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_BYTES){void reader.cancel();return unavailable();}for(const v of value){if(signature.length===8)break;signature.push(v);}hash.update(value);}}
 finally{reader.releaseLock();}
 if(!bytes)return unavailable();
 const png=JSON.stringify(signature)==='[137,80,78,71,13,10,26,10]';
 return {src,sha256:hash.digest('hex'),bytes,contentType,format:png&&contentType==='image/png'?'png':'other'};
}
function sourceImages(source:ScheduledSource){
 const content=expectedContent(source),{document}=parseHTML('<html><body>'+content.html+'</body></html>');
 const images=Array.from(document.querySelectorAll('img'));
 if(images.length>MAX_IMAGES)throw Error('SUBSTACK_UNSUPPORTED_CONTENT');
 for(const img of images){const p=img.parentElement;if(img.closest('a')||p?.tagName!=='P'||Array.from(p.childNodes).some(n=>n!==img&&(n.nodeType!==3||n.textContent?.trim())))throw Error('SUBSTACK_UNSUPPORTED_CONTENT');}
 return {content,images};
}
/** Draft-only source capture reuses the source builder's existing media availability fetch. */
export async function buildDraftSource(root:string,slug:string,fetcher:typeof fetch=fetch){
 const {buildScheduledSource}=await import('./scheduled-source');const digests=new Map<string,SourceImageDigest>();let count=0;
 const source=await buildScheduledSource(root,slug,(async input=>{
  if(++count>MAX_IMAGES)throw Error('SUBSTACK_UNSUPPORTED_CONTENT');const src=String(input),m=await readImageDigest(src,fetcher);digests.set(src,m);
  // The existing builder consumes availability headers only. The actual body was hashed above.
  return new Response(null,{headers:{'content-type':m.contentType}});
 }) as typeof fetch);
 const {images}=sourceImages(source);if(!images.length)return source;
 const media=images.map(i=>digests.get(i.getAttribute('src')!)??unavailable());const prepared={...source,media};expectedDraftContent(prepared);return prepared;
}
export async function prepareDraftSource(source:ScheduledSource,fetcher:typeof fetch=fetch){
 const {images}=sourceImages(source);if(!images.length)return source;
 const media=await Promise.all(images.map(i=>readImageDigest(i.getAttribute('src')!,fetcher)));const prepared={...source,media};expectedDraftContent(prepared);return prepared;
}
function project(content:ScheduleContent,digests:string[]){
 const {document}=parseHTML('<html><body>'+content.html+'</body></html>'),images=Array.from(document.querySelectorAll('img'));
 if(images.length!==digests.length||digests.some(d=>!(/^[a-f0-9]{64}$/).test(d)))throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');
 images.forEach((img,index)=>{
  img.setAttribute('src',canonical(digests[index]));const p=img.parentElement;
  if(p?.tagName==='P'&&Array.from(p.childNodes).every(n=>n===img||n.nodeType===3&&!n.textContent?.trim()))p.replaceWith(img);
 });
 return {...content,html:document.body.innerHTML};
}
export function expectedDraftContent(source:ScheduledSource){
 const {content,images}=sourceImages(source);if(!images.length)return content;
 const media=source.media??[];
 return project(content,images.map(img=>{const m=media.find(i=>i.src===img.getAttribute('src'));if(!m)return unavailable();if(m.format!=='png'||m.contentType!=='image/png')throw Error('SUBSTACK_UNSUPPORTED_CONTENT');if(!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>MAX_BYTES)return unavailable();return m.sha256;}));
}
function originalImage(img:Element,allowed:string[]){
 const src=img.getAttribute('src')??'';let rendered:URL;try{rendered=new URL(src);}catch{return unavailable();}
 if(rendered.protocol!=='https:')return unavailable();
 const isOriginal=(u:URL)=>u.protocol==='https:'&&u.hostname==='substack-post-media.s3.amazonaws.com'&&u.pathname.startsWith('/public/images/')&&!u.username&&!u.password;
 if(isOriginal(rendered))return src;
 if(rendered.hostname==='substackcdn.com'&&rendered.pathname.startsWith('/image/fetch/')){
  const match=rendered.pathname.match(/\/(https%3A%2F%2F[^/]+)$/i);if(!match)return unavailable();
  let decoded:URL;try{decoded=new URL(decodeURIComponent(match[1]));}catch{return unavailable();}
  if(!isOriginal(decoded))return unavailable();
  let attrs;try{attrs=JSON.parse(img.getAttribute('data-attrs')??'null');}catch{return unavailable();}
  if(attrs?.src!==decoded.href)return unavailable();return decoded.href;
 }
 if(allowed.includes(src))return src;
 return unavailable();
}
export async function normalizeDraftObservation(observation:ScheduleObservation,fetcher:typeof fetch=fetch,allowedSources:string[]=[]){
 assertScheduleMedia(observation);
 const {document}=parseHTML('<html><body>'+observation.content.html+'</body></html>'),images=Array.from(document.querySelectorAll('img'));
 if(images.length>MAX_IMAGES)throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');
 const verified=await Promise.all(images.map(async img=>{
  const original=originalImage(img,allowedSources),m=await readImageDigest(original,fetcher);if(m.format!=='png')return unavailable();
  return {...m,renderedSrc:img.getAttribute('src')!,alt:img.getAttribute('alt')??''};
 }));
 if(!verified.length)return {observation,images:verified};
 const content=project(observation.content,verified.map(i=>i.sha256));
 return {observation:{...observation,content,images:verified.map(i=>({src:canonical(i.sha256),alt:i.alt,loaded:true}))},images:verified};
}
