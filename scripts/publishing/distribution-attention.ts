import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type {ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
export const HERMES_ATTENTION_FILE='/Users/Shared/gcake-substack-hermes/input/status.json';
export interface AttentionRound {status:string;results:{slug:string;target:string;operation:string;status:string;code?:string}[]}
export interface PublicationNotice {slug:string;id:string;revision:string;title:string;actualAt:string;confirmedAt:string;differenceSeconds:number}
export function publicationNotice(state:ScheduleRecord):PublicationNotice|undefined{
 const e=state.publicationEvidence;
 if(state.observedState!=='verified'||state.verification?.status!=='verified'||state.verification.checkedAt!==state.updatedAt||state.intent||state.pendingAction||state.lastErrorCode||!state.armedRevision||!state.remoteId||!e?.confirmedAt||!e.actualAt||!Number.isFinite(e.differenceSeconds))return;
 return {slug:state.slug,id:state.remoteId,revision:state.armedRevision,title:e.title,actualAt:e.actualAt,confirmedAt:e.confirmedAt,differenceSeconds:e.differenceSeconds!};
}
function validPublication(p:PublicationNotice){return p&&Object.keys(p).sort().join(',')==='actualAt,confirmedAt,differenceSeconds,id,revision,slug,title'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)&&p.slug.length<=180&&/^[0-9]+$/.test(p.id)&&p.id.length<=30&&/^sha256:[a-f0-9]{64}$/.test(p.revision)&&typeof p.title==='string'&&p.title.length>0&&p.title.length<=300&&!/[\x00-\x1f\x7f]/.test(p.title)&&Number.isFinite(Date.parse(p.actualAt))&&Number.isFinite(Date.parse(p.confirmedAt))&&Number.isFinite(p.differenceSeconds)&&Math.abs((Date.parse(p.actualAt)-Date.parse(p.confirmedAt))/1000-p.differenceSeconds)<0.000001;}
const reasons=new Set(['DISTRIBUTION_MANUAL_REQUIRED','SUBSTACK_BACKGROUND_ATTENDED_REQUIRED','SUBSTACK_DRAFT_PREPARATION_REQUIRED','SUBSTACK_CONTENT_SYNC_REQUIRED','SUBSTACK_SCHEDULE_CANCEL_REQUIRED','SUBSTACK_SCHEDULE_POSTPONE_REQUIRED','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED']);
export function scheduleAttentionCode(state:Pick<ScheduleRecord,'intent'|'pendingAction'|'lastErrorCode'|'draftSync'>):string{
 if(state.intent||state.pendingAction==='reconcile-schedule'||state.draftSync?.status==='reconciliation-required')return 'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED';
 if(state.lastErrorCode&&!['SUBSTACK_CONTENT_EVIDENCE_MISMATCH','SUBSTACK_REMOTE_CONTENT_CHANGED','SUBSTACK_PUBLIC_EVIDENCE_MISMATCH'].includes(state.lastErrorCode))return 'DISTRIBUTION_MANUAL_REQUIRED';
 return ({'prepare-draft':'SUBSTACK_DRAFT_PREPARATION_REQUIRED','sync-content':'SUBSTACK_CONTENT_SYNC_REQUIRED','cancel-schedule':'SUBSTACK_SCHEDULE_CANCEL_REQUIRED','postpone-schedule':'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED'} as Record<string,string>)[state.pendingAction??'']??'DISTRIBUTION_MANUAL_REQUIRED';
}
const issueCode=(r:AttentionRound['results'][number])=>reasons.has(r.code??'')?r.code:r.status==='manual_required'?'DISTRIBUTION_MANUAL_REQUIRED':undefined;
const priority=(code:string)=>code==='SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'?2:['DISTRIBUTION_MANUAL_REQUIRED','SUBSTACK_BACKGROUND_ATTENDED_REQUIRED'].includes(code)?0:1;
async function authorizeHermesReader(temporary:string){
 if(process.platform!=='darwin')throw Error('HERMES_ATTENTION_PLATFORM_UNSUPPORTED');
 // Atomic replacement creates a new inode: inherited ACL alone failed in the real daemon.
 await promisify(execFile)('/bin/chmod',['+a','user:hermes allow read,readattr,readextattr,readsecurity',temporary],{timeout:10_000,env:{PATH:'/usr/bin:/bin'}});
}
export async function publishAttentionSnapshot(file:string,round:AttentionRound,durableHolds?:{slug:string;code?:string}[],publications?:PublicationNotice[],permissions?:{authorizeReader:(temporary:string)=>Promise<void>}){
 const incomplete=round.results.filter(r=>!issueCode(r)&&!['verified','observed'].includes(r.status));
 const globalIncomplete=incomplete.some(r=>!r.slug)||round.status!=='completed'&&!round.results.length;
 const incompleteSlugs=new Set(incomplete.map(r=>r.slug));
 // Partial evidence retains only affected prior issues, while independent durable results advance.
 let previous:{issues:{slug:string;code:string}[];publications?:PublicationNotice[]}|undefined;
 try{previous=JSON.parse(await fs.readFile(file,'utf8'));if(!previous||!Array.isArray(previous.issues))throw Error('HERMES_ATTENTION_INPUT_INVALID');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 if(durableHolds===undefined&&(incomplete.length||globalIncomplete))return {status:'retained'};
 if(incomplete.length&&!round.results.some(r=>r.target==='substack'&&(!!issueCode(r)||['verified','observed'].includes(r.status)))&&!durableHolds?.length&&!publications?.length)return {status:'retained'};
 if(publications?.some(p=>!validPublication(p))||publications&&publications.length>100||new Set(publications?.map(p=>p.slug)).size!==(publications?.length??0))throw Error('HERMES_ATTENTION_INPUT_INVALID');
 const successes=publications?.filter(p=>!incompleteSlugs.has(p.slug))??[];
 const successSlugs=new Set(successes.map(p=>p.slug));
 // Initial owner seeding can announce observed issues, but never replace an existing
 // snapshot or clear anything without a complete durable-hold read.
 if(durableHolds===undefined){try{await fs.access(file);return {status:'retained'};}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(!round.results.some(r=>r.target==='substack'&&!!issueCode(r)))return {status:'retained'};}
 const candidates=[...(previous?.issues.filter(r=>!successSlugs.has(r.slug)&&(globalIncomplete||incompleteSlugs.has(r.slug)||incomplete.length>0&&!round.results.some(current=>current.slug===r.slug&&current.target==='substack'&&['verified','observed'].includes(current.status))))??[]),...(durableHolds??[]).map(r=>({slug:r.slug,code:r.code??'DISTRIBUTION_MANUAL_REQUIRED'})),...round.results.filter(r=>r.target==='substack'&&!!issueCode(r)&&!successSlugs.has(r.slug)).map(r=>({slug:r.slug,code:issueCode(r)!}))];
 const bySlug=new Map<string,{slug:string;code:string}>();
 for(const r of candidates){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.slug.length>180||!reasons.has(r.code))throw Error('HERMES_ATTENTION_INPUT_INVALID');
  const prior=bySlug.get(r.slug);if(!prior||priority(r.code)>=priority(prior.code))bySlug.set(r.slug,r);
 }
 const issues=[...bySlug.values()].sort((a,b)=>a.slug.localeCompare(b.slug));
 if(issues.length>100)throw Error('HERMES_ATTENTION_INPUT_INVALID');
 const temporary=path.join(path.dirname(file),'.status-'+randomUUID());
 const snapshot=JSON.stringify({schema:publications===undefined?1:2,generatedAt:new Date().toISOString(),issues,...(publications===undefined?{}:{publications:successes})})+'\n';
 if(Buffer.byteLength(snapshot)>65536)throw Error('HERMES_ATTENTION_INPUT_INVALID');
 try{await fs.writeFile(temporary,snapshot,{flag:'wx',mode:0o600});const authorize=permissions?.authorizeReader??(file===HERMES_ATTENTION_FILE?authorizeHermesReader:undefined);await authorize?.(temporary);await fs.rename(temporary,file);}
 finally{await fs.unlink(temporary).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});}
 return {status:'queued'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,...extra]=process.argv.slice(2);
 if(mode!=='--seed'||!file||extra.length)throw Error('HERMES_ATTENTION_USAGE');
 publishAttentionSnapshot(HERMES_ATTENTION_FILE,JSON.parse(await fs.readFile(file,'utf8'))).then(result=>{console.log(JSON.stringify(result));if(result.status!=='queued')process.exitCode=1;});
}
