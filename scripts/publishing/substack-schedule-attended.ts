import {parseHTML} from 'linkedom';
import {assertScheduleMedia,contentFingerprint,type ScheduleProvider,type ScheduleObservation,type ScheduleRequest,expectedContent} from './substack-schedule';
import type {ScheduledSource} from './scheduled-source';
import {type ExchangeRequest} from './substack-attended';
import {ScheduleRepository,SCHEDULE_POLICY,type ConfirmedSlot} from '../../apps/admin-worker/src/substack-schedules';
export interface ScheduleExchangeRequest extends ExchangeRequest {
 exchangeVersion:2;policyVersion:typeof SCHEDULE_POLICY;scheduleId:string;sourceCommit?:string;
 action:'schedule-find'|'schedule-read'|'schedule-create'|'schedule-update'|'schedule-arm'|'schedule-remove';
 scheduledAt?:string;slot?:ConfirmedSlot;publishedUpdate?:boolean;html?:string;delivery:{email:boolean;appInbox:boolean};audience:'everyone';timeZone:'Asia/Taipei';
 intentId?:string;recordVersion:number;
}
export function validateScheduleObservation(value:unknown,id?:string,verifyMedia=true):ScheduleObservation{
 const e=value as ScheduleObservation;if(!e||typeof e!=='object'||!/^\d+$/.test(e.id)||id&&e.id!==id||typeof e.slug!=='string'||!['draft','scheduled','published','sending'].includes(e.state)||e.saved!==true)throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');
 contentFingerprint(e.content);if(verifyMedia)assertScheduleMedia(e);if(e.state==='scheduled'&&(!e.scheduledAt||!Number.isFinite(Date.parse(e.scheduledAt))||e.timeZone!=='Asia/Taipei'||typeof e.email!=='boolean'||typeof e.appInbox!=='boolean'||e.audience!=='everyone'))throw Error('SUBSTACK_SCHEDULE_EVIDENCE_INVALID');return e;
}
export function validateScheduleReply(request:ScheduleExchangeRequest,value:unknown){
 if(request.action==='schedule-find'){const r=value as {complete:boolean;scanned:string[];items:ScheduleObservation[]};if(r?.complete!==true||!Array.isArray(r.scanned)||!['draft','published','scheduled'].every(s=>r.scanned.includes(s))||!Array.isArray(r.items))throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');r.items.forEach(e=>validateScheduleObservation(e));if(new Set(r.items.map(e=>e.id)).size!==r.items.length)throw Error('SUBSTACK_DUPLICATE_REMOTE');return;}
 if(request.action==='schedule-create'){const r=value as {id:string};if(!r||!/^\d+$/.test(r.id))throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');return;}
 const e=validateScheduleObservation(value,request.remote?.id,request.action!=='schedule-remove'&&!['cancel-schedule','reconcile-schedule'].includes(request.operation));
 if(request.action==='schedule-read')return;
 if(request.action==='schedule-remove'){if(e.state!=='draft'||e.listEvidence?.draft!==true||e.listEvidence.scheduled!==false)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');return;}
 if(e.slug!==request.article.slug)throw Error('SUBSTACK_SLUG_CONFLICT');
 if(request.action==='schedule-arm'&&(e.state!=='scheduled'||e.listEvidence?.scheduled!==true||e.listEvidence.draft!==false||Date.parse(e.scheduledAt!)!==Date.parse(request.scheduledAt!)||e.email!==true||e.appInbox!==true))throw Error('SUBSTACK_SCHEDULE_EVIDENCE_INVALID');
 if(request.action==='schedule-update'&&request.publishedUpdate&&e.state!=='published'||request.action==='schedule-update'&&!request.publishedUpdate&&e.state!=='draft')throw Error('SUBSTACK_SCHEDULE_EVIDENCE_INVALID');
 const expected=expectedContent({article:request.article} as ScheduledSource);if(contentFingerprint(e.content)!==contentFingerprint(expected))throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
 if(request.action==='schedule-update'&&request.publishedUpdate&&(request.delivery.email!==false||request.delivery.appInbox!==false))throw Error('SUBSTACK_EMAIL_MUST_BE_DISABLED');
}
export class AttendedScheduleProvider implements ScheduleProvider {
 constructor(readonly request:ScheduleRequest,readonly repo:ScheduleRepository,readonly exchange:(r:ScheduleExchangeRequest)=>Promise<unknown>,readonly beforeDispatch?:()=>Promise<void>){}
 private async send(action:ScheduleExchangeRequest['action'],id?:string,extra:Partial<ScheduleExchangeRequest>={}){
  const state=await this.repo.get(this.request.scheduleId);if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');
  const mutation=({'schedule-create':'create','schedule-update':extra.publishedUpdate?'update-public':'update-draft','schedule-arm':'arm','schedule-remove':'remove'} as Record<string,string>)[action];
  if(mutation)await this.beforeDispatch?.();
  if(mutation&&(!state.intent||state.intent.action!==mutation||state.remoteId!==id))throw Error('SUBSTACK_SCHEDULE_INTENT_REQUIRED');
  const source=this.request.source;
  const article=source?.article??{slug:this.request.slug,sourceRevision:state.sourceRevision??'',title:'',body:'',canonicalUrl:'https://gcake119.github.io/gcake-dev/posts/'+this.request.slug+'/',assets:[]};
  const r:ScheduleExchangeRequest={exchangeVersion:2,policyVersion:SCHEDULE_POLICY,scheduleId:state.scheduleId,sourceCommit:source?.sourceCommit,action,operation:this.request.operation,article,remote:id?{id,url:'https://gcakedev.substack.com/publish/post/'+id}:undefined,delivery:{email:action==='schedule-arm',appInbox:action==='schedule-arm'},audience:'everyone',timeZone:'Asia/Taipei',intentId:state.intent?.id,recordVersion:state.version,...(action==='schedule-arm'?{slot:this.request.slot}:{}),...extra};
  const result=await this.exchange(r);validateScheduleReply(r,result);return result;
 }
 private sameSource(source:ScheduledSource){if(JSON.stringify(source)!==JSON.stringify(this.request.source))throw Error('SUBSTACK_SOURCE_CHANGED');}
 async find(source:ScheduledSource){this.sameSource(source);return await this.send('schedule-find') as Awaited<ReturnType<ScheduleProvider['find']>>;}
 async read(id:string){return await this.send('schedule-read',id) as ScheduleObservation;}
 async create(source:ScheduledSource){this.sameSource(source);return (await this.send('schedule-create') as {id:string}).id;}
 async update(id:string,source:ScheduledSource,published:boolean){this.sameSource(source);await this.send('schedule-update',id,{publishedUpdate:published,html:expectedContent(source).html});}
 async arm(id:string,scheduledAt:string){await this.send('schedule-arm',id,{scheduledAt});}
 async remove(id:string){await this.send('schedule-remove',id);}
}

export interface SchedulePreviewUiCapture {html:string;audienceRadios:{value:string;checked:boolean}[];localTime?:string;attributeTime?:string;min?:string;max?:string}
/** Current attended preview controls only. A preview is never committed provider evidence. */
export function readSchedulePreviewUi(capture:SchedulePreviewUiCapture,deviceTimeZone:string){
 const {document}=parseHTML('<html><body>'+capture.html+'</body></html>');
 const unique=(selector:string)=>{const items=document.querySelectorAll(selector);if(items.length!==1)throw Error('SUBSTACK_SCHEDULE_UI_AMBIGUOUS');return items[0];};
 const checked=(selector:string)=>{const value=unique(selector).getAttribute('aria-checked');if(value!=='true'&&value!=='false')throw Error('SUBSTACK_SCHEDULE_UI_UNVERIFIED');return value==='true';};
 const dialog=unique('[role="dialog"]');
 if(deviceTimeZone!=='Asia/Taipei')throw Error('SUBSTACK_SCHEDULE_TIMEZONE_MISMATCH');
 const email=checked('[role="dialog"] [role="checkbox"][data-track-input="send_email"]');
 const scheduleSelected=checked('[role="dialog"] [role="checkbox"][data-testid="scheduled-at"]');
 const audiences=capture.audienceRadios;
 const values=Array.from(document.querySelectorAll('[role="dialog"] input[name="audience"]')).map(e=>e.getAttribute('value'));
 if(!Array.isArray(audiences)||audiences.length!==values.length||audiences.some(e=>typeof e.checked!=='boolean'||!values.includes(e.value))||new Set(audiences.map(e=>e.value)).size!==audiences.length||audiences.filter(e=>e.checked).length!==1||audiences.find(e=>e.checked)?.value!=='everyone')throw Error('SUBSTACK_SCHEDULE_AUDIENCE_MISMATCH');
 let scheduledAt:string|undefined;
 if(scheduleSelected){
  const date=unique('[role="dialog"] input[data-testid="date-editor"]');
  if(!/時區：GMT\+8/.test(dialog.textContent??''))throw Error('SUBSTACK_SCHEDULE_TIMEZONE_MISMATCH');
  if(!capture.localTime||capture.localTime!==capture.attributeTime||capture.attributeTime!==date.getAttribute('value')||capture.min!==date.getAttribute('min')||capture.max!==date.getAttribute('max'))throw Error('SUBSTACK_SCHEDULE_PREVIEW_UNCOMMITTED');
  const instant=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('SUBSTACK_SCHEDULE_TIME_INVALID');const n=Date.parse(value+':00+08:00');if(!Number.isFinite(n)||new Date(n+28800000).toISOString().slice(0,16)!==value)throw Error('SUBSTACK_SCHEDULE_TIME_INVALID');return n;};
  const selected=instant(capture.localTime);if(!capture.min||!capture.max||selected<=instant(capture.min)||selected>instant(capture.max))throw Error('SUBSTACK_SCHEDULE_TIME_INVALID');scheduledAt=new Date(selected).toISOString();
 }
 return {kind:'schedule-preview' as const,armed:false as const,timeZone:'Asia/Taipei' as const,audience:'everyone' as const,email,appInbox:email,scheduleSelected,scheduledAt};
}
