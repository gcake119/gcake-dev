import {parsePublicPostIdentity} from './substack-public-identity';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DistributionArticle, RemoteArticle, SubstackBrowserAdapter } from '../../apps/admin-worker/src/distribution-coordinator';
import type { DistributionRuntime } from '../../apps/admin-worker/src/distribution-runtime';
import { renderedArticle, assertPublicDomEvidence, expectedSubstackDate, type PublicDomEvidence, type SubstackUiContract } from './substack-browser';
import { parseHTML } from 'linkedom';
export type AttendedOperation='prepare'|'publish'|'verify'|'retry'|'finalize';
export type AttendedAction='preflight'|'find'|'create'|'update'|'readDraft'|'checkPublish'|'publish'|'metadata'|'locatePublic';
export interface AttendedRequest { action:AttendedAction; article:DistributionArticle; operation:AttendedOperation; remote?:RemoteArticle; html?:string; }
export type AttendedExchange=(request:AttendedRequest)=>Promise<unknown>;
const origin='https://gcakedev.substack.com';
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const sorted=(values:string[])=>JSON.stringify([...new Set(values)].sort());
function object(value:unknown):Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw Error('SUBSTACK_ATTENDED_REPLY_INVALID');
  return value as Record<string,unknown>;
}
function remoteArticle(value:unknown,expectedId?:string,publicOnly=false):RemoteArticle {
  const data=object(value);
  if (typeof data.id!=='string'||!/^\d+$/.test(data.id)||expectedId && data.id!==expectedId||typeof data.url!=='string') throw Error('SUBSTACK_ATTENDED_REMOTE_MISMATCH');
  let url:URL; try {url=new URL(data.url);} catch {throw Error('SUBSTACK_ATTENDED_REMOTE_MISMATCH');}
  const draft=url.pathname===`/publish/post/${data.id}`;
  const publicPost=/^\/p\/[^/]+\/?$/.test(url.pathname);
  if (url.origin!==origin||url.username||url.password||url.hash||url.search||!(publicOnly?publicPost:draft||publicPost)) throw Error('SUBSTACK_ATTENDED_REMOTE_MISMATCH');
  return {id:data.id,url:url.href};
}
export class FileAttendedExchange {
  private constructor(readonly directory:string,private readonly timeoutMs:number,private readonly pollMs:number,private readonly onRequest:(file:string)=>Promise<void>) {}
  static async create(base:string,repository:string,timeoutMs=900_000,pollMs=100,onRequest:(file:string)=>Promise<void>=async file=>{console.log(JSON.stringify({attendedRequest:file}));}) {
    const outside=(basePath:string)=>{const relative=path.relative(path.resolve(repository),basePath);return relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative);};
    if (!outside(path.resolve(base))||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>900_000||!Number.isFinite(pollMs)||pollMs<=0) throw Error('SUBSTACK_SESSION_OUTSIDE_GIT');
    await fs.mkdir(base,{recursive:true,mode:0o700});
    if (!outside(await fs.realpath(base))) throw Error('SUBSTACK_SESSION_OUTSIDE_GIT');
    const directory=await fs.mkdtemp(path.join(base,'session-')); await fs.chmod(directory,0o700);
    return new FileAttendedExchange(directory,timeoutMs,pollMs,onRequest);
  }
  readonly exchange:AttendedExchange=async request=>{
    const requestId=randomUUID(), directory=path.join(this.directory,requestId), expiresAt=Date.now()+this.timeoutMs;
    await fs.mkdir(directory,{mode:0o700});
    const envelope={version:1,requestId,slug:request.article.slug,sourceRevision:request.article.sourceRevision,operation:request.operation,action:request.action,remoteId:request.remote?.id??null,expiresAt,request};
    const file=path.join(directory,'request.json');
    await fs.writeFile(file,JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o600});
    await this.onRequest(file);
    while (Date.now()<expiresAt) {
      let raw:string;
      try {raw=await fs.readFile(path.join(directory,'reply.json'),'utf8');}
      catch (error) {if ((error as NodeJS.ErrnoException).code!=='ENOENT') throw Error('SUBSTACK_ATTENDED_REPLY_INVALID'); await new Promise(resolve=>setTimeout(resolve,this.pollMs));continue;}
      let reply:Record<string,unknown>; try {reply=object(JSON.parse(raw));} catch {throw Error('SUBSTACK_ATTENDED_REPLY_INVALID');}
      for (const key of ['version','requestId','slug','sourceRevision','operation','action','remoteId'] as const) if (reply[key]!==envelope[key]) throw Error('SUBSTACK_ATTENDED_REPLY_MISMATCH');
      if (Date.now()>=expiresAt) throw Error('SUBSTACK_ATTENDED_TIMEOUT');
      if (reply.ok!==true) throw Error('SUBSTACK_ATTENDED_OPERATOR_STOPPED');
      return reply.result;
    }
    throw Error('SUBSTACK_ATTENDED_TIMEOUT');
  };
}
export class AttendedSubstackAdapter implements SubstackBrowserAdapter {
  readonly publicationPolicy='full-mirror' as const;
  constructor(private readonly article:DistributionArticle,private readonly operation:AttendedOperation,private readonly runtime:DistributionRuntime,private readonly exchange:AttendedExchange,private readonly publicReader:(remote:RemoteArticle)=>Promise<PublicDomEvidence>,private readonly beforeWrite?:()=>Promise<unknown>) {}
  private sameArticle(article:DistributionArticle) {
    if (JSON.stringify(article)!==JSON.stringify(this.article)) throw Error('SUBSTACK_ATTENDED_ARTICLE_MISMATCH');
  }
  private async request(action:AttendedAction,article=this.article,remote?:RemoteArticle) {
    this.sameArticle(article);
    if (remote) remoteArticle(remote);
    if (['create','update','publish','metadata'].includes(action)) {
      if ((action==='create'||action==='update') && this.operation!=='prepare'
        || action==='publish' && this.operation!=='publish'
        || action==='metadata' && !['publish','finalize'].includes(this.operation)) throw Error('SUBSTACK_ATTENDED_OPERATION_MISMATCH');
      const cp=await this.runtime.checkpoint(article.slug,'substack');
      if (!cp||cp.operation!==action||cp.sourceRevision!==article.sourceRevision||cp.substackPolicy!=='full-mirror') throw Error('SUBSTACK_ATTENDED_INTENT_REQUIRED');
      await this.beforeWrite?.();
    }
    return this.exchange({action,article,operation:this.operation,remote,...(action==='update'?{html:renderedArticle(article).html}:{})});
  }
  private draft(value:unknown,remote:RemoteArticle,article:DistributionArticle) {
    const data=object(value),expected=renderedArticle(article);
    const actual=remoteArticle(data,remote.id);
    if (actual.url!==remote.url||data.title!==article.title||typeof data.text!=='string'||normalize(data.text)!==expected.text||data.saved!==true
      ||!Array.isArray(data.links)||!data.links.every(link=>typeof link==='string')||sorted(data.links)!==sorted(expected.links)
      ||!Array.isArray(data.images)) throw Error('SUBSTACK_ATTENDED_DRAFT_EVIDENCE_MISMATCH');
    const images=data.images.map(image=>object(image));
    if (images.some(image=>typeof image.src!=='string'||typeof image.alt!=='string'||image.loaded!==true)
      ||sorted(images.map(image=>`${image.src}\n${image.alt}`))!==sorted(expected.images.map(image=>`${image.src}\n${image.alt}`))) throw Error('SUBSTACK_ATTENDED_DRAFT_EVIDENCE_MISMATCH');
  }
  async preflight() {const response=object(await this.request('preflight'));if (response.origin!==origin||response.loggedIn!==true) throw Error('SUBSTACK_LOGIN_REQUIRED');}
  async find(article:DistributionArticle) {
    const response=object(await this.request('find',article));
    if (response.complete!==true||!Array.isArray(response.scanned)||!['draft','published','scheduled'].every(status=>(response.scanned as unknown[]).includes(status))||!Array.isArray(response.items)) throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
    const items=response.items.map(item=>remoteArticle(item));
    if (new Set(items.map(item=>item.id)).size!==items.length) throw Error('SUBSTACK_DUPLICATE_REMOTE');
    return items;
  }
  async create(article:DistributionArticle) {return remoteArticle(await this.request('create',article));}
  async update(remote:RemoteArticle,article:DistributionArticle) {this.draft(await this.request('update',article,remote),remote,article);}
  async readDraft(remote:RemoteArticle,article:DistributionArticle) {this.draft(await this.request('readDraft',article,remote),remote,article);}
  async checkPublish(remote:RemoteArticle,article:DistributionArticle) {
    const response=object(await this.request('checkPublish',article,remote));this.draft(response,remote,article);
    if (response.emailDisabled!==true||response.scheduleDisabled!==true) throw Error('SUBSTACK_EMAIL_MUST_BE_DISABLED');
  }
  async publish(remote:RemoteArticle,article:DistributionArticle) {
    const response=object(await this.request('publish',article,remote));
    if (response.emailDisabled!==true||response.scheduleDisabled!==true) throw Error('SUBSTACK_EMAIL_MUST_BE_DISABLED');
    return remoteArticle(response,remote.id,true);
  }
  private async publicRemote(remote:RemoteArticle,article:DistributionArticle) {
    this.sameArticle(article);
    if (new URL(remoteArticle(remote).url).pathname.startsWith('/publish/')) return remoteArticle(await this.request('locatePublic',article,remote),remote.id,true);
    return remoteArticle(remote,remote.id,true);
  }
  async verify(remote:RemoteArticle,article:DistributionArticle) {
    const actual=await this.publicRemote(remote,article);
    assertPublicDomEvidence(article,await this.publicReader(actual),{policy:'full-mirror',remoteUrl:actual.url});return actual;
  }
  async finalizePublishedDate(remote:RemoteArticle,article:DistributionArticle) {
    const actual=await this.publicRemote(remote,article),evidence=await this.publicReader(actual);
    assertPublicDomEvidence(article,evidence,{policy:'full-mirror',remoteUrl:actual.url,ignoreDate:true});
    if ((article.substackDatePrecision === 'minute' ? Math.floor(Date.parse(evidence.publishedAt)/60_000)*60_000 : Date.parse(evidence.publishedAt))===expectedSubstackDate(article)) return actual;
    this.draft(await this.request('metadata',article,actual),actual,article);
    assertPublicDomEvidence(article,await this.publicReader(actual),{policy:'full-mirror',remoteUrl:actual.url});return actual;
  }
}
export function anonymousSubstackReader(ui:SubstackUiContract,fetcher:typeof fetch=fetch) {
  return async (remote:RemoteArticle):Promise<PublicDomEvidence>=>{
    remoteArticle(remote,remote.id,true);
    if ([ui.publicBody,ui.publicTitle,ui.publicDate].some(selector=>!selector||selector==='UNVERIFIED')) throw Error('SUBSTACK_PUBLIC_CONTROLS_UNVERIFIED');
    const readUrl=new URL(remote.url); readUrl.searchParams.set('verification',`${Date.now()}-${randomUUID()}`);
    const response=await fetcher(readUrl.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30_000)});
    if (!response.ok) throw Error('SUBSTACK_PUBLIC_HTTP_FAILED');
    const html=await response.text();
    const identity=ui.publicIdentity?parsePublicPostIdentity(html,remote.url,ui.publicIdentity.publicationId):undefined;
    if(identity&&identity.id!==remote.id)throw Error('SUBSTACK_PUBLIC_IDENTITY_MISMATCH');
    const {document}=parseHTML(html);
    // HTML attribute names are case-insensitive. linkedom retains React SSR's
    // dateTime spelling, so normalize before applying the reviewed selector.
    // Reject conflicting spellings instead of choosing one by attribute order.
    for (const time of document.querySelectorAll('time')) {
      const dates=[...time.attributes].filter(attribute=>attribute.name.toLowerCase()==='datetime');
      if (dates.length>1) throw Error('SUBSTACK_PUBLIC_DATE_AMBIGUOUS');
      if (dates.length===1&&dates[0].name!=='datetime') {
        const {name,value}=dates[0];time.removeAttribute(name);time.setAttribute('datetime',value);
      }
    }
    const unique=(selector:string)=>{const nodes=document.querySelectorAll(selector);if (nodes.length!==1) throw Error('SUBSTACK_PUBLIC_CONTROLS_AMBIGUOUS');return nodes[0];};
    const body=unique(ui.publicBody),date=unique(ui.publicDate);
    // Match the block boundaries used by the existing browser evidence verifier.
    for (const element of body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr,br,hr')) element.appendChild(document.createTextNode(' '));
    const images=await Promise.all([...body.querySelectorAll('img')].map(async image=>{
      const src=new URL(image.getAttribute('src')??'',remote.url).href;
      if (!/^https:\/\//.test(src)) throw Error('SUBSTACK_PUBLIC_IMAGE_URL_INVALID');
      const loaded=await fetcher(src,{signal:AbortSignal.timeout(30_000)});
      return {src,alt:image.getAttribute('alt')??'',loaded:loaded.ok&&(loaded.headers.get('content-type')??'').startsWith('image/')};
    }));
    return {...(identity?{postId:identity.id,publicationId:ui.publicIdentity!.publicationId}:{}),title:unique(ui.publicTitle).textContent??'',text:body.textContent??'',canonical:unique('link[rel="canonical"]').getAttribute('href')??'',publishedAt:date.getAttribute('datetime')??date.getAttribute('content')??date.textContent??'',links:[...body.querySelectorAll('a')].map(link=>new URL(link.getAttribute('href')??'',remote.url).href),images};
  };
}
