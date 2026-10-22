import type {SessionDatabase} from './auth.js';
import type {ScheduleRecord} from './substack-schedules.js';
export interface DraftStatusStore {get(slug:string):Promise<ScheduleRecord|undefined>;list(limit:number,offset:number):Promise<ScheduleRecord[]>}
const text=(s:unknown)=>typeof s==='string'&&s.length<=200?s:null;
export function draftStatusView(s:ScheduleRecord){
 const d=s.draftSync;
 const unresolved=!!s.intent||d?.status==='reconciliation-required';
 const status=unresolved?'reconciliation-required':d?.status==='verified'&&d.desiredRevision!==d.savedRevision?'pending':d?.status??'not-observed';
 const code=d?.code&&/^SUBSTACK_[A-Z_]+$/.test(d.code)?d.code:null;
 return {schemaVersion:1,slug:s.slug,providerId:s.remoteId??null,version:s.version,
  sync:{status,desiredRevision:text(d?.desiredRevision??s.desiredRevision),savedRevision:text(d?.savedRevision??s.contentVerifiedRevision),checkedAt:text(d?.checkedAt),code,transport:d?.transport==='computer-use'?'computer-use':null,unresolvedOperation:unresolved},
  publication:{state:s.remoteId?s.observedState:'not-observed',confirmedTime:text(s.observedTime),actualTime:text(s.publicationEvidence?.actualAt),differenceSeconds:Number.isFinite(s.publicationEvidence?.differenceSeconds)?s.publicationEvidence!.differenceSeconds:null,armedRevision:text(s.armedRevision)},
  delivery:{evidence:s.delivery,deliveredRevision:text(s.deliveredRevision),subscriberReceipt:'unknown'},
  attention:{pendingAction:text(s.pendingAction),code:s.lastErrorCode&&/^SUBSTACK_[A-Z_]+$/.test(s.lastErrorCode)?s.lastErrorCode:null},
  actions:unresolved?['foreground-reconcile']:status==='conflict'?['foreground-review']:status==='foreground-required'||s.lastErrorCode||s.pendingAction||s.observedState==='scheduled'||s.everPublished||s.legacyPublished?['foreground-review']:[],updatedAt:s.updatedAt};
}
function decode(raw:string):ScheduleRecord{const s=JSON.parse(raw) as ScheduleRecord;if(s.policyVersion!=='scheduled-source-first-delivery-v1'||!s.slug||!Number.isSafeInteger(s.version)||s.version<1)throw Error('SUBSTACK_STATE_INVALID');return s;}
/** Shares the deployed schedule table. GET performs no ingest, provider access or mutation. */
export class D1DraftStatusStore implements DraftStatusStore {
 constructor(private readonly db:SessionDatabase){}
 async get(slug:string){const r=await this.db.prepare('SELECT record_json FROM publication_schedules WHERE post_slug = ?').bind(slug).first<{record_json:string}>();return r?decode(r.record_json):undefined;}
 async list(limit:number,offset:number){
  const row=await this.db.prepare('SELECT json_group_array(record_json) AS records FROM (SELECT record_json FROM publication_schedules ORDER BY schedule_id LIMIT ? OFFSET ?)').bind(limit,offset).first<{records:string}>();
  if(!row)throw Error('SUBSTACK_STATE_UNAVAILABLE');
  const records:unknown=JSON.parse(row.records);if(!Array.isArray(records)||records.some(r=>typeof r!=='string'))throw Error('SUBSTACK_STATE_INVALID');return records.map(r=>decode(r));
 }
}
