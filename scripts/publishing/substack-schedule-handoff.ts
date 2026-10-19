import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CloudflareD1Database} from './d1-api';
import {ScheduleRepository,SCHEDULE_POLICY,type ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
import {buildScheduledSource,type ScheduledSource} from './scheduled-source';
import {readSchedulePreviewUi,validateScheduleReply,type ScheduleExchangeRequest} from './substack-schedule-attended';
export interface ScheduleEnvelope {version:2;requestId:string;slug:string;sourceRevision:string;operation:string;action:string;remoteId:string|null;expiresAt:number;scopeDigest:string;request:ScheduleExchangeRequest}
export function validateScheduleHandoff(e:ScheduleEnvelope,state:ScheduleRecord,source?:ScheduledSource,now=Date.now()){
 const r=e?.request,scope=r&&createHash('sha256').update(JSON.stringify(r)).digest('hex');
 if(e?.version!==2||!e.requestId||!Number.isFinite(e.expiresAt)||e.expiresAt<=now||e.scopeDigest!==scope||r?.exchangeVersion!==2||r.policyVersion!==SCHEDULE_POLICY||r.scheduleId!==state.scheduleId||r.recordVersion!==state.version||e.action!==r.action||e.operation!==r.operation||e.slug!==r.article?.slug||e.slug!==state.slug||e.remoteId!==(r.remote?.id??null)||e.remoteId!==(state.remoteId??null)||e.sourceRevision!==r.article.sourceRevision)throw Error('SUBSTACK_HANDOFF_REQUEST_MISMATCH');
 if(source&&r.sourceCommit&&(source.sourceCommit!==r.sourceCommit||JSON.stringify(source.article)!==JSON.stringify(r.article)))throw Error('SUBSTACK_HANDOFF_SOURCE_COMMIT_MISMATCH');
 const mutation=({'schedule-create':'create','schedule-update':r.publishedUpdate?'update-public':'update-draft','schedule-arm':'arm','schedule-remove':'remove'} as Record<string,string>)[r.action];
 if(mutation&&(!state.intent||state.intent.id!==r.intentId||state.intent.action!==mutation))throw Error('SUBSTACK_HANDOFF_INTENT_REQUIRED');
 if(['schedule-update','schedule-arm','schedule-create'].includes(r.action)&&(!source||!r.sourceCommit))throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');
 if(r.action==='schedule-arm'&&(r.scheduledAt!==state.intent?.scheduledAt||r.delivery.email!==true||r.delivery.appInbox!==true||r.timeZone!=='Asia/Taipei'||r.audience!=='everyone'))throw Error('SUBSTACK_SCHEDULE_EVIDENCE_INVALID');
 if(r.action==='schedule-update'&&r.publishedUpdate&&(r.delivery.email!==false||r.delivery.appInbox!==false))throw Error('SUBSTACK_EMAIL_MUST_BE_DISABLED');
}
export async function scheduleHandoff(action:string,values:Map<string,string>){
 const config=JSON.parse(await fs.readFile(values.get('--config')!,'utf8'));if(config.scheduled?.policyVersion!==SCHEDULE_POLICY||config.scheduled.transport!=='attended'||config.scheduled.writeEnabled!==true)throw Error('SUBSTACK_SCHEDULE_WRITE_DISABLED');
 const root=await fs.realpath(values.get('--source-root')!),base=await fs.realpath(config.scheduled.sessionDirectory),file=await fs.realpath(values.get('--request')!);
 const outside=path.relative(root,base),relative=path.relative(base,file);if(!outside||!outside.startsWith('..'+path.sep)&&outside!=='..'&&!path.isAbsolute(outside)||!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||path.basename(file)!=='request.json')throw Error('SUBSTACK_HANDOFF_PATH_MISMATCH');
 const e=JSON.parse(await fs.readFile(file,'utf8')) as ScheduleEnvelope;
 const repo=new ScheduleRepository(new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??''));
 const state=await repo.get(e.request.scheduleId);if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');let source:ScheduledSource|undefined;
 try{if(e.request.sourceCommit)source=await buildScheduledSource(root,state.slug);}catch(error){if(!(error instanceof Error)||error.message!=='SUBSTACK_SOURCE_NOT_FINALIZED'||!['schedule-read','schedule-remove','schedule-find'].includes(e.action))throw error;}
 if(source&&execFileSync('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8',timeout:30000}).trim().split(/\s+/)[0]!==source.sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');
 validateScheduleHandoff(e,state,source);
 if(action==='reply-schedule'){
  if(!values.has('--evidence'))throw Error('SUBSTACK_HANDOFF_USAGE');const evidence=JSON.parse(await fs.readFile(values.get('--evidence')!,'utf8'));validateScheduleReply(e.request,evidence);
  validateScheduleHandoff(e,(await repo.get(state.scheduleId))!,source);
  await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...e,request:undefined,ok:true,result:evidence},null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({requestId:e.requestId,replied:true}));
 }else {const preview=action==='proof-schedule'&&values.has('--evidence')?readSchedulePreviewUi(JSON.parse(await fs.readFile(values.get('--evidence')!,'utf8')),Intl.DateTimeFormat().resolvedOptions().timeZone):undefined;console.log(JSON.stringify({requestFile:file,envelope:e,observed:state,preview,originalSite:'not_checked',nativeTransport:'unqualified'}));}
}
