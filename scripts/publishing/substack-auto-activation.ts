import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const AUTO_SCHEDULE_POLICY='automatic-substack-first-schedules-v1' as const;
export interface AutoSchedulePolicy {
 policyVersion:typeof AUTO_SCHEDULE_POLICY;enabled:boolean;writeEnabled:boolean;
 origin:string;repository:string;branch:string;timeZone:string;audience:string;email:boolean;appInbox:boolean;
 expiresAt:string;executor:string;browserName:string;evidenceDirectory:string;qualificationRef:string;authorizationRef:string;
 maxArticles:number;timeoutMs:number;maxRoundMs:number;
}
export function assertAutoSchedulePolicy(p:AutoSchedulePolicy,now:string){
 if(!p||p.enabled!==true||p.writeEnabled!==true||p.policyVersion!==AUTO_SCHEDULE_POLICY||p.origin!=='https://gcakedev.substack.com'||p.repository!=='gcake119/gcake-dev'||p.branch!=='main'||p.timeZone!=='Asia/Taipei'||p.audience!=='everyone'||p.email!==true||p.appInbox!==true||p.browserName!=='chrome'||![p.executor,p.evidenceDirectory,p.qualificationRef,p.authorizationRef].every(v=>typeof v==='string'&&path.isAbsolute(v))||!Number.isFinite(Date.parse(now))||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.parse(now)||!Number.isSafeInteger(p.maxArticles)||p.maxArticles<1||p.maxArticles>20||!Number.isSafeInteger(p.timeoutMs)||p.timeoutMs<100||p.timeoutMs>600000||!Number.isSafeInteger(p.maxRoundMs)||p.maxRoundMs<p.timeoutMs||p.maxRoundMs>840000)throw Error('SUBSTACK_AUTO_POLICY_INVALID');
}
export function autoScheduleScopeDigest(p:AutoSchedulePolicy){return createHash('sha256').update(JSON.stringify({policyVersion:p.policyVersion,origin:p.origin,repository:p.repository,branch:p.branch,timeZone:p.timeZone,audience:p.audience,email:p.email,appInbox:p.appInbox,expiresAt:p.expiresAt,executor:p.executor,browserName:p.browserName,evidenceDirectory:p.evidenceDirectory,maxArticles:p.maxArticles,timeoutMs:p.timeoutMs,maxRoundMs:p.maxRoundMs})).digest('hex');}
export async function validateAutoScheduleActivation(p:AutoSchedulePolicy,pin:string|undefined,now:string,deps:{read?:(file:string)=>Promise<string>;verifyPin?:(root:string,pin:string)=>Promise<void>}={}){
 assertAutoSchedulePolicy(p,now);if(!pin||!path.isAbsolute(pin))throw Error('SUBSTACK_AUTO_ACTIVATION_REQUIRED');
 const read=deps.read??(file=>fs.readFile(file,'utf8'));
 const verify=deps.verifyPin??(async(root,file)=>{const {verifyRuntimePin}=await import('./sync-distribution');await verifyRuntimePin(root,file,['scripts/publishing/substack-auto-activation.ts','scripts/publishing/substack-auto-schedule.ts','scripts/publishing/substack-auto-executor.ts','scripts/publishing/substack-native-presentation.ts','scripts/publishing/substack-schedule.ts','scripts/publishing/substack-schedule-handoff.ts','scripts/publishing/substack-schedule-attended.ts','scripts/publishing/scheduled-runtime.ts','scripts/publishing/scheduled-source.ts','scripts/publishing/sync-distribution.ts']);});
 await verify(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),pin);
 const pinDigest=createHash('sha256').update(await read(pin)).digest('hex'),scopeDigest=autoScheduleScopeDigest(p);
 const [q,a]=await Promise.all([read(p.qualificationRef),read(p.authorizationRef)]).then(v=>v.map(s=>JSON.parse(s)));
 const scoped=(v:Record<string,unknown>)=>v?.schema===1&&v.policyVersion===AUTO_SCHEDULE_POLICY&&v.scopeDigest===scopeDigest&&v.pinDigest===pinDigest&&v.firstScheduleOnly===true&&v.expiresAt===p.expiresAt&&Date.parse(String(v.expiresAt))>Date.parse(now);
 if(!scoped(q)||!scoped(a)||a.approved!==true||q.passed!==true||q.realProvider!==true||q.sameId!==true||q.exactSlug!==true||q.fullReadback!==true||q.emailAppConfirmed!==true||q.armRemoveRearmConfirmed!==true||q.unattendedExecutor!==true||!/^\d+$/.test(q.remoteId)||typeof q.sourceRevision!=='string'||!q.sourceRevision||!Number.isFinite(Date.parse(q.scheduledAt))||!Number.isFinite(Date.parse(q.checkedAt))||Date.parse(q.checkedAt)>Date.parse(now))throw Error('SUBSTACK_AUTO_ACTIVATION_REQUIRED');
}
