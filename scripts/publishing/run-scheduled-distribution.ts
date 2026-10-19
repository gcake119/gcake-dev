import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildScheduledSource,observeScheduledOriginal,type ScheduledSource} from './scheduled-source';
import {SCHEDULE_POLICY,ScheduleCoordinator,makeScheduleApproval,type ScheduleRequest} from './substack-schedule';
import {FileAttendedExchange,assertOutsideAnyGit} from './substack-attended';
import {AttendedScheduleProvider,type ScheduleExchangeRequest} from './substack-schedule-attended';
import {CloudflareD1Database} from './d1-api';
import {scheduledRuntime} from './scheduled-runtime';
import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
export const SCHEDULED_POLICY=SCHEDULE_POLICY;
export const SCHEDULED_OPERATIONS=['prepare-draft','arm-schedule','revise-schedule','postpone-schedule','cancel-schedule','reconcile-schedule','sync-content'] as const;
export interface ScheduledRunDependencies {readSource?:(root:string,slug:string)=>Promise<ScheduledSource>;assertMain?:(root:string,commit:string)=>Promise<void>;exchange?:(r:ScheduleExchangeRequest)=>Promise<unknown>}
export async function runScheduledDistribution(args:string[],defaultRoot:string,database?:D1DatabaseLike,deps:ScheduledRunDependencies={}){
 const [operation,slug,target,...flags]=args;const values=new Map<string,string>();let execute=false,background=false;
 for(let i=0;i<flags.length;i++){const k=flags[i];if(k==='--execute'){if(execute)throw Error('DISTRIBUTION_ARGUMENT_INVALID');execute=true;continue;}if(k==='--background'){if(background)throw Error('DISTRIBUTION_ARGUMENT_INVALID');background=true;continue;}if(!['--config','--source-root','--out','--receipt','--approval','--schedule-id','--remote-id','--previous-slug'].includes(k)||values.has(k)||!flags[i+1]||flags[i+1].startsWith('--'))throw Error('DISTRIBUTION_ARGUMENT_INVALID');values.set(k,flags[++i]);}
 if(target!=='substack'||!SCHEDULED_OPERATIONS.includes(operation as never)||!values.has('--config'))throw Error('DISTRIBUTION_ARGUMENT_INVALID');
 if(background)throw Error('SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
 const config=JSON.parse(await fs.readFile(values.get('--config')!,'utf8'));
 if(config.scheduled?.policyVersion!==SCHEDULED_POLICY||config.substack?.ui?.origin!=='https://gcakedev.substack.com')throw Error('SUBSTACK_SCHEDULE_POLICY_REQUIRED');
 if(execute&&(config.scheduled.writeEnabled!==true||config.scheduled.transport!=='attended'))throw Error('SUBSTACK_SCHEDULE_WRITE_DISABLED');
 const root=path.resolve(values.get('--source-root')??defaultRoot);
 const readSource=async():Promise<ScheduledSource|undefined>=>{if(operation==='cancel-schedule')return;try{const s=await (deps.readSource??buildScheduledSource)(root,slug);if(execute&&deps.assertMain)await deps.assertMain(root,s.sourceCommit);else if(execute){const remote=execFileSync('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8',timeout:30000}).trim().split(/\s+/)[0];if(remote!==s.sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');}return s;}catch(e){if(['cancel-schedule','reconcile-schedule'].includes(operation)&&e instanceof Error&&['SUBSTACK_SOURCE_NOT_FINALIZED','SUBSTACK_SOURCE_SERIES_INCOMPLETE','SUBSTACK_SOURCE_MEDIA_UNAVAILABLE','SUBSTACK_UNSUPPORTED_CONTENT'].includes(e.message))return;throw e;}};
 const source=await readSource();
 // Preparation review needs no operational credentials. Time-bearing reviews must read the actual confirmed queue.
 const needsRuntime=!!database||!!process.env.DISTRIBUTION_D1_DATABASE_ID||execute||operation!=='prepare-draft'||values.has('--remote-id');
 const ports=needsRuntime?scheduledRuntime(database??new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??''),config.substack.ui):undefined;
 const legacy=ports?await ports.legacyIdentity(slug):undefined;
 const existing=ports?await ports.repo.get(values.get('--schedule-id')??`substack:${slug}`)??await ports.repo.bySlug(slug):undefined;
 const request:ScheduleRequest={policyVersion:SCHEDULE_POLICY,operation:operation as ScheduleRequest['operation'],slug,source,scheduleId:values.get('--schedule-id')??existing?.scheduleId??`substack:${slug}`,remoteId:values.get('--remote-id')??existing?.remoteId??legacy?.remoteId,previousSlug:values.get('--previous-slug'),timeZone:'Asia/Taipei',slot:ports?await ports.readSlot(slug,source?.seriesSlug):undefined};
 // An irrelevant slot never changes the review for draft preparation/cancellation/public correction.
 if(!['arm-schedule','revise-schedule','postpone-schedule','sync-content','reconcile-schedule'].includes(operation))delete request.slot;
 const approval=makeScheduleApproval(request);
 if(!execute){
  if(!values.has('--out'))throw Error('SUBSTACK_SCHEDULE_REVIEW_REQUIRED');
  const out=path.resolve(values.get('--out')!);await fs.mkdir(path.dirname(out),{recursive:true,mode:0o700});const parent=await fs.realpath(path.dirname(out));assertOutsideAnyGit(parent);const rel=path.relative(await fs.realpath(root),parent);if(!rel||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw Error('SUBSTACK_SESSION_OUTSIDE_GIT');
  await fs.writeFile(out,JSON.stringify({version:1,policyVersion:SCHEDULE_POLICY,operation,source,request,approvalTemplate:{...approval,approved:false},externalWriteEnabled:false},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({operation,reviewFile:out,sourceRevision:source?.sourceRevision,externalWriteEnabled:false}));return;
 }
 if(!values.has('--receipt')||!values.has('--approval'))throw Error('SUBSTACK_SCHEDULE_REVIEW_REQUIRED');
 const review=JSON.parse(await fs.readFile(values.get('--receipt')!,'utf8')),authorized=JSON.parse(await fs.readFile(values.get('--approval')!,'utf8'));
 if(review.version!==1||makeScheduleApproval(review.request).digest!==approval.digest||authorized.approved!==true||authorized.version!==1||authorized.digest!==approval.digest)throw Error('SUBSTACK_SCHEDULE_APPROVAL_REQUIRED');
 const exchange=deps.exchange??(await FileAttendedExchange.create<ScheduleExchangeRequest>(config.scheduled.sessionDirectory,root)).exchange;
 request.approval=authorized;
 const coordinator=new ScheduleCoordinator(ports!.repo,ports!.runtime,new AttendedScheduleProvider(request,ports!.repo,exchange,async()=>{const current=JSON.parse(await fs.readFile(values.get('--config')!,'utf8'));if(current.scheduled?.writeEnabled!==true||current.scheduled.policyVersion!==SCHEDULED_POLICY||current.scheduled.transport!=='attended')throw Error('SUBSTACK_SCHEDULE_WRITE_DISABLED');if(!['cancel-schedule','reconcile-schedule'].includes(operation)){const fresh=await readSource();if(!fresh||fresh.sourceCommit!==source?.sourceCommit||fresh.sourceRevision!==source?.sourceRevision)throw Error('SUBSTACK_SOURCE_CHANGED');}}),{readSource,readSlot:()=>ports!.readSlot(slug,source?.seriesSlug),readPublic:ports!.readPublic,readOriginalSite:s=>observeScheduledOriginal(root,s),legacyIdentity:()=>ports!.legacyIdentity(slug),now:()=>new Date().toISOString()});
 const state=await coordinator.run(request);console.log(JSON.stringify({operation,policyVersion:SCHEDULE_POLICY,state,stillArmedUntilConfirmed:state.observedState==='scheduled'||!!state.intent&&['arm','remove'].includes(state.intent.action),originalSite:state.originalSite??{status:'not_checked'},subscriberReceipt:'unknown'}));return state;
}
