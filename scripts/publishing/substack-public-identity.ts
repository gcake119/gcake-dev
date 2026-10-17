import {parseHTML} from 'linkedom';
const origin='https://gcakedev.substack.com';
function payload(html:string):Record<string,any>{
 if(html.length>4_000_000)throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');
 // Parse inert data only. Never evaluate the executable hydration wrapper.
 const {document}=parseHTML(html);
 const designated=[...document.querySelectorAll('[id="preloads-json"]')];
 const legacy=[...document.querySelectorAll('script')].filter(script=>!script.hasAttribute('type')||['text/javascript','application/javascript','module'].includes((script.getAttribute('type')??'').trim().toLowerCase())).flatMap(script=>[...(script.textContent??'').matchAll(/window\._preloads\s*=\s*JSON\.parse\(\s*("(?:\\.|[^"\\])*")\s*\)/g)]);
 if(designated.length>1||legacy.length>1||designated.length&&legacy.length||!designated.length&&!legacy.length)throw Error('SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS');
 let data:unknown;
 if(designated.length){
  const node=designated[0];
  if(node.localName!=='script'||(node.getAttribute('type')??'').trim().toLowerCase()!=='application/json')throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');
  try{data=JSON.parse(node.textContent??'');}catch{throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');}
 }else{
  try{data=JSON.parse(JSON.parse(legacy[0][1]));}catch{throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');}
 }
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');
 return data as Record<string,any>;
}
function post(value:any,publicationId:number){
 if(!Number.isSafeInteger(publicationId)||publicationId<=0||!value||!Number.isSafeInteger(value.id)||value.id<=0||value.publication_id!==publicationId||typeof value.canonical_url!=='string')throw Error('SUBSTACK_PUBLIC_IDENTITY_MISMATCH');
 let url:URL;try{url=new URL(value.canonical_url);}catch{throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');}
 if(url.origin!==origin||url.username||url.password||url.search||url.hash||!/^\/p\/[a-z0-9-]+$/.test(url.pathname))throw Error('SUBSTACK_PUBLIC_IDENTITY_MISMATCH');
 return {id:String(value.id),url:url.href};
}
export function parsePublicPostIdentity(html:string,url:string,publicationId:number){const result=post(payload(html).post,publicationId);if(result.url!==url)throw Error('SUBSTACK_PUBLIC_IDENTITY_MISMATCH');return result;}
export function parsePublicArchiveIdentity(html:string,id:string,publicationId:number){
 if(!/^[1-9]\d*$/.test(id))throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');
 const rows=payload(html).newPostsForArchive?.pub;if(!Array.isArray(rows))throw Error('SUBSTACK_PUBLIC_IDENTITY_INVALID');
 const matches=rows.filter(row=>row&&String(row.id)===id);if(matches.length!==1)throw Error('SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS');return post(matches[0],publicationId);
}
export function anonymousArchiveResolver(publicationId:number,fetcher:typeof fetch=fetch){return async(id:string)=>{
 const url=new URL('/archive',origin);url.searchParams.set('verification',String(Date.now()));const response=await fetcher(url,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});if(!response.ok)throw Error('SUBSTACK_PUBLIC_IDENTITY_HTTP_FAILED');return parsePublicArchiveIdentity(await response.text(),id,publicationId);
};}
