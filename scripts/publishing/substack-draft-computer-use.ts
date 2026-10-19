import {buildDraftSource,expectedDraftContent,type SourceImageDigest} from './substack-draft-media';
import {validateDraftActivation} from './substack-draft-activation';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ScheduleRepository,type ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
import {contentFingerprint,type ScheduleObservation} from './substack-schedule';
import {validateScheduleObservation} from './substack-schedule-attended';
import {assertOutsideAnyGit,type ExchangeRequest} from './substack-attended';
import {assertDraftPolicy,type DraftPort,type DraftSyncPolicy} from './substack-draft-sync';
import {buildScheduledSource,type ScheduledSource} from './scheduled-source';
import {CloudflareD1Database} from './d1-api';
import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
export interface DraftExchangeRequest extends ExchangeRequest {
 exchangeVersion:2;action:'draft-find'|'draft-read'|'draft-create'|'draft-update';operation:'sync-draft';draftOnly:true;
 draftPolicyVersion:'unattended-draft-sync-v1';recordVersion:number;sourceCommit:string;scheduleId:string;intentId?:string;
 sourceMedia?:SourceImageDigest[];forbiddenActions:['arm','remove','publish','send'];precondition?:{digest:string;state:'draft'};
}
function draft(e:ScheduleObservation,r:DraftExchangeRequest){
 validateScheduleObservation(e,r.remote?.id);
 if(e.state!=='draft'||e.slug!==r.article.slug||e.listEvidence?.draft!==true||e.listEvidence.scheduled!==false||e.scheduledAt)throw Error('SUBSTACK_DRAFT_FOREGROUND_REQUIRED');
}
export function validateDraftReply(r:DraftExchangeRequest,value:unknown){
 const v=value as {sessionExclusive?:boolean;reloaded?:boolean;observation?:ScheduleObservation;before?:ScheduleObservation;complete?:boolean;scanned?:string[];items?:ScheduleObservation[]};
 if(!v||v.sessionExclusive!==true||v.reloaded!==true)throw Error('SUBSTACK_DRAFT_UI_EVIDENCE_INVALID');
 if(r.action==='draft-find'){
  if(v.complete!==true||!Array.isArray(v.scanned)||!['draft','scheduled','published'].every(s=>v.scanned!.includes(s))||!Array.isArray(v.items))throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
  v.items.forEach(e=>validateScheduleObservation(e));if(new Set(v.items.map(e=>e.id)).size!==v.items.length)throw Error('SUBSTACK_DUPLICATE_REMOTE');return v;
 }
 const e=validateScheduleObservation(v.observation,r.remote?.id);
 if(r.action==='draft-read')return e; // A read can truthfully report a scheduled/public state; the core will defer it.
 draft(e,r);
 if(contentFingerprint(e.content)!==contentFingerprint(expectedDraftContent({article:r.article,media:r.sourceMedia} as ScheduledSource)))throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
 if(r.action==='draft-update'){
  if(!v.before||!r.precondition)throw Error('SUBSTACK_DRAFT_UI_EVIDENCE_INVALID');draft(v.before,r);
  if(contentFingerprint(v.before.content)!==r.precondition.digest)throw Error('SUBSTACK_REMOTE_EDIT_CONFLICT');
 }
 return e;
}
export class ComputerUseDraftPort implements DraftPort {
 constructor(private readonly source:ScheduledSource,private readonly repo:ScheduleRepository,private readonly exchange:(r:DraftExchangeRequest)=>Promise<unknown>,private readonly beforeDispatch:()=>Promise<void>){}
 private async send(action:DraftExchangeRequest['action'],id?:string,precondition?:DraftExchangeRequest['precondition']){
  await this.beforeDispatch();const s=await this.repo.bySlug(this.source.slug);if(!s)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');
  if(['draft-create','draft-update'].includes(action)&&(!s.intent||s.intent.action!==(action==='draft-create'?'create':'update-draft')||s.remoteId!==id||s.intent.sourceRevision!==this.source.sourceRevision))throw Error('SUBSTACK_HANDOFF_INTENT_REQUIRED');
  const r:DraftExchangeRequest={exchangeVersion:2,action,operation:'sync-draft',draftOnly:true,draftPolicyVersion:'unattended-draft-sync-v1',forbiddenActions:['arm','remove','publish','send'],article:this.source.article,sourceCommit:this.source.sourceCommit,...(this.source.media?.length?{sourceMedia:this.source.media}:{}),recordVersion:s.version,scheduleId:s.scheduleId,intentId:s.intent?.id,remote:id?{id,url:'https://gcakedev.substack.com/publish/post/'+id}:undefined,precondition};
  return validateDraftReply(r,await this.exchange(r));
 }
 async find(s:ScheduledSource){this.same(s);return await this.send('draft-find') as {complete:boolean;scanned:string[];items:ScheduleObservation[]};}
 async read(id:string){return await this.send('draft-read',id) as ScheduleObservation;}
 async create(s:ScheduledSource){this.same(s);return (await this.send('draft-create') as ScheduleObservation).id;}
 async update(id:string,s:ScheduledSource,p:NonNullable<DraftExchangeRequest['precondition']>){this.same(s);await this.send('draft-update',id,p);}
 private same(s:ScheduledSource){if(JSON.stringify(s)!==JSON.stringify(this.source))throw Error('SUBSTACK_SOURCE_CHANGED');}
}
interface Envelope {version:2;requestId:string;scopeDigest:string;expiresAt:number;slug:string;sourceRevision:string;remoteId:string|null;action:string;operation:string;request:DraftExchangeRequest}
export function validateDraftHandoff(e:Envelope,state:ScheduleRecord,source:ScheduledSource,now=Date.now()){
 const r=e?.request;
 if(!r||e.version!==2||!e.requestId||!Number.isFinite(e.expiresAt)||e.expiresAt<=now||e.scopeDigest!==createHash('sha256').update(JSON.stringify(r)).digest('hex')||r.exchangeVersion!==2||r.draftOnly!==true||r.draftPolicyVersion!=='unattended-draft-sync-v1'||r.operation!=='sync-draft'||!['draft-find','draft-read','draft-create','draft-update'].includes(r.action)||e.action!==r.action||e.operation!==r.operation||e.slug!==state.slug||e.slug!==source.slug||e.sourceRevision!==source.sourceRevision||e.remoteId!==(r.remote?.id??null)||r.scheduleId!==state.scheduleId||r.recordVersion!==state.version||r.sourceCommit!==source.sourceCommit||JSON.stringify(r.article)!==JSON.stringify(source.article)||JSON.stringify(r.sourceMedia??[])!==JSON.stringify(source.media??[]))throw Error('SUBSTACK_HANDOFF_REQUEST_MISMATCH');
 if(r.remote&&(r.remote.id!==state.remoteId||r.remote.url!=='https://gcakedev.substack.com/publish/post/'+state.remoteId)||r.action==='draft-create'&&state.remoteId)throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
 if(r.action==='draft-create'||r.action==='draft-update'){
  if(state.observedState==='scheduled'||state.everPublished||state.legacyPublished||state.delivery!=='not_armed'||!state.intent||state.intent.id!==r.intentId||state.intent.action!==(r.action==='draft-create'?'create':'update-draft')||state.intent.sourceRevision!==source.sourceRevision)throw Error('SUBSTACK_HANDOFF_INTENT_REQUIRED');
 }
 if(r.action==='draft-update'&&(!r.precondition||r.precondition.state!=='draft'||!r.precondition.digest))throw Error('SUBSTACK_DRAFT_UI_EVIDENCE_INVALID');
}
export async function draftHandoff(action:string,values:Map<string,string>,deps:{database?:D1DatabaseLike;readSource?:typeof buildScheduledSource;assertMain?:(root:string,commit:string)=>Promise<void>;verifyActivation?:(policy:DraftSyncPolicy)=>Promise<void>}={}){
 const configFile=values.get('--config')!;
 const readPolicy=async()=>{const c=JSON.parse(await fs.readFile(configFile,'utf8'));assertDraftPolicy(c.draftSync,new Date().toISOString());if(deps.verifyActivation)await deps.verifyActivation(c.draftSync);else await validateDraftActivation(c.draftSync,c.draftSync.runtimePinFile,new Date().toISOString());return c.draftSync;};
 await readPolicy();const root=await fs.realpath(values.get('--source-root')!),base=await fs.realpath(path.join(path.dirname(root),'draft-sessions')),file=await fs.realpath(values.get('--request')!);
 assertOutsideAnyGit(base);const rel=path.relative(base,file);if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||path.basename(file)!=='request.json')throw Error('SUBSTACK_HANDOFF_PATH_MISMATCH');
 const e=JSON.parse(await fs.readFile(file,'utf8')) as Envelope;
 const repo=new ScheduleRepository(deps.database??new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??''));
 const check=async()=>{
  await readPolicy();const state=await repo.get(e.request.scheduleId);if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');
  const s=await (deps.readSource??buildDraftSource)(root,state.slug);
  if(deps.assertMain)await deps.assertMain(root,s.sourceCommit);else if(execFileSync('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8',timeout:30000}).trim().split(/\s+/)[0]!==s.sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');
  validateDraftHandoff(e,state,s);return state;
 };
 const state=await check();
 if(action==='reply-draft'){
  if(!values.has('--evidence'))throw Error('SUBSTACK_HANDOFF_USAGE');const value=JSON.parse(await fs.readFile(values.get('--evidence')!,'utf8'));validateDraftReply(e.request,value);await check();
  await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...e,request:undefined,ok:true,result:value})+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({requestId:e.requestId,replied:true}));
 }else console.log(JSON.stringify({envelope:e,observed:state,instructions:'Use only the authorized Computer Use session. Inspect all lists for discovery; for updates re-read unscheduled draft and exact precondition immediately before editing. Never Continue/Publish/arm/remove/send. Save title, description, full body, slug and media/alt; navigate away and reload this original ID, then capture complete observation and list evidence. Stop on challenge, changed state, source, conflict or unknown outcome. No private endpoints or login export.'}));
}
