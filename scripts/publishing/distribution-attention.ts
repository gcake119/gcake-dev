import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import type {ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
export const HERMES_ATTENTION_FILE='/Users/Shared/gcake-substack-hermes/input/status.json';
export interface AttentionRound {status:string;results:{slug:string;target:string;operation:string;status:string;code?:string}[]}
const reasons=new Set(['DISTRIBUTION_MANUAL_REQUIRED','SUBSTACK_BACKGROUND_ATTENDED_REQUIRED','SUBSTACK_DRAFT_PREPARATION_REQUIRED','SUBSTACK_CONTENT_SYNC_REQUIRED','SUBSTACK_SCHEDULE_CANCEL_REQUIRED','SUBSTACK_SCHEDULE_POSTPONE_REQUIRED','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED']);
export function scheduleAttentionCode(state:Pick<ScheduleRecord,'intent'|'pendingAction'|'lastErrorCode'|'draftSync'>):string{
 if(state.intent||state.pendingAction==='reconcile-schedule'||state.draftSync?.status==='reconciliation-required')return 'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED';
 if(state.lastErrorCode&&!['SUBSTACK_CONTENT_EVIDENCE_MISMATCH','SUBSTACK_REMOTE_CONTENT_CHANGED','SUBSTACK_PUBLIC_EVIDENCE_MISMATCH'].includes(state.lastErrorCode))return 'DISTRIBUTION_MANUAL_REQUIRED';
 return ({'prepare-draft':'SUBSTACK_DRAFT_PREPARATION_REQUIRED','sync-content':'SUBSTACK_CONTENT_SYNC_REQUIRED','cancel-schedule':'SUBSTACK_SCHEDULE_CANCEL_REQUIRED','postpone-schedule':'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED'} as Record<string,string>)[state.pendingAction??'']??'DISTRIBUTION_MANUAL_REQUIRED';
}
const issueCode=(r:AttentionRound['results'][number])=>reasons.has(r.code??'')?r.code:r.status==='manual_required'?'DISTRIBUTION_MANUAL_REQUIRED':undefined;
const priority=(code:string)=>code==='SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'?2:['DISTRIBUTION_MANUAL_REQUIRED','SUBSTACK_BACKGROUND_ATTENDED_REQUIRED'].includes(code)?0:1;
export async function publishAttentionSnapshot(file:string,round:AttentionRound,durableHolds?:{slug:string;code?:string}[]){
 // Incomplete source/round evidence cannot resolve a previously recorded hold.
 if(round.results.some(r=>!issueCode(r)&&!['verified','observed'].includes(r.status))||round.status!=='completed'&&!round.results.length)return {status:'retained'};
 // Initial owner seeding can announce observed issues, but never replace an existing
 // snapshot or clear anything without a complete durable-hold read.
 if(durableHolds===undefined){try{await fs.access(file);return {status:'retained'};}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(!round.results.some(r=>r.target==='substack'&&!!issueCode(r)))return {status:'retained'};}
 const candidates=[...(durableHolds??[]).map(r=>({slug:r.slug,code:r.code??'DISTRIBUTION_MANUAL_REQUIRED'})),...round.results.filter(r=>r.target==='substack'&&!!issueCode(r)).map(r=>({slug:r.slug,code:issueCode(r)!}))];
 const bySlug=new Map<string,{slug:string;code:string}>();
 for(const r of candidates){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.slug.length>180||!reasons.has(r.code))throw Error('HERMES_ATTENTION_INPUT_INVALID');
  const prior=bySlug.get(r.slug);if(!prior||priority(r.code)>=priority(prior.code))bySlug.set(r.slug,r);
 }
 const issues=[...bySlug.values()].sort((a,b)=>a.slug.localeCompare(b.slug));
 if(issues.length>100)throw Error('HERMES_ATTENTION_INPUT_INVALID');
 const temporary=path.join(path.dirname(file),'.status-'+randomUUID());
 try{await fs.writeFile(temporary,JSON.stringify({schema:1,generatedAt:new Date().toISOString(),issues})+'\n',{flag:'wx',mode:0o600});await fs.rename(temporary,file);}
 finally{await fs.unlink(temporary).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});}
 return {status:'queued'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,...extra]=process.argv.slice(2);
 if(mode!=='--seed'||!file||extra.length)throw Error('HERMES_ATTENTION_USAGE');
 publishAttentionSnapshot(HERMES_ATTENTION_FILE,JSON.parse(await fs.readFile(file,'utf8'))).then(result=>{console.log(JSON.stringify(result));if(result.status!=='queued')process.exitCode=1;});
}
