import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {assertDraftPolicy,type DraftSyncPolicy} from './substack-draft-sync';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function draftPolicyDigest(p:DraftSyncPolicy){return hash(JSON.stringify({policyVersion:p.policyVersion,transport:p.transport,origin:p.origin,repository:p.repository,branch:p.branch,expiresAt:p.expiresAt,sessionExclusive:p.sessionExclusive,executor:p.executor,browserName:p.browserName,evidenceDirectory:p.evidenceDirectory,maxArticles:p.maxArticles,timeoutMs:p.timeoutMs,maxRoundMs:p.maxRoundMs,allowCreate:p.allowCreate===true,mediaProfile:p.mediaProfile}));}
/** Reuses private activation/acceptance artifacts; strings alone cannot enable the Computer Use port. */
export async function validateDraftActivation(p:DraftSyncPolicy,pinFile:string|undefined,now:string,deps:{read?:(file:string)=>Promise<unknown>;verifyPin?:(runtime:string,pin:string)=>Promise<void>;pinDigest?:(raw:string)=>string}={}){
 assertDraftPolicy(p,now);if(!pinFile)throw Error('SUBSTACK_DRAFT_ACTIVATION_REQUIRED');
 const read=deps.read??(async(file:string)=>fs.readFile(file,'utf8'));
 const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const verify=deps.verifyPin??(async(root:string,pin:string)=>{const {verifyRuntimePin}=await import('./sync-distribution');await verifyRuntimePin(root,pin,['scripts/publishing/substack-draft-sync.ts','scripts/publishing/substack-draft-computer-use.ts','scripts/publishing/substack-draft-round.ts','scripts/publishing/substack-draft-executor.ts','scripts/publishing/substack-draft-qualification.ts','scripts/publishing/substack-draft-media.ts','scripts/publishing/scheduled-source.ts','scripts/publishing/substack-draft-activation.ts','scripts/publishing/substack-schedule.ts','scripts/publishing/substack-schedule-attended.ts','scripts/publishing/substack-attended.ts','scripts/publishing/distribution-handoff.ts','apps/admin-worker/src/substack-schedules.ts']);});
 await verify(runtime,pinFile);
 const raw=await read(pinFile);if(typeof raw!=='string')throw Error('SUBSTACK_DRAFT_ACTIVATION_REQUIRED');
 const pinDigest=(deps.pinDigest??hash)(raw),scopeDigest=draftPolicyDigest(p);
 const parse=(r:unknown)=>typeof r==='string'?JSON.parse(r):r;
 const [q,a]=await Promise.all([read(p.qualificationRef).then(parse),read(p.authorizationRef).then(parse)]) as Record<string,unknown>[];
 const valid=(r:Record<string,unknown>)=>r&&r.schema===1&&r.policyVersion===p.policyVersion&&r.scopeDigest===scopeDigest&&r.pinDigest===pinDigest&&typeof r.expiresAt==='string'&&Number.isFinite(Date.parse(r.expiresAt))&&Date.parse(r.expiresAt)>Date.parse(now)&&r.draftOnly===true;
 if(!valid(q)||!valid(a)||a.approved!==true||q.passed!==true||q.fullReadback!==true||q.exactSlug!==true||q.sameId!==true||q.unattendedExecutor!==true||q.sessionExclusive!==true||p.mediaProfile&&(q.mediaProfile!==p.mediaProfile||q.mediaQualified!==true))throw Error('SUBSTACK_DRAFT_ACTIVATION_REQUIRED');
}
