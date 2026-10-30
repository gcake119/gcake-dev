export const indexAlertReasons=['activation_check','not_started','backlog','in_progress','completion_candidate','waiting','source_changed','evidence_expired','observation_unavailable','history_gap','runtime_changed','source_unavailable','stale','unknown_delivery','delivery_rejected','notification_not_configured','blocked','disabled','ineligible','unknown_inference','capacity_expired'] as const;
export type IndexAlertReason=typeof indexAlertReasons[number];
export type IndexAlertDelivery='sending'|'sent'|'rejected'|'unknown'|'not_configured';
export interface IndexAlertHistory {
 schemaVersion:1;
 monitor:{status:'active'|'paused'|'disabled'|'not_configured'|'not_started';checkedAt:number|null;reason:IndexAlertReason;validUntil:string|null};
 events:{id:string;corpusId:string;reason:IndexAlertReason;createdAt:number;delivery:IndexAlertDelivery;deliveredAt:number|null}[];
}
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const time=(v:unknown)=>v===null||count(v);
const reason=(v:any):v is IndexAlertReason=>indexAlertReasons.includes(v);
export function parseIndexAlertHistory(v:unknown):IndexAlertHistory {
 const b=v as any,m=b?.monitor;
 if(!object(b)||b.schemaVersion!==1||!object(m)||!['active','paused','disabled','not_configured','not_started'].includes(m.status)||!time(m.checkedAt)||!reason(m.reason)||(m.validUntil!==null&&(typeof m.validUntil!=='string'||!Number.isFinite(Date.parse(m.validUntil))))||!Array.isArray(b.events)||b.events.length>20)throw Error('INVALID_ALERT_HISTORY');
 const ids=new Set<string>();
 const events=b.events.map((e:any)=>{
  if(!object(e)||typeof e.id!=='string'||!/^[a-f0-9]{64}$/.test(e.id)||ids.has(e.id)||typeof e.corpusId!=='string'||!/^[a-f0-9]{64}$/.test(e.corpusId)||!reason(e.reason)||!count(e.createdAt)||!['sending','sent','rejected','unknown','not_configured'].includes(e.delivery)||!time(e.deliveredAt)||e.delivery==='sent'&&e.deliveredAt===null||e.delivery!=='sent'&&e.deliveredAt!==null)throw Error('INVALID_ALERT_HISTORY');
  ids.add(e.id);return {id:e.id,corpusId:e.corpusId,reason:e.reason,createdAt:e.createdAt,delivery:e.delivery,deliveredAt:e.deliveredAt};
 });
 return {schemaVersion:1,monitor:{status:m.status,checkedAt:m.checkedAt,reason:m.reason,validUntil:m.validUntil},events};
}
