import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {DistributionArticle} from '../../apps/admin-worker/src/distribution-coordinator';
import {CloudflareD1Database} from './d1-api';
import {D1PublicationRepository} from '../../apps/admin-worker/src/publication-operations';
import {buildDistributionBundle} from './prepare-distribution';
import {articleFromBundle,reviewDigest,assertTrialScope,type DistributionConfig} from './run-distribution';
import {openFixedSnapshot} from './distribution-inventory';
import {assertPagesPublication} from './pages-publication';
import {renderedArticle} from './substack-browser';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
type Envelope={version:number;requestId:string;slug:string;sourceRevision:string;operation:string;action:string;remoteId:string|null;expiresAt:number;request:{action:string;operation:string;article:DistributionArticle;remote?:{id:string;url:string}}};
type Context={article:DistributionArticle;checkpoint?:{operation:string;sourceRevision:string;substackPolicy?:string};remoteId?:string};
const mutations=new Set(['create','update','publish','metadata']);
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('SUBSTACK_HANDOFF_EVIDENCE_INVALID');return value as Record<string,unknown>;}
function remote(value:unknown,id?:string,publicOnly=false){const r=record(value);if(typeof r.id!=='string'||!/^\d+$/.test(r.id)||id&&id!==r.id||typeof r.url!=='string')throw Error('SUBSTACK_HANDOFF_EVIDENCE_REMOTE');let u:URL;try{u=new URL(r.url);}catch{throw Error('SUBSTACK_HANDOFF_EVIDENCE_REMOTE');}if(u.origin!=='https://gcakedev.substack.com'||u.username||u.password||u.search||u.hash||!(publicOnly?/^\/p\/[^/]+\/?$/.test(u.pathname):u.pathname===`/publish/post/${r.id}`||/^\/p\/[^/]+\/?$/.test(u.pathname)))throw Error('SUBSTACK_HANDOFF_EVIDENCE_REMOTE');return {id:r.id,url:r.url};}
export function validateHandoffRequest(value:unknown,context:Context,now=Date.now()):asserts value is Envelope{
 const e=record(value) as unknown as Envelope;
 if(e.version!==1||typeof e.requestId!=='string'||!e.requestId||!Number.isFinite(e.expiresAt)||e.expiresAt<=now||e.slug!==context.article.slug||e.sourceRevision!==context.article.sourceRevision
  ||!['prepare','publish','verify','retry','finalize'].includes(e.operation)||!['preflight','find','create','update','readDraft','checkPublish','publish','metadata','locatePublic'].includes(e.action)
  ||e.request?.action!==e.action||e.request?.operation!==e.operation||JSON.stringify(e.request?.article)!==JSON.stringify(context.article)||e.remoteId!==(e.request?.remote?.id??null))throw Error('SUBSTACK_HANDOFF_REQUEST_MISMATCH');
 if(e.action==='create'&&context.remoteId)throw Error('SUBSTACK_HANDOFF_REMOTE_ALREADY_SAVED');
 if(e.request.remote){remote(e.request.remote,e.remoteId!);if(context.remoteId!==e.remoteId)throw Error('SUBSTACK_HANDOFF_REMOTE_MISMATCH');}
 if(mutations.has(e.action)){
  const cp=context.checkpoint;
  if(!cp||cp.operation!==e.action||cp.sourceRevision!==e.sourceRevision||cp.substackPolicy!=='full-mirror'
   ||['create','update'].includes(e.action)&&e.operation!=='prepare'||e.action==='publish'&&e.operation!=='publish'||e.action==='metadata'&&!['publish','finalize'].includes(e.operation))throw Error('SUBSTACK_HANDOFF_INTENT_REQUIRED');
 }
}
const normalize=(text:string)=>text.replace(/\s+/g,' ').trim();
const sorted=(values:string[])=>JSON.stringify([...new Set(values)].sort());
export function validateObservedReply(e:Envelope,value:unknown){
 const r=record(value);
 if(e.action==='preflight'){if(r.origin!=='https://gcakedev.substack.com'||r.loggedIn!==true)throw Error('SUBSTACK_HANDOFF_EVIDENCE_LOGIN');return;}
 if(e.action==='find'){if(r.complete!==true||!Array.isArray(r.scanned)||!['draft','published','scheduled'].every(s=>(r.scanned as unknown[]).includes(s))||!Array.isArray(r.items))throw Error('SUBSTACK_HANDOFF_EVIDENCE_SCAN');const items=r.items.map(i=>remote(i));if(new Set(items.map(i=>i.id)).size!==items.length)throw Error('SUBSTACK_HANDOFF_EVIDENCE_DUPLICATE');return;}
 const actual=remote(r,e.remoteId??undefined,['publish','locatePublic'].includes(e.action));
 if(['publish','checkPublish'].includes(e.action)&&(r.emailDisabled!==true||r.scheduleDisabled!==true))throw Error('SUBSTACK_HANDOFF_DELIVERY_REQUIRED');
 if(['update','readDraft','checkPublish','metadata'].includes(e.action)){
  const expected=renderedArticle(e.request.article);
  if(actual.url!==e.request.remote?.url||r.title!==e.request.article.title||typeof r.text!=='string'||normalize(r.text)!==expected.text||r.saved!==true
   ||!Array.isArray(r.links)||!r.links.every(x=>typeof x==='string')||sorted(r.links)!==sorted(expected.links)||!Array.isArray(r.images))throw Error('SUBSTACK_HANDOFF_EVIDENCE_BODY');
  const images=r.images.map(record);if(images.some(i=>typeof i.src!=='string'||typeof i.alt!=='string'||i.loaded!==true)||sorted(images.map(i=>`${i.src}\n${i.alt}`))!==sorted(expected.images.map(i=>`${i.src}\n${i.alt}`)))throw Error('SUBSTACK_HANDOFF_EVIDENCE_IMAGES');
 }
}
export async function writeHandoffReply(file:string,envelope:Envelope,evidence:unknown){
 if(Date.now()>=envelope.expiresAt)throw Error('SUBSTACK_HANDOFF_EXPIRED');validateObservedReply(envelope,evidence);
 await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...envelope,request:undefined,ok:true,result:evidence},null,2)+'\n',{flag:'wx',mode:0o600});
}
export async function main(args=process.argv.slice(2)){
 const [action,...flags]=args;if(!['inspect','proof','reply','inspect-schedule','proof-schedule','reply-schedule','inspect-draft','reply-draft'].includes(action))throw Error('SUBSTACK_HANDOFF_USAGE');const values=new Map<string,string>();
 for(let i=0;i<flags.length;i+=2){if(!['--request','--config','--source-root','--evidence'].includes(flags[i])||values.has(flags[i])||!flags[i+1]||flags[i+1].startsWith('--'))throw Error('DISTRIBUTION_ARGUMENT_INVALID');values.set(flags[i],flags[i+1]);}
 for(const key of ['--request','--config','--source-root'])if(!values.has(key))throw Error('SUBSTACK_HANDOFF_USAGE');if(action==='reply'&&!values.has('--evidence'))throw Error('SUBSTACK_HANDOFF_USAGE');
 if(action.endsWith('-draft')){const {draftHandoff}=await import('./substack-draft-computer-use');return draftHandoff(action,values);}
 if(action.endsWith('-schedule')){const {scheduleHandoff}=await import('./substack-schedule-handoff');return scheduleHandoff(action,values);}
 const config=JSON.parse(await fs.readFile(values.get('--config')!,'utf8')) as DistributionConfig;
 const file=await fs.realpath(values.get('--request')!);if(!config.trial)throw Error('SUBSTACK_HANDOFF_SCOPE_REQUIRED');const rel=path.relative(await fs.realpath(config.trial.sessionDirectory),file);if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||path.basename(file)!=='request.json')throw Error('SUBSTACK_HANDOFF_PATH_MISMATCH');
 const source=path.resolve(values.get('--source-root')!);if(config.trial.sourceCommit!==await openFixedSnapshot(source))throw Error('SUBSTACK_HANDOFF_SOURCE_COMMIT_MISMATCH');
 const bundle=await buildDistributionBundle(config.trial.slug,path.join(source,'src/content/posts'));const article=articleFromBundle(bundle,config.substack.ui.displayedDatePrecision);assertTrialScope(config,article,'substack',reviewDigest(article,'substack'));
 const e=JSON.parse(await fs.readFile(file,'utf8'));
 const db=new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??'');const repo=new D1PublicationRepository(db);const state=(await repo.listStates(article.slug)).find(s=>s.target==='substack');
 validateHandoffRequest(e,{article,checkpoint:await repo.runtime.checkpoint(article.slug,'substack'),remoteId:state?.remoteId});
 const proof=await assertPagesPublication(bundle);
 if(action==='reply'){const observed=JSON.parse(await fs.readFile(values.get('--evidence')!,'utf8'));await writeHandoffReply(file,e,observed);console.log(JSON.stringify({requestId:e.requestId,replied:true,proof}));}
 else console.log(JSON.stringify({requestFile:file,...(action==='proof'?{requestId:e.requestId,action:e.action,remoteId:e.remoteId}:{envelope:e}),proof,...(e.action==='metadata'?{displayedDateMinute:new Date(Date.parse(article.publishedAt!)+480*60000).toISOString().slice(0,16)}:{})}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
