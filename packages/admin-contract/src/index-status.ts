/** Safe observation contract shared by readers. No state mutation or provider access. */
export const INDEX_STATUS_URL = 'https://gcake-public-search-production.wwhowbuhow.workers.dev/internal/index-status';
export const statusNames = ['idle','preparing','uploaded','embedded','awaiting_provider','awaiting_readback','verified','promoted','no_change','quota_exceeded','blocked','source_changed','capacity_exceeded','ineligible','disabled','unknown'] as const;
export type IndexPhase = typeof statusNames[number];
export interface SafeReceipt { id:number; createdAt:number; corpusId:string; status:IndexPhase; reasonCode:IndexPhase; }
export interface IndexSnapshot {
 schemaVersion:1; observedAt:string; workerVersionId:string;
 semanticEnabled:boolean; indexSyncEnabled:boolean; targetCorpusId:string; activeCorpusId:string;
 namespaceMatchesModel:boolean; reportedCompleted:number; storedProofCount:number; pendingCount:number;
 pendingStages:string[]; leaseActive:boolean; nextAttemptAt:number; lastProgressAt:number;
 capacityValidUntil:string|null; billingValidUntil:string|null; status:IndexPhase;
 recentReceipts:SafeReceipt[];
 receiptPage:{receipts:SafeReceipt[];firstRetainedReceiptId:number;latestReceiptId:number;hasMore:boolean;historyGap:boolean;historyReset:boolean};
}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const corpus=(v:unknown)=>typeof v==='string'&&(/^[a-f0-9]{64}$/.test(v)||v==='');
const date=(v:unknown)=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v));
const phase=(v:unknown):v is IndexPhase=>statusNames.includes(v as IndexPhase);
export function safePhase(v:unknown):IndexPhase{return phase(v)?v:'unknown';}
function receipt(v:unknown):SafeReceipt{
 if(!object(v)||!count(v.id)||!count(v.createdAt)||!corpus(v.corpusId)||!phase(v.status)||!phase(v.reasonCode))throw Error('INVALID_STATUS');
 return {id:v.id,createdAt:v.createdAt,corpusId:v.corpusId,status:v.status,reasonCode:v.reasonCode};
}
/** Reconstruct the allowlist; never pass arbitrary upstream fields to the browser or disk. */
export function parseIndexSnapshot(v:unknown):IndexSnapshot {
 if(!object(v)||v.schemaVersion!==1||!date(v.observedAt)||!v.observedAt||typeof v.workerVersionId!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(v.workerVersionId)
 ||!corpus(v.targetCorpusId)||!corpus(v.activeCorpusId)||!phase(v.status))throw Error('INVALID_STATUS');
 for(const k of ['semanticEnabled','indexSyncEnabled','namespaceMatchesModel','leaseActive'])if(typeof v[k]!=='boolean')throw Error('INVALID_STATUS');
 for(const k of ['reportedCompleted','storedProofCount','pendingCount','nextAttemptAt','lastProgressAt'])if(!count(v[k]))throw Error('INVALID_STATUS');
 if(!date(v.capacityValidUntil)||!date(v.billingValidUntil)||!Array.isArray(v.pendingStages)||v.pendingStages.length>4||!v.pendingStages.every((s:unknown)=>['reserved','embedded','uploaded','unknown'].includes(s as string)))throw Error('INVALID_STATUS');
 const p=v.receiptPage;
 if(!object(p)||!Array.isArray(p.receipts)||p.receipts.length>50||!count(p.firstRetainedReceiptId)||!count(p.latestReceiptId)||p.firstRetainedReceiptId>p.latestReceiptId||!['hasMore','historyGap','historyReset'].every(k=>typeof p[k]==='boolean')||!Array.isArray(v.recentReceipts)||v.recentReceipts.length>2)throw Error('INVALID_STATUS');
 const rows=p.receipts.map(receipt),recent=v.recentReceipts.map(receipt);
 if(rows.some((r:SafeReceipt,i:number)=>r.id<p.firstRetainedReceiptId||r.id>p.latestReceiptId||i>0&&r.id<=rows[i-1].id)||recent.some((r:SafeReceipt,i:number)=>r.id>p.latestReceiptId||i>0&&r.id>=recent[i-1].id))throw Error('INVALID_STATUS');
 return {schemaVersion:1,observedAt:v.observedAt,workerVersionId:v.workerVersionId,semanticEnabled:v.semanticEnabled,indexSyncEnabled:v.indexSyncEnabled,targetCorpusId:v.targetCorpusId,activeCorpusId:v.activeCorpusId,namespaceMatchesModel:v.namespaceMatchesModel,reportedCompleted:v.reportedCompleted,storedProofCount:v.storedProofCount,pendingCount:v.pendingCount,pendingStages:v.pendingStages.slice(),leaseActive:v.leaseActive,nextAttemptAt:v.nextAttemptAt,lastProgressAt:v.lastProgressAt,capacityValidUntil:v.capacityValidUntil,billingValidUntil:v.billingValidUntil,status:v.status,recentReceipts:recent,receiptPage:{receipts:rows,firstRetainedReceiptId:p.firstRetainedReceiptId,latestReceiptId:p.latestReceiptId,hasMore:p.hasMore,historyGap:p.historyGap,historyReset:p.historyReset}};
}
export interface SourceTotal {corpusId:string;total:number;sourceIdentity:string;}
export function indexAssessment(s:IndexSnapshot,source:SourceTotal|null,now=Date.now()):string {
 if(!s.semanticEnabled||!s.indexSyncEnabled)return 'disabled';
 if(!s.billingValidUntil||Date.parse(s.billingValidUntil)<=now)return 'ineligible';
 if(!source)return 'source_unavailable';
 if(source.corpusId!==s.targetCorpusId)return 'source_changed';
 const r=s.recentReceipts;
 const candidate=s.activeCorpusId===source.corpusId&&s.namespaceMatchesModel&&s.reportedCompleted===source.total&&!s.pendingCount&&!s.leaseActive&&['promoted','no_change'].includes(s.status)&&!s.receiptPage.historyGap&&!s.receiptPage.historyReset&&r.length===2&&r.every(x=>x.status==='no_change'&&x.corpusId===source.corpusId)&&r[0].createdAt-r[1].createdAt>=60000;
 if(candidate)return 'completion_candidate';
 if(!s.capacityValidUntil||Date.parse(s.capacityValidUntil)<=now)return 'capacity_expired';
 if(s.pendingStages.includes('reserved')&&!s.leaseActive)return 'unknown_inference';
 if(s.nextAttemptAt>now)return 'waiting';
 if(['blocked','source_changed','capacity_exceeded','ineligible','unknown'].includes(s.status))return 'blocked';
 if(!s.leaseActive&&!s.pendingCount&&now-s.lastProgressAt>=900000)return 'stale';
 return 'in_progress';
}
export interface AdminIndexStatus {schemaVersion:1;snapshot:IndexSnapshot;source:SourceTotal|null;assessment:string;searchAcceptance:'unverified';}
export function parseAdminIndexStatus(v:unknown):AdminIndexStatus{
 if(!object(v)||v.schemaVersion!==1||v.searchAcceptance!=='unverified')throw Error('INVALID_STATUS');
 const snapshot=parseIndexSnapshot(v.snapshot);let source:SourceTotal|null=null;
 if(v.source!==null){if(!object(v.source)||!corpus(v.source.corpusId)||!v.source.corpusId||!count(v.source.total)||typeof v.source.sourceIdentity!=='string'||v.source.sourceIdentity.length>2048)throw Error('INVALID_STATUS');source={corpusId:v.source.corpusId,total:v.source.total,sourceIdentity:v.source.sourceIdentity};}
 return {schemaVersion:1,snapshot,source,assessment:indexAssessment(snapshot,source,Date.parse(snapshot.observedAt)),searchAcceptance:'unverified'};
}
export async function boundedText(response:Response,signal:AbortSignal,max=65536):Promise<string>{
 if(!response.ok||response.redirected||!response.body)throw Error('STATUS_UNAVAILABLE');
 const reader=response.body.getReader();const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});let size=0,text='';const decoder=new TextDecoder();
 try{while(true){signal.throwIfAborted();const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>max)throw Error('INVALID_STATUS');text+=decoder.decode(r.value,{stream:true});}signal.throwIfAborted();return text+decoder.decode();}
 finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export async function boundedJson(response:Response,signal:AbortSignal,max=65536):Promise<unknown>{return JSON.parse(await boundedText(response,signal,max));}
