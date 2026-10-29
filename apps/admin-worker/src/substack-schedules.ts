import type {D1DatabaseLike} from './media.js';
export const SCHEDULE_POLICY='scheduled-source-first-delivery-v1' as const;
export type ScheduleOperation='prepare-draft'|'arm-schedule'|'revise-schedule'|'postpone-schedule'|'cancel-schedule'|'reconcile-schedule'|'sync-content';
export interface ConfirmedSlot {reservationId:string;queueVersion:number;slug:string;scheduledAt:string;confirmed:boolean}
export interface ScheduleIntent {id:string;policyVersion?:typeof SCHEDULE_POLICY;expectedGeneration?:number;audience?:'everyone';email?:boolean;appInbox?:boolean;action:'create'|'update-draft'|'update-public'|'arm'|'remove';sourceRevision?:string;expectedDigest?:string;scheduledAt?:string;slot?:ConfirmedSlot;createdAt:string}
export interface DraftSyncEvidence {status:'pending'|'syncing'|'verified'|'excluded'|'conflict'|'inconclusive'|'foreground-required'|'reconciliation-required';desiredRevision?:string;savedRevision?:string;baselineDigest?:string;code?:string;checkedAt:string;transport:'computer-use'}
export interface ScheduleRecord {
 approvedPresentation?:{version:1;profile:'table-rows-labelled-lists-original-png-v1';remoteId:string;sourceRevision:string;approvedAt:string;imageDigests:string[]};
 draftSync?:DraftSyncEvidence;
 publicationEvidence?:{title:string;confirmedAt?:string;actualAt:string;differenceSeconds?:number};
 policyVersion:typeof SCHEDULE_POLICY;scheduleId:string;slug:string;previousSlugs?:string[];legacyNewsletterSentAt?:string;legacyPublished?:boolean;everPublished?:boolean;sourcePath?:string;sourceCommit?:string;sourceRevision?:string;version:number;remoteId?:string;
 editUrl?:string;expectedPublicUrl?:string;remoteUrl?:string;timeZone?:'Asia/Taipei';audience?:'everyone';
 observedState:'draft_prepared'|'scheduled'|'cancelled_draft'|'published_unverified'|'verified'|'reconciliation_required';
 desiredState?:'draft'|'scheduled'|'cancelled';desiredRevision?:string;desiredTime?:string;observedTime?:string;observedRevision?:string;contentDigest?:string;
 originalSite?:{status:'not_checked'|'not_published'|'unavailable'|'mismatch'|'verified';publishedAt?:string;dateDiffersFromSubstack?:boolean};
 verification?:{status:'verified'|'presentation_only'|'content_difference'|'identity_difference'|'time_difference'|'inconclusive';checkedAt:string;code?:string};
 lastComparison?:{sourceRevision:string;observedDigest:string;expectedDigest:string;mode:'draft'|'scheduled'|'public';differences:string[];result:'verified-no-change'|'pending-edit'|'verified-edit'};
 armedRevision?:string;deliveredRevision?:string;publicationMinute?:string;contentVerifiedRevision?:string;verifiedAt?:string;
 emailEnabled?:boolean;appInboxEnabled?:boolean;slot?:ConfirmedSlot;intent?:ScheduleIntent;pendingAction?:string;lastErrorCode?:string;delivery:'not_armed'|'armed'|'unknown'|'provider_reported';updatedAt:string;
}
function decode(raw:string):ScheduleRecord{const r=JSON.parse(raw) as ScheduleRecord;if(r.policyVersion!==SCHEDULE_POLICY||!Number.isSafeInteger(r.version)||r.version<1||!r.scheduleId||!r.slug)throw Error('SUBSTACK_SCHEDULE_RECORD_INVALID');return r;}
export class ScheduleRepository {
 constructor(readonly db:D1DatabaseLike){}
 async get(id:string):Promise<ScheduleRecord|undefined>{const row=await this.db.prepare('SELECT record_json FROM publication_schedules WHERE schedule_id = ?').bind(id).first<{record_json:string}>();return row?decode(row.record_json):undefined;}
 async bySlug(slug:string):Promise<ScheduleRecord|undefined>{const row=await this.db.prepare('SELECT record_json FROM publication_schedules WHERE post_slug = ?').bind(slug).first<{record_json:string}>();if(row)return decode(row.record_json);return (await this.list()).find(r=>r.previousSlugs?.includes(slug));}
 async list():Promise<ScheduleRecord[]>{const rows=await this.db.prepare('SELECT record_json FROM publication_schedules ORDER BY schedule_id').all<{record_json:string}>();return rows.results.map(r=>decode(r.record_json));}
 async save(record:ScheduleRecord,previous:number):Promise<ScheduleRecord>{
  if(record.version!==previous)throw Error('SUBSTACK_SCHEDULE_CONFLICT');const next={...record,...(record.remoteId?{editUrl:'https://gcakedev.substack.com/publish/post/'+record.remoteId,expectedPublicUrl:'https://gcakedev.substack.com/p/'+record.slug,remoteUrl:record.observedState==='verified'?'https://gcakedev.substack.com/p/'+record.slug:'https://gcakedev.substack.com/publish/post/'+record.remoteId}:{}),version:previous+1};
  const sql=previous===0?'INSERT INTO publication_schedules (schedule_id,post_slug,remote_id,version,record_json) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING':'UPDATE publication_schedules SET post_slug = ?, remote_id = ?, version = ?, record_json = ? WHERE schedule_id = ? AND version = ?';
  const values=previous===0?[next.scheduleId,next.slug,next.remoteId??null,next.version,JSON.stringify(next)]:[next.slug,next.remoteId??null,next.version,JSON.stringify(next),next.scheduleId,previous];
  const result=await this.db.prepare(sql).bind(...values).run() as {meta?:{changes?:number};changes?:number|bigint};
  if(Number(result.meta?.changes??result.changes)!==1)throw Error('SUBSTACK_SCHEDULE_CONFLICT');return next;
 }
}
