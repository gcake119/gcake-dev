import {parseIndexSnapshot,safePhase,type SafeReceipt} from '../../../packages/admin-contract/src/index-status';
import {sha256} from './deployed';
import {syncModelConfig} from './sync';
interface StatusDatabase {prepare(sql:string):{bind(...values:unknown[]):{first<T>():Promise<T|null>}};}
export interface StatusBindings {INDEX_STATUS_TOKEN?:string;INDEX_STATUS_VALID_UNTIL?:string;INDEX_SYNC_TOKEN?:string;DISCOVERY_DB?:StatusDatabase;VERSION_METADATA?:{id:string};SEMANTIC_ENABLED?:string;INDEX_SYNC_ENABLED?:string;}
const headers={'Cache-Control':'no-store'};
export const statusSql=`SELECT
 json_extract(policy,'$.activeCorpusId') activeCorpusId,
 json_extract(policy,'$.modelConfig') modelConfig,
 json_extract(policy,'$.activeVectorNamespace') activeNamespace,
 json_extract(policy,'$.syncCapacity.validUntil') capacityValidUntil,
 json_extract(policy,'$.billing.validUntil') billingValidUntil,
 s.corpusId targetCorpusId,s.cursor reportedCompleted,s.status,s.updated lastProgressAt,s.nextAttemptAt,
 (s.owner IS NOT NULL AND s.leaseUntil>?) leaseActive,
 (SELECT COUNT(*) FROM discovery_sync_vectors WHERE modelConfig=? AND namespace=? AND metadataHash<>'') storedProofCount,
 (SELECT COUNT(*) FROM discovery_sync_pending) pendingCount,
 (SELECT json_group_array(stage) FROM (SELECT DISTINCT CASE WHEN stage IN ('reserved','embedded','uploaded') THEN stage ELSE 'unknown' END stage FROM discovery_sync_pending)) pendingStages,
 (SELECT COALESCE(MIN(id),0) FROM discovery_sync_receipts) firstId,
 (SELECT COALESCE(MAX(id),0) FROM discovery_sync_receipts) latestId,
 (SELECT json_group_array(json_object('id',id,'createdAt',created,'corpusId',corpusId,'status',status)) FROM (SELECT id,created,corpusId,status FROM discovery_sync_receipts ORDER BY id DESC LIMIT 2)) recent,
 (SELECT json_group_array(json_object('id',id,'createdAt',created,'corpusId',corpusId,'status',status)) FROM (SELECT id,created,corpusId,status FROM discovery_sync_receipts WHERE id>? ORDER BY id LIMIT ?)) receipts
 FROM discovery_sync s JOIN discovery_policy p ON p.id='active' WHERE s.id=1`;
export async function indexStatus(request:Request,env:StatusBindings,now=Date.now()):Promise<Response>{
 const denied=()=>new Response(null,{status:404,headers});
 const secret=env.INDEX_STATUS_TOKEN,authorization=request.headers.get('Authorization');
 if(request.method!=='GET'||!secret||!/^[A-Za-z0-9_-]{43}$/.test(secret)||secret===env.INDEX_SYNC_TOKEN||!env.INDEX_STATUS_VALID_UNTIL||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(env.INDEX_STATUS_VALID_UNTIL)||!Number.isFinite(Date.parse(env.INDEX_STATUS_VALID_UNTIL))||Date.parse(env.INDEX_STATUS_VALID_UNTIL)<=now||!authorization||authorization.length>256)return denied();
 const [actual,expected]=await Promise.all([sha256(authorization),sha256('Bearer '+secret)]);let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);if(diff)return denied();
 const fail=(status:number)=>Response.json({error:{code:status===400?'INVALID_STATUS_QUERY':'STATUS_UNAVAILABLE'}},{status,headers});
 const params=new URL(request.url).searchParams;
 for(const key of params.keys())if(!['afterReceipt','limit'].includes(key)||params.getAll(key).length!==1)return fail(400);
 const number=(k:string,fallback:number)=>{const v=params.get(k);return v===null?fallback:/^(0|[1-9][0-9]*)$/.test(v)?Number(v):NaN;};
 const after=number('afterReceipt',0),limit=number('limit',20);
 if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>50||request.body)return fail(400);
 if(!env.DISCOVERY_DB||!env.VERSION_METADATA?.id)return fail(503);
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const namespace=await sha256(syncModelConfig);
  const row=await Promise.race([env.DISCOVERY_DB.prepare(statusSql).bind(now,syncModelConfig,namespace,after,limit).first<Record<string,any>>(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000);})]);
  if(!row||row.modelConfig!==syncModelConfig)throw Error('missing');
  const safe=(value:string):SafeReceipt[]=>JSON.parse(value).map((r:any)=>({id:r.id,createdAt:r.createdAt,corpusId:r.corpusId,status:safePhase(r.status),reasonCode:safePhase(r.status)}));
  const receipts=safe(row.receipts);
  const value=parseIndexSnapshot({schemaVersion:1,observedAt:new Date(now).toISOString(),workerVersionId:env.VERSION_METADATA.id,semanticEnabled:env.SEMANTIC_ENABLED==='true',indexSyncEnabled:env.INDEX_SYNC_ENABLED==='true',targetCorpusId:row.targetCorpusId,activeCorpusId:row.activeCorpusId??'',namespaceMatchesModel:row.activeNamespace===namespace,reportedCompleted:row.reportedCompleted,storedProofCount:row.storedProofCount,pendingCount:row.pendingCount,pendingStages:JSON.parse(row.pendingStages),leaseActive:!!row.leaseActive,nextAttemptAt:row.nextAttemptAt,lastProgressAt:row.lastProgressAt,capacityValidUntil:row.capacityValidUntil??null,billingValidUntil:row.billingValidUntil??null,status:safePhase(row.status),recentReceipts:safe(row.recent),receiptPage:{receipts,firstRetainedReceiptId:row.firstId,latestReceiptId:row.latestId,hasMore:(receipts.at(-1)?.id??after)<row.latestId,historyGap:after<row.firstId-1,historyReset:after>row.latestId}});
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>65536)throw Error('size');
  return Response.json(value,{headers});
 }catch{return fail(503);}finally{clearTimeout(timer);}
}
