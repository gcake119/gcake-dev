import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify,isDeepStrictEqual} from 'node:util';
import {execFile} from 'node:child_process';
import {listLocalPostFiles} from '../../src/lib/content/local-posts';
import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
import {type ScheduleRecord,SCHEDULE_POLICY} from '../../apps/admin-worker/src/substack-schedules';
import {scheduledRuntime} from './scheduled-runtime';
import {buildDraftSource,expectedDraftContent} from './substack-draft-media';
import type {ScheduledSource} from './scheduled-source';
import {ScheduleCoordinator,makeScheduleApproval,validateScheduleTime,validateScheduleCommitment,type ScheduleProvider,type ScheduleRequest} from './substack-schedule';
import {AttendedScheduleProvider} from './substack-schedule-attended';
import {assertAutoSchedulePolicy,validateAutoScheduleActivation,type AutoSchedulePolicy} from './substack-auto-activation';
export interface AutoScheduleDependencies {
 now?:()=>string;runtimePinFile?:string;readSource?:(root:string,slug:string)=>Promise<ScheduledSource>;
 assertMain?:(root:string,commit:string)=>Promise<void>;provider?:(source:ScheduledSource,request:ScheduleRequest)=>ScheduleProvider;
 verifyActivation?:(policy:AutoSchedulePolicy)=>Promise<void>;
 execute?:import('./substack-auto-executor').AutomaticExecutorOptions['execute'];
}
export interface AutoScheduleResult {slug:string;target:'substack';operation:'first-schedule';status:'observed'|'blocked'|'manual_required';code?:string}
const protectedRecord=(r:ScheduleRecord)=>r.everPublished||r.legacyPublished||!!r.intent||r.observedState!=='draft_prepared'||['armed','unknown','provider_reported'].includes(r.delivery)||r.desiredState==='cancelled'||r.desiredState==='scheduled'||!!r.pendingAction||!!r.lastErrorCode||!!r.draftSync&&['conflict','reconciliation-required'].includes(r.draftSync.status)||r.draftSync?.status==='foreground-required'&&r.draftSync.code!=='SUBSTACK_DRAFT_CREATION_DISABLED';
/** Only first preparation/arming: never edits public originals or revises existing commitments. */
export async function runAutoScheduleRound(root:string,db:D1DatabaseLike,configFile:string,deps:AutoScheduleDependencies={}):Promise<AutoScheduleResult[]>{
 const readPolicy=async()=>(JSON.parse(await fs.readFile(configFile,'utf8')) as {autoSchedule?:AutoSchedulePolicy}).autoSchedule;
 const initial=await readPolicy();if(initial?.enabled!==true)return [];
 const now=deps.now??(()=>new Date().toISOString());assertAutoSchedulePolicy(initial,now());
 const verify=deps.verifyActivation??(p=>validateAutoScheduleActivation(p,deps.runtimePinFile,now()));
 await verify(initial);
 const deadline=Date.now()+initial.maxRoundMs,remaining=()=>{const t=deadline-Date.now();if(t<=0)throw Error('SUBSTACK_AUTO_BUDGET_EXHAUSTED');return t;};
 const authority=async()=>{remaining();const p=await readPolicy();if(!p||!isDeepStrictEqual(p,initial))throw Error('SUBSTACK_AUTO_AUTHORITY_CHANGED');assertAutoSchedulePolicy(p,now());await verify(p);remaining();};
 const ports=scheduledRuntime(db,{origin:initial.origin} as never),repo=ports.repo;
 const queue=await db.prepare('SELECT version,document FROM release_queue_runtime WHERE id = 1').first<{version:number;document:string}>();
 if(!queue)return [];
 const document=JSON.parse(queue.document) as {overrides?:Record<string,string>};
 const results:AutoScheduleResult[]=[];let attempted=0;
 const records=await repo.list();
 const availableSlugs=new Set((await listLocalPostFiles(path.join(root,'src/content/posts'))).map(f=>f.slug));
 const missingTracked=records.some(r=>!availableSlugs.has(r.slug));
 for(const slug of Object.keys(document.overrides??{}).sort()){
  let exchange:import('./substack-attended').FileAttendedExchange<import('./substack-schedule-attended').ScheduleExchangeRequest>|undefined;
  try{
   await authority();
   const state=await repo.bySlug(slug);
   if(state&&protectedRecord(state)){results.push({slug,target:'substack',operation:'first-schedule',status:state.intent?'manual_required':'observed',...(state.intent?{code:'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'}:{})});continue;}
   if(!state?.remoteId&&missingTracked)throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
   const slot=await ports.readSlot(slug);if(!slot)continue;validateScheduleTime(slot,slug,now());
   const readSource=async()=>{await authority();const source=await (deps.readSource?deps.readSource(root,slug):buildDraftSource(root,slug,(async(input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(remaining()),...(init?.signal?[init.signal]:[])])})) as typeof fetch));remaining();if(deps.assertMain)await deps.assertMain(root,source.sourceCommit);else if((await promisify(execFile)('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8',timeout:Math.min(30000,remaining()),killSignal:'SIGKILL'})).stdout.trim().split(/\s+/)[0]!==source.sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');remaining();return source;};
   if(attempted>=initial.maxArticles)break;attempted++;
   const source=await readSource();
   if(records.some(r=>r.slug!==slug&&(r.sourcePath===source.sourcePath||r.previousSlugs?.includes(slug))))throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
   if(records.some(r=>r.slug!==slug&&r.intent?.action==='create'&&!r.remoteId))throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
   const validate=async()=>{await authority();const fresh=await readSource();if(!isDeepStrictEqual(fresh,source))throw Error('SUBSTACK_SOURCE_CHANGED');validateScheduleCommitment(slot,await ports.readSlot(slug,source.seriesSlug),slug,now());};
   await validate();
   let createdHere=false;
   const perform=async(operation:'prepare-draft'|'arm-schedule')=>{
    await validate();const current=await repo.bySlug(slug);
    if(current&&protectedRecord(current))throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');
    const request:ScheduleRequest={policyVersion:SCHEDULE_POLICY,scheduleId:current?.scheduleId??'substack:'+slug,slug,operation,source,remoteId:current?.remoteId,timeZone:'Asia/Taipei',...(operation==='arm-schedule'?{slot}:{})};request.approval=makeScheduleApproval(request);
    const provider=deps.provider?.(source,request)??new AttendedScheduleProvider(request,repo,async r=>{
     const {FileAttendedExchange}=await import('./substack-attended');const {replyWithAutomaticExecutor}=await import('./substack-auto-executor');
     exchange??=await FileAttendedExchange.create(path.join(path.dirname(root),'auto-schedule-sessions'),root,Math.min(initial.timeoutMs,remaining()),100,async file=>{
      await replyWithAutomaticExecutor(file,{policy:initial,source,timeoutMs:Math.min(initial.timeoutMs,remaining()),check:async()=>{await validate();const record=await repo.get(request.scheduleId);if(!record)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');return {record,slot:await ports.readSlot(slug,source.seriesSlug)};},execute:deps.execute});
     });return exchange.exchange(r);
    },validate,expectedDraftContent(source));
    const guarded:ScheduleProvider={
     find:async s=>{await validate();const r=await provider.find(s);if(r.items.some(p=>p.state!=='draft'))throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');return r;},
     read:async id=>{await authority();const p=await provider.read(id);const r=await repo.get(request.scheduleId);if(p.state!=='draft'&&!(p.state==='scheduled'&&r?.intent?.action==='arm'))throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');return p;},
     create:async s=>{await validate();const id=await provider.create(s);createdHere=true;return id;},
     update:async(id,s,published)=>{if(published)throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');await validate();const r=await repo.get(request.scheduleId);const baseline=r?.draftSync?.baselineDigest??r?.contentDigest;if(!createdHere&&(!baseline||r?.lastComparison?.observedDigest!==baseline))throw Error('SUBSTACK_REMOTE_EDIT_CONFLICT');return provider.update(id,s,false);},
     arm:async(id,time)=>{await validate();return provider.arm(id,time);},
     remove:async()=>{throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');}
    };
    return new ScheduleCoordinator(repo,ports.runtime,guarded,{expectedContent:expectedDraftContent,readSource,readSlot:()=>ports.readSlot(slug,source.seriesSlug),readPublic:ports.readPublic,legacyIdentity:()=>ports.legacyIdentity(slug),now}).run(request);
   };
   await perform('prepare-draft');
   const prepared=await repo.bySlug(slug);if(!prepared?.remoteId||prepared.observedState!=='draft_prepared')throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');
   await perform('arm-schedule');
   if(exchange)await fs.rm(exchange.directory,{recursive:true});
   results.push({slug,target:'substack',operation:'first-schedule',status:'observed'});
  }catch(error){const code=error instanceof Error&&/^SUBSTACK_[A-Z_]+$/.test(error.message)?error.message:'SUBSTACK_AUTO_INCONCLUSIVE';results.push({slug,target:'substack',operation:'first-schedule',status:'blocked',code});const current=await repo.bySlug(slug);if(exchange&&!current?.intent)await fs.rm(exchange.directory,{recursive:true});if(code==='SUBSTACK_AUTO_BUDGET_EXHAUSTED')break;}
 }
 return results;
}
