import {boundedJson,createIndexSourceReader,indexAssessment,INDEX_STATUS_URL,parseIndexSnapshot,parseIndexAlertHistory,type SourceTotal} from '@gcake/admin-contract';
import type {D1DatabaseLike} from './media.js';
export interface AlertEnv {
 CMS_DB?:unknown; INDEX_ALERTS_ENABLED?:string; INDEX_ALERTS_ACTIVATION_CHECK?:string; INDEX_STATUS_TOKEN?:string;
 INDEX_STATUS_VALID_UNTIL?:string; INDEX_ALERTS_VALID_UNTIL?:string; INDEX_ALERTS_SEED?:string;
 INDEX_ALERTS_TELEGRAM_TOKEN?:string; INDEX_ALERTS_TELEGRAM_CHAT_ID?:string; INDEX_ALERTS_TELEGRAM_BOT_ID?:string;
}
export interface AlertState {afterReceipt:number;workerVersionId:string;acceptedCorpusId:string;activeCorpusId?:string;checkedAt:number|null;phase:string;paused:boolean;validUntil:string;}
type Delivery='sending'|'sent'|'rejected'|'unknown'|'not_configured';
interface EventRow {id:string;corpus_id:string;reason:string;created_at:number;delivery:Delivery;delivered_at:number|null;message_id:number|null;}
const corpus=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const count=(s:unknown):s is number=>Number.isSafeInteger(s)&&Number(s)>=0;
function seed(env:AlertEnv):AlertState|null {
 try{
  if(env.INDEX_ALERTS_ACTIVATION_CHECK!==undefined&&!['true','false'].includes(env.INDEX_ALERTS_ACTIVATION_CHECK))return null;
  if(!env.INDEX_ALERTS_SEED||env.INDEX_ALERTS_SEED.length>1024||!env.INDEX_STATUS_TOKEN||!/^[A-Za-z0-9_-]{43}$/.test(env.INDEX_STATUS_TOKEN))return null;
  const s=JSON.parse(env.INDEX_ALERTS_SEED),a=Date.parse(env.INDEX_ALERTS_VALID_UNTIL??''),b=Date.parse(env.INDEX_STATUS_VALID_UNTIL??'');
  if(!count(s.afterReceipt)||!corpus(s.acceptedCorpusId)||typeof s.workerVersionId!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(s.workerVersionId)||!Number.isFinite(a)||!Number.isFinite(b))return null;
  return {afterReceipt:s.afterReceipt,workerVersionId:s.workerVersionId,acceptedCorpusId:s.acceptedCorpusId,checkedAt:null,phase:'not_started',paused:false,validUntil:new Date(Math.min(a,b)).toISOString()};
 }catch{return null;}
}
function telegramReady(e:AlertEnv){return /^\d{1,20}:[A-Za-z0-9_-]{20,120}$/.test(e.INDEX_ALERTS_TELEGRAM_TOKEN??'')&&/^\d{1,20}$/.test(e.INDEX_ALERTS_TELEGRAM_BOT_ID??'')&&e.INDEX_ALERTS_TELEGRAM_TOKEN!.split(':')[0]===e.INDEX_ALERTS_TELEGRAM_BOT_ID&&/^-?\d{1,20}$/.test(e.INDEX_ALERTS_TELEGRAM_CHAT_ID??'');}
export class D1AlertStore {
 constructor(readonly db:D1DatabaseLike) {}
 async initialize(s:AlertState){await this.db.prepare('INSERT INTO index_alert_state(id,document) VALUES(1,?) ON CONFLICT(id) DO NOTHING').bind(JSON.stringify(s)).run();}
 async read():Promise<AlertState|null>{const r=await this.db.prepare('SELECT document FROM index_alert_state WHERE id=1').first<{document:string}>();return r?JSON.parse(r.document):null;}
 async acquire(owner:string,now:number):Promise<AlertState|null>{const r=await this.db.prepare("UPDATE index_alert_state SET owner=?,lease_until=? WHERE id=1 AND lease_until<=? AND json_extract(document,'$.paused')=0 RETURNING document").bind(owner,now+60000,now).first<{document:string}>();return r?JSON.parse(r.document):null;}
 async save(owner:string,s:AlertState){const r=await this.db.prepare('UPDATE index_alert_state SET document=? WHERE id=1 AND owner=? RETURNING id').bind(JSON.stringify(s),owner).first();if(!r)throw Error('LEASE_LOST');}
 async release(owner:string){await this.db.prepare('UPDATE index_alert_state SET owner=NULL,lease_until=0 WHERE id=1 AND owner=?').bind(owner).run();}
 async recover(owner:string){return !!await this.db.prepare("UPDATE index_alert_events SET delivery='unknown' WHERE delivery='sending' AND EXISTS(SELECT 1 FROM index_alert_state WHERE id=1 AND owner=?) RETURNING id").bind(owner).first();}
 async intent(owner:string,e:EventRow){return !!await this.db.prepare('INSERT INTO index_alert_events(id,corpus_id,reason,created_at,delivery) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM index_alert_state WHERE id=1 AND owner=?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(e.id,e.corpus_id,e.reason,e.created_at,e.delivery,owner).first();}
 async delivered(owner:string,id:string,delivery:Delivery,at:number|null,message:number|null){const r=await this.db.prepare('UPDATE index_alert_events SET delivery=?,delivered_at=?,message_id=? WHERE id=? AND EXISTS(SELECT 1 FROM index_alert_state WHERE id=1 AND owner=?) RETURNING id').bind(delivery,at,message,id,owner).first();if(!r)throw Error('LEASE_LOST');}
 async events(){return (await this.db.prepare('SELECT id,corpus_id,reason,created_at,delivery,delivered_at,message_id FROM index_alert_events ORDER BY created_at DESC,id DESC LIMIT 20').all<EventRow>()).results;}
}
class ObservationStop extends Error {}
class JournalStop extends Error {}
const sources=new WeakMap<typeof fetch,ReturnType<typeof createIndexSourceReader>>();
interface Dependencies {store?:D1AlertStore;fetcher?:typeof fetch;now?:()=>number;source?:(signal:AbortSignal)=>Promise<SourceTotal>;}
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const reasonLabels:Record<string,string>={activation_check:'雲端索引通知啟用驗證：這是測試訊息，不代表搜尋品質驗收',completion_candidate:'同步完成候選，語意搜尋與人工品質仍待驗證',evidence_expired:'監測或容量證據已到期，請人工核實',observation_unavailable:'目前無法取得可信的索引狀態',history_gap:'索引觀測收據不連續，請人工核實',runtime_changed:'搜尋服務版本已變更，請核對監測資格',source_unavailable:'公開來源無法核對',stale:'索引紀錄長時間未更新',unknown_delivery:'前次通知結果不明，已停止自動重送',notification_not_configured:'通知管道尚未完成設定'};
async function send(env:AlertEnv,fetcher:typeof fetch,reason:string,corpusId:string,signal:AbortSignal){
 try{
  const response=await fetcher('https://api.telegram.org/bot'+env.INDEX_ALERTS_TELEGRAM_TOKEN+'/sendMessage',{method:'POST',redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.INDEX_ALERTS_TELEGRAM_CHAT_ID,text:'搜尋索引通知\n'+(reasonLabels[reason]??'索引處理已停止：'+reason)+'\n版本：'+corpusId.slice(0,12)+'\nhttps://gcake-admin-worker-production.wwhowbuhow.workers.dev/'})});
  // Telegram's explicit rejection body is safe to classify; never persist its description.
  if(response.redirected||response.status>=300&&response.status<400)return {delivery:'unknown' as const,message:null};
  const body:any=await boundedJson(new Response(response.body,{status:200}),signal,16384);
  if(body?.ok===false&&Number.isSafeInteger(body.error_code))return {delivery:'rejected' as const,message:null};
  if(!response.ok||body?.ok!==true||!count(body.result?.message_id)||!Number.isSafeInteger(body.result?.chat?.id)||String(body.result.chat.id)!==env.INDEX_ALERTS_TELEGRAM_CHAT_ID)return {delivery:'unknown' as const,message:null};
  return {delivery:'sent' as const,message:body.result.message_id as number};
 }catch{return {delivery:'unknown' as const,message:null};}
}
export async function runCloudIndexAlerts(env:AlertEnv,deps:Dependencies={}){
 const initial=seed(env);if(env.INDEX_ALERTS_ENABLED!=='true'||!initial)return {status:'not_configured'};
 const store=deps.store??(env.CMS_DB?new D1AlertStore(env.CMS_DB as D1DatabaseLike):undefined);if(!store)return {status:'not_configured'};
 const now=deps.now??Date.now,fetcher=deps.fetcher??fetch,owner=crypto.randomUUID(),signal=AbortSignal.timeout(30000);
 let state:AlertState|null=null;
 try{
  await store.initialize(initial);state=await store.acquire(owner,now());if(!state)return {status:(await store.read())?.paused?'paused':'busy'};
  const current=state;
  const alert=async(reason:string,pause:boolean)=>{try{
   const id=await hash(JSON.stringify([current.workerVersionId,current.activeCorpusId??current.acceptedCorpusId,reason]));
   const corpusId=current.activeCorpusId??current.acceptedCorpusId;
   const ready=telegramReady(env),inserted=await store.intent(owner,{id,corpus_id:corpusId,reason,created_at:now(),delivery:ready?'sending':'not_configured',delivered_at:null,message_id:null});
   let phase=reason;
   if(inserted&&ready){const result=await send(env,fetcher,reason,corpusId,signal);await store.delivered(owner,id,result.delivery,result.delivery==='sent'?now():null,result.message);if(result.delivery!=='sent'){pause=true;phase=result.delivery==='unknown'?'unknown_delivery':'delivery_rejected';}}
   if(!ready)pause=true;
   current.phase=phase;current.paused=pause;await store.save(owner,current);
  }catch{throw new JournalStop('JOURNAL_UNAVAILABLE');}};
  if(await store.recover(owner)){current.phase='unknown_delivery';current.paused=true;await store.save(owner,current);return {status:'paused'};}
  if(Date.parse(initial.validUntil)<=now()||Date.parse(current.validUntil)<=now()){await alert('evidence_expired',true);return {status:'paused'};}
  if(!telegramReady(env)){await alert('notification_not_configured',true);return {status:'paused'};}
  let source=deps.source??sources.get(fetcher);if(!source){source=createIndexSourceReader(fetcher);sources.set(fetcher,source);}
  try{
   for(let page=0;page<11;page++){
    signal.throwIfAborted();const one=AbortSignal.any([signal,AbortSignal.timeout(5000)]),url=new URL(INDEX_STATUS_URL);url.searchParams.set('afterReceipt',String(current.afterReceipt));url.searchParams.set('limit','50');
    const s=parseIndexSnapshot(await boundedJson(await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+env.INDEX_STATUS_TOKEN},signal:one,redirect:'manual',cache:'no-store'}),one));
    if(s.workerVersionId!==current.workerVersionId)throw new ObservationStop('runtime_changed');
    const p=s.receiptPage,last=p.receipts.at(-1)?.id??current.afterReceipt;
    if(p.historyGap||p.historyReset||p.receipts.some((r,i)=>r.id!==current.afterReceipt+i+1)||last>p.latestReceiptId||p.hasMore!==(last<p.latestReceiptId))throw new ObservationStop('history_gap');
    const expiry=Math.min(Date.parse(s.capacityValidUntil??''),Date.parse(s.billingValidUntil??''),Date.parse(initial.validUntil));
    if(!Number.isFinite(expiry)||expiry<=now()){await alert('evidence_expired',true);return {status:'paused'};}
    let total:SourceTotal;try{total=await source(signal);}catch{throw new ObservationStop('source_unavailable');}
    signal.throwIfAborted();current.afterReceipt=last;current.checkedAt=now();current.activeCorpusId=total.corpusId;
    current.validUntil=new Date(Math.min(Date.parse(current.validUntil),expiry)).toISOString();
    current.phase=p.hasMore?'backlog':indexAssessment(s,total,now());
    // Pending uploads alone do not explain fifteen minutes without receipts.
    // A qualified future wait or live lease does; never turn those into failures.
    if(!p.hasMore&&['in_progress','completion_candidate'].includes(current.phase)&&!s.leaseActive&&s.nextAttemptAt<=now()&&now()-s.lastProgressAt>=900000)current.phase='stale';
    await store.save(owner,current);
    if(p.hasMore)continue;
    if(current.phase==='completion_candidate'&&total.corpusId!==current.acceptedCorpusId)await alert('completion_candidate',false);
    else if(['stale','blocked','disabled','ineligible','unknown_inference','capacity_expired'].includes(current.phase))await alert(current.phase,true);
    else if(env.INDEX_ALERTS_ACTIVATION_CHECK==='true'&&current.phase==='completion_candidate'&&total.corpusId===current.acceptedCorpusId)await alert('activation_check',false);
    return {status:current.paused?'paused':current.phase};
   }
   return {status:'backlog'};
  }catch(error){if(error instanceof JournalStop)return {status:'unavailable'};await alert(error instanceof ObservationStop?error.message:'observation_unavailable',true);return {status:'paused'};}
 }catch{return {status:'unavailable'};}
 finally{if(state)try{await store.release(owner);}catch{/* The lease expires; any unfinished send remains recoverable and never replayed. */}}
}
export async function readAlertHistory(env:AlertEnv,store?:D1AlertStore){
 const headers={'Cache-Control':'no-store'};
 try{
  const s=store??(env.CMS_DB?new D1AlertStore(env.CMS_DB as D1DatabaseLike):undefined);if(!s)throw Error('missing');
  const state=await s.read(),events=await s.events();
  return Response.json(parseIndexAlertHistory({schemaVersion:1,monitor:{status:env.INDEX_ALERTS_ENABLED!=='true'?'disabled':!seed(env)||!telegramReady(env)?'not_configured':state?.paused?'paused':state?'active':'not_started',checkedAt:state?.checkedAt??null,reason:state?.phase??'not_started',validUntil:state?.validUntil??env.INDEX_ALERTS_VALID_UNTIL??null},events:events.map(e=>({id:e.id,corpusId:e.corpus_id,reason:e.reason,createdAt:e.created_at,delivery:e.delivery,deliveredAt:e.delivered_at}))}),{headers});
 }catch{return Response.json({error:{code:'INDEX_ALERTS_UNAVAILABLE'}},{status:503,headers});}
}
