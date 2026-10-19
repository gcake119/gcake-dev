import {expectedDraftContent,DRAFT_MEDIA_PROFILE} from './substack-draft-media';
import {randomUUID} from 'node:crypto';
import type {DistributionRuntime} from '../../apps/admin-worker/src/distribution-runtime';
import {ScheduleRepository,SCHEDULE_POLICY,type ScheduleRecord,type DraftSyncEvidence} from '../../apps/admin-worker/src/substack-schedules';
import {contentFingerprint,type ScheduleObservation} from './substack-schedule';
import {validateScheduleObservation} from './substack-schedule-attended';
import type {ScheduledSource} from './scheduled-source';
export const DRAFT_SYNC_POLICY='unattended-draft-sync-v1' as const;
export interface DraftSyncPolicy {policyVersion:typeof DRAFT_SYNC_POLICY;transport:'computer-use';enabled:boolean;writeEnabled:boolean;origin:string;repository:string;branch:string;expiresAt:string;qualificationRef:string;authorizationRef:string;sessionExclusive:boolean;runtimePinFile?:string;allowCreate?:boolean;mediaProfile?:typeof DRAFT_MEDIA_PROFILE;executor?:string;browserName?:string;evidenceDirectory?:string;maxArticles?:number;timeoutMs?:number;maxRoundMs?:number}
export function assertDraftPolicy(p:DraftSyncPolicy|undefined,now:string){
 if(!p||p.enabled!==true||p.writeEnabled!==true)throw Error('SUBSTACK_DRAFT_SYNC_DISABLED');
 if(p.mediaProfile!==undefined&&p.mediaProfile!==DRAFT_MEDIA_PROFILE)throw Error('SUBSTACK_DRAFT_SYNC_UNQUALIFIED');
 if(p.policyVersion!==DRAFT_SYNC_POLICY||p.transport!=='computer-use'||p.origin!=='https://gcakedev.substack.com'||p.repository!=='gcake119/gcake-dev'||p.branch!=='main'||!p.qualificationRef||!p.authorizationRef||p.sessionExclusive!==true||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.parse(now))throw Error('SUBSTACK_DRAFT_SYNC_UNQUALIFIED');
}
export interface DraftPort {
 find(source:ScheduledSource):Promise<{complete:boolean;scanned:string[];items:ScheduleObservation[]}>;
 read(id:string):Promise<ScheduleObservation>;
 create(source:ScheduledSource):Promise<string>;
 update(id:string,source:ScheduledSource,precondition:{digest:string;state:'draft'}):Promise<void>;
}
interface Context {readPolicy():Promise<DraftSyncPolicy|undefined>;readSource():Promise<ScheduledSource|undefined>;now():string}
const isDraft=(e:ScheduleObservation)=>e.state==='draft'&&e.listEvidence?.draft===true&&e.listEvidence.scheduled===false&&!e.scheduledAt;
const protectedRecord=(s:ScheduleRecord)=>s.observedState==='scheduled'||s.everPublished||s.legacyPublished||['verified','published_unverified'].includes(s.observedState)||s.delivery==='armed'||s.delivery==='provider_reported'||s.desiredState==='scheduled';
const bounded=(e:unknown)=>e instanceof Error&&/^SUBSTACK_[A-Z_]+$/.test(e.message)?e.message:'SUBSTACK_DRAFT_READ_INCONCLUSIVE';
/** Provider writes exist only on the selected Computer Use port; the observer has no such port. */
export class DraftSyncCoordinator {
 constructor(readonly repo:ScheduleRepository,readonly runtime:DistributionRuntime,readonly provider:DraftPort,readonly context:Context){}
 async sync(slug:string):Promise<ScheduleRecord>{
  await this.authority();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('SUBSTACK_SOURCE_INVALID');
  const owner=randomUUID();if(!await this.runtime.acquire(slug,'substack',owner,this.context.now()))throw Error('SUBSTACK_SCHEDULE_LOCKED');
  let state:ScheduleRecord|undefined;
  const evidence=async(status:DraftSyncEvidence['status'],code?:string,extra:Partial<DraftSyncEvidence>={})=>{
   if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');
   state=await this.repo.save({...state,draftSync:{...state.draftSync,status,code,checkedAt:this.context.now(),transport:'computer-use',...extra},updatedAt:this.context.now()},state.version);return state;
  };
  const save=async(patch:Partial<ScheduleRecord>)=>{state=await this.repo.save({...state!,...patch,updatedAt:this.context.now()},state!.version);};
  try{
   state=await this.repo.bySlug(slug);
   const source=await this.context.readSource();
   if(source&&(source.slug!==slug||source.article.slug!==slug||source.sourceRevision!==source.article.sourceRevision))throw Error('SUBSTACK_SOURCE_INVALID');
   if(!state){
    if(!source)throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');
    const all=await this.repo.list();
    if(all.some(s=>s.sourcePath===source.sourcePath||s.previousSlugs?.includes(slug)))throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
    // Unknown creates without an ID cannot be disproved by an eventually consistent list.
    if(all.some(s=>s.intent?.action==='create'&&!s.remoteId))throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
    state=await this.repo.save({policyVersion:SCHEDULE_POLICY,scheduleId:'substack:'+slug,slug,sourcePath:source.sourcePath,sourceCommit:source.sourceCommit,sourceRevision:source.sourceRevision,version:0,observedState:'draft_prepared',delivery:'not_armed',updatedAt:this.context.now()},0);
   }
   if(state.slug!==slug)throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
   if(!state.remoteId&&(await this.context.readPolicy())?.allowCreate!==true)return await evidence('foreground-required','SUBSTACK_DRAFT_CREATION_DISABLED',{desiredRevision:source?.sourceRevision});
   if(!source)return await evidence('foreground-required','SUBSTACK_SOURCE_NOT_FINALIZED');
   if(protectedRecord(state)&&source.sourceRevision===state.contentVerifiedRevision&&(!source.media?.length||contentFingerprint(expectedDraftContent(source))===state.contentDigest)&&!state.intent&&!state.pendingAction&&!state.lastErrorCode)return await evidence('excluded',undefined,{desiredRevision:source.sourceRevision,savedRevision:state.contentVerifiedRevision});
   if(protectedRecord(state)||state.lastErrorCode)return await evidence('foreground-required','SUBSTACK_DRAFT_FOREGROUND_REQUIRED',{desiredRevision:source.sourceRevision});
   if(await this.runtime.checkpoint(slug,'substack'))return await evidence('reconciliation-required','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
   if(state.intent){
    if(!state.remoteId||!['create','update-draft'].includes(state.intent.action))return await evidence('reconciliation-required','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
    await this.authority();const observed=validateScheduleObservation(await this.provider.read(state.remoteId),state.remoteId);
    if(!isDraft(observed)||observed.slug!==slug||contentFingerprint(observed.content)!==state.intent.expectedDigest)return await evidence('reconciliation-required','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
    const savedRevision=state.intent.sourceRevision;
    await save({intent:undefined,contentDigest:contentFingerprint(observed.content),contentVerifiedRevision:savedRevision});
    return await evidence(savedRevision===source.sourceRevision?'verified':'pending',undefined,{savedRevision,desiredRevision:source.sourceRevision,baselineDigest:contentFingerprint(observed.content)});
   }
   if(state.pendingAction&&state.pendingAction!=='prepare-draft'&&!(state.pendingAction==='sync-content'&&!state.lastErrorCode))return await evidence('foreground-required','SUBSTACK_DRAFT_FOREGROUND_REQUIRED');
   if(source.media?.length&&(await this.context.readPolicy())?.mediaProfile!==DRAFT_MEDIA_PROFILE)return await evidence('foreground-required','SUBSTACK_DRAFT_MEDIA_UNQUALIFIED');
   await evidence('syncing',undefined,{desiredRevision:source.sourceRevision});
   const expected=contentFingerprint(expectedDraftContent(source));
   let observed:ScheduleObservation;
   if(!state.remoteId){
    await this.authority();const found=await this.provider.find(source);
    if(found.complete!==true||!['draft','scheduled','published'].every(x=>found.scanned.includes(x)))throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
    found.items.forEach(e=>validateScheduleObservation(e));
    if(new Set(found.items.map(e=>e.id)).size!==found.items.length)throw Error('SUBSTACK_DUPLICATE_REMOTE');
    const matches=found.items.filter(e=>e.slug===slug);
    if(matches.length>1)throw Error('SUBSTACK_DUPLICATE_REMOTE');
    if(matches.length){await save({remoteId:matches[0].id});observed=matches[0];}
    else{
     await this.latest(source);await this.authority();
     await save({intent:{id:randomUUID(),policyVersion:SCHEDULE_POLICY,action:'create',sourceRevision:source.sourceRevision,expectedDigest:expected,createdAt:this.context.now()}});
     const id=await this.provider.create(source);if(!/^\d+$/.test(id))throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
     await save({remoteId:id});await this.authority();observed=validateScheduleObservation(await this.provider.read(id),id);
     if(!isDraft(observed)||observed.slug!==slug||contentFingerprint(observed.content)!==expected)throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
    }
   }else {await this.authority();observed=validateScheduleObservation(await this.provider.read(state.remoteId),state.remoteId);}
   if(observed.slug!==slug)return await evidence('foreground-required','SUBSTACK_SLUG_CONFLICT');
   if(!isDraft(observed))return await evidence('foreground-required','SUBSTACK_DRAFT_FOREGROUND_REQUIRED');
   const actual=contentFingerprint(observed.content);
   if(actual!==expected){
    const baseline=state.contentVerifiedRevision&&state.contentVerifiedRevision!==state.draftSync?.savedRevision?state.contentDigest:state.draftSync?.baselineDigest??state.contentDigest;
    if(!baseline||actual!==baseline)return await evidence('conflict','SUBSTACK_REMOTE_EDIT_CONFLICT');
    await this.latest(source);await this.authority();
    // Re-read immediately before edit; the UI executor also checks this exact digest/disposition.
    const fresh=validateScheduleObservation(await this.provider.read(state.remoteId!),state.remoteId);
    if(!isDraft(fresh)||fresh.slug!==slug||contentFingerprint(fresh.content)!==actual)return await evidence('conflict','SUBSTACK_REMOTE_EDIT_CONFLICT');
    await this.latest(source);await this.authority();
    await save({intent:{id:randomUUID(),policyVersion:SCHEDULE_POLICY,action:'update-draft',sourceRevision:source.sourceRevision,expectedDigest:expected,createdAt:this.context.now()}});
    await this.provider.update(state.remoteId!,source,{digest:actual,state:'draft'});
    await this.authority();observed=validateScheduleObservation(await this.provider.read(state.remoteId!),state.remoteId);
    if(!isDraft(observed)||observed.slug!==slug||contentFingerprint(observed.content)!==expected)throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
   }
   await save({intent:undefined,sourcePath:source.sourcePath,sourceCommit:source.sourceCommit,sourceRevision:source.sourceRevision,contentDigest:expected,contentVerifiedRevision:source.sourceRevision,draftSync:{...state.draftSync,status:'pending',transport:'computer-use',checkedAt:this.context.now(),savedRevision:source.sourceRevision,baselineDigest:expected},...(['prepare-draft','sync-content'].includes(state.pendingAction??'')&&!state.lastErrorCode?{pendingAction:undefined}:{})});
   const latest=await this.context.readSource();
   return await evidence(latest?.sourceRevision===source.sourceRevision&&latest?.sourceCommit===source.sourceCommit&&JSON.stringify(latest?.media??[])===JSON.stringify(source.media??[])?'verified':'pending',undefined,{savedRevision:source.sourceRevision,desiredRevision:latest?.sourceRevision,baselineDigest:expected});
  }catch(error){
   if(!state)throw error;
   return await evidence(state.intent?'reconciliation-required':'inconclusive',state.intent?'SUBSTACK_DRAFT_OUTCOME_UNKNOWN':bounded(error));
  }finally{await this.runtime.release(slug,'substack',owner);}
 }
 private async authority(){assertDraftPolicy(await this.context.readPolicy(),this.context.now());}
 private async latest(s:ScheduledSource){const fresh=await this.context.readSource();if(!fresh||fresh.slug!==s.slug||fresh.sourceCommit!==s.sourceCommit||fresh.sourceRevision!==s.sourceRevision||JSON.stringify(fresh.media??[])!==JSON.stringify(s.media??[]))throw Error('SUBSTACK_SOURCE_CHANGED');}
}
