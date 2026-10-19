import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import {listLocalPostFiles} from '../../src/lib/content/local-posts';
import {ScheduleCoordinator,type ScheduleProvider,type ScheduleObservation} from './substack-schedule';
import {buildScheduledSource,observeScheduledOriginal,type ScheduledSource} from './scheduled-source';
import {scheduledRuntime} from './scheduled-runtime';
import {scheduleAttentionCode} from './distribution-attention';
import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
import type {SubstackUiContract} from './substack-browser';
const forbidden=async():Promise<never>=>{throw Error('SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');};
// This port cannot open a browser, inspect a logged-in list or dispatch any provider mutation.
const noProvider:ScheduleProvider={find:forbidden,read:forbidden,create:forbidden,update:forbidden,arm:forbidden,remove:forbidden};
export async function observeSubstackSchedules(root:string,db:D1DatabaseLike,ui:SubstackUiContract,now=new Date().toISOString(),readPublic?: (id:string,url:string)=>Promise<ScheduleObservation>){
 const ports=scheduledRuntime(db,ui),results:{slug:string;sourceRevision?:string;target:string;operation:string;status:string;code?:string;observedTime?:string;stillArmedUntilConfirmed?:boolean}[]=[];
 const records=await ports.repo.list();
 for(const tracked of records){
  try{
   let source:ScheduledSource|undefined;try{source=await buildScheduledSource(root,tracked.slug);}catch(error){if(!(error instanceof Error)||!['SUBSTACK_SOURCE_NOT_FINALIZED','SUBSTACK_SOURCE_SERIES_INCOMPLETE'].includes(error.message))throw error;}
   const slot=await ports.readSlot(tracked.slug,source?.seriesSlug);
   const coordinator=new ScheduleCoordinator(ports.repo,ports.runtime,noProvider,{readSource:async()=>source,readSlot:async()=>slot,readPublic:readPublic??ports.readPublic,readOriginalSite:s=>observeScheduledOriginal(root,s),now:()=>now});
   const state=await coordinator.observe(tracked.scheduleId,source,slot,now);
   const incomplete=state.verification?.status==='inconclusive'&&!state.intent&&(!state.pendingAction||state.pendingAction==='sync-content'&&state.lastErrorCode==='SUBSTACK_PUBLIC_EVIDENCE_MISMATCH')&&(!state.lastErrorCode||state.lastErrorCode==='SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');
   results.push({observedTime:state.observedTime,stillArmedUntilConfirmed:state.observedState==='scheduled'||!!state.intent&&['arm','remove'].includes(state.intent.action),slug:state.slug,sourceRevision:source?.sourceRevision,target:'substack',operation:state.pendingAction??'observe-schedule',status:incomplete?'blocked':state.pendingAction||state.intent||state.lastErrorCode?'manual_required':'observed',code:incomplete?'SUBSTACK_PUBLIC_VERIFICATION_INCONCLUSIVE':state.pendingAction||state.intent||state.lastErrorCode?scheduleAttentionCode(state):undefined});
  }catch{results.push({slug:tracked.slug,target:'substack',operation:'observe-schedule',status:'blocked',code:'SUBSTACK_SCHEDULE_OBSERVATION_FAILED'});}
 }
 const known=new Set(records.flatMap(r=>[r.slug,...(r.previousSlugs??[])]));
 for(const file of await listLocalPostFiles(path.join(root,'src/content/posts'))){if(known.has(file.slug))continue;const status=matter(await fs.readFile(file.path,'utf8')).data.status;if(!['ready','published'].includes(status))continue;
  try{const source=await buildScheduledSource(root,file.slug);results.push({slug:file.slug,sourceRevision:source.sourceRevision,target:'substack',operation:'prepare-draft',status:'manual_required',code:'SUBSTACK_DRAFT_PREPARATION_REQUIRED'});}
  catch{results.push({slug:file.slug,target:'substack',operation:'prepare-draft',status:'blocked',code:'SUBSTACK_SOURCE_OBSERVATION_FAILED'});}
 }
 return results;
}
