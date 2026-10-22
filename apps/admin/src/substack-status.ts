export interface DraftStatus {
 schemaVersion:1;slug:string;providerId:string|null;version:number;
 sync:{status:string;checkedAt:string|null;unresolvedOperation:boolean;code?:string|null};
 publication:{state:string;confirmedTime:string|null;actualTime?:string|null;differenceSeconds?:number|null};
 delivery:{evidence:string;subscriberReceipt:string};
 attention:{pendingAction:string|null;code:string|null};actions:string[];
}
export interface StatusReadState {rows:DraftStatus[];page?:{limit:number;offset:number;hasMore:boolean};loading:boolean;loaded:boolean;error:string|null;loginRequired:boolean;untracked:boolean}
export const emptyStatusState=():StatusReadState=>({rows:[],loading:false,loaded:false,error:null,loginRequired:false,untracked:false});
const object=(v:unknown):v is Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nullable=(v:unknown)=>v==null||typeof v==='string';
function validDraft(v:unknown):v is DraftStatus {
 return object(v)&&v.schemaVersion===1&&typeof v.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)&&nullable(v.providerId)&&Number.isSafeInteger(v.version)&&v.version>0
  &&object(v.sync)&&typeof v.sync.status==='string'&&nullable(v.sync.checkedAt)&&typeof v.sync.unresolvedOperation==='boolean'
  &&object(v.publication)&&typeof v.publication.state==='string'&&nullable(v.publication.confirmedTime)&&nullable(v.publication.actualTime)&&(v.publication.differenceSeconds==null||typeof v.publication.differenceSeconds==='number'&&Number.isFinite(v.publication.differenceSeconds))
  &&object(v.delivery)&&typeof v.delivery.evidence==='string'&&typeof v.delivery.subscriberReceipt==='string'
  &&object(v.attention)&&nullable(v.attention.code)&&nullable(v.attention.pendingAction)&&Array.isArray(v.actions)&&v.actions.every((a:unknown)=>typeof a==='string');
}
/** One GET consumer for both views; cancelled or superseded requests never publish state. */
export function createStatusReader(changed:(value:StatusReadState)=>void,fetcher:typeof fetch=fetch){
 let state=emptyStatusState(),generation=0,controller:AbortController|undefined,context:string|undefined,disposed=false;
 const publish=(value:StatusReadState)=>{state=value;changed(value);};
 return {get state(){return state;},async load(slug?:string,offset=0){
  if(disposed)return;
  const key=slug?'post:'+slug:'list',sequence=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
  if(key!==context){state=emptyStatusState();context=key;}
  publish({...state,loading:true,error:null,loginRequired:false,untracked:false});
  const current=()=>!disposed&&sequence===generation;
  try{
   if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('invalid');
   const path=slug?'/api/v1/substack/drafts/'+encodeURIComponent(slug):'/api/v1/substack/drafts?limit=50&offset='+offset;
   const response=await fetcher(path,{method:'GET',credentials:'same-origin',cache:'no-store',signal});if(!current())return;
   if(response.status===401){publish({...emptyStatusState(),loaded:true,loginRequired:true,error:'登入已失效，請重新登入後查看狀態。'});return;}
   if(response.status===404&&slug){publish({...emptyStatusState(),loaded:true,untracked:true});return;}
   if(!response.ok)throw Error('unavailable');
   const value:unknown=await response.json();if(!current())return;
   if(!object(value))throw Error('invalid');
   if(slug){if(!validDraft(value.draft)||value.draft.slug!==slug)throw Error('identity');publish({...emptyStatusState(),loaded:true,rows:[value.draft]});}
   else {
    const p=value.page;if(value.schemaVersion!==1||!Array.isArray(value.drafts)||!value.drafts.every(validDraft)||!object(p)||p.limit!==50||p.offset!==offset||typeof p.hasMore!=='boolean'||value.drafts.length>p.limit||new Set(value.drafts.map((r:DraftStatus)=>r.slug)).size!==value.drafts.length)throw Error('invalid');
    publish({...emptyStatusState(),loaded:true,rows:value.drafts,page:{limit:p.limit,offset:p.offset,hasMore:p.hasMore}});
   }
  }catch{if(current()&&!signal.aborted)publish({...state,error:state.rows.length?'目前無法更新，以下保留上次讀取的資料。':'目前無法讀取 Substack 狀態，請稍後重新讀取。'});}
  finally{if(current()&&state.loading)publish({...state,loading:false});}
 },dispose(){disposed=true;++generation;controller?.abort();}};
}
export function taipeiTime(value:string|null,seconds=false){if(!value||!Number.isFinite(Date.parse(value)))return '尚無確認時間';return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit' as const}:{}),hourCycle:'h23'}).format(new Date(value)).replace(/\s+/g,' ')+'（台北）';}
interface EvidenceLabel {label:string;tone:'neutral'|'good'|'notice'|'danger';detail:string}
const label=(text:string,tone:EvidenceLabel['tone']='neutral',detail=''):EvidenceLabel=>({label:text,tone,detail});
export function statusPresentation(row:DraftStatus){
 const sync:Record<string,EvidenceLabel>={
  'not-observed':label('尚未查核'),pending:label('待同步','notice'),syncing:label('同步處理中','notice','以最後查核結果為準。'),verified:label('已保存並驗證','good'),
  excluded:label('不自動編輯','neutral','已排程或已公開，保留原承諾。'),conflict:label('人工修改衝突','danger','請先人工審閱內容。'),inconclusive:label('驗證未完成','notice','不能確認目前內容是否一致。'),
  'foreground-required':label('需人工處理','notice'), 'reconciliation-required':label('結果待查證','notice','先查原文章，不直接重做寫入。'),
 };
 const publication:Record<string,EvidenceLabel>={
  'not-observed':label('尚無平台身分'),draft_prepared:label('草稿'),cancelled_draft:label('已解除排程的草稿'),scheduled:label('已排程','notice',taipeiTime(row.publication.confirmedTime)),published_unverified:label('公開待驗證','notice'),verified:label('公開驗證完成','good'),reconciliation_required:label('發布狀態待查證','notice'),
 };
 const delivery:Record<string,EvidenceLabel>={not_armed:label('未安排寄送'),armed:label('已安排寄送','notice','依最後確認的寄送安排。'),unknown:label('寄送結果未知'),provider_reported:label('平台回報已寄送','notice','平台回報不等於真人實收。')};
 const syncView=row.sync.code==='SUBSTACK_DRAFT_CREATION_DISABLED'?label('自動新建未啟用','notice','請先人工確認既有文章身分。'):sync[row.sync.status]??label('同步狀態待確認');
 const delta=row.publication.differenceSeconds;const timing=row.publication.actualTime?`原定：${taipeiTime(row.publication.confirmedTime,true)}；實際：${taipeiTime(row.publication.actualTime,true)}${typeof delta==='number'?`；${delta===0?'準時':`${delta>0?'晚':'早'} ${Math.abs(delta)} 秒`}`:''}`:null;
 return {timing,sync:syncView,publication:publication[row.publication.state]??label('發布狀態待確認'),delivery:delivery[row.delivery.evidence]??label('寄送結果待確認'),receipt:'尚無實收證據',checkedAt:taipeiTime(row.sync.checkedAt),attention:row.attention.pendingAction||row.attention.code?'另有發布或文章身分問題，需人工查核。':null};
}
