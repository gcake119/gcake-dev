import {parseAdminIndexStatus,type AdminIndexStatus} from '@gcake/admin-contract';
export function progressPresentation(completed:unknown,total:unknown,aligned:boolean){
 if(!aligned||!Number.isSafeInteger(completed)||Number(completed)<0||!Number.isSafeInteger(total)||Number(total)<0||Number(completed)>Number(total))return {kind:'unknown' as const,percent:null};
 if(total===0)return {kind:'empty' as const,percent:null};
 return {kind:'known' as const,completed:Number(completed),total:Number(total),percent:Math.floor(1000*Number(completed)/Number(total))/10};
}
export const assessmentLabels:Record<string,string>={disabled:'索引處理已停用',ineligible:'使用資格已到期，等待確認',source_unavailable:'總數待核對',source_changed:'公開版本已變，等待對齊',capacity_expired:'容量證據已到期，等待確認',unknown_inference:'處理結果待確認，請勿重跑',waiting:'等待下一次可處理時間',blocked:'處理已停止，等待確認',stale:'進度紀錄已過時，請確認狀態',in_progress:'索引處理中',completion_candidate:'同步完成候選，語意搜尋待驗證'};
export interface IndexReadState{data:AdminIndexStatus|null;loading:boolean;error:string|null;loginRequired:boolean;lastReadAt:number|null;refreshAvailableAt:number;}
interface Options{fetcher?:typeof fetch;now?:()=>number;setTimer?:(fn:()=>void,ms:number)=>unknown;clearTimer?:(id:unknown)=>void;}
/** One in-flight read; inactive panels cancel rather than publishing late responses. */
export function createIndexStatusReader(changed:(value:IndexReadState)=>void,options:Options={}){
 const fetcher=options.fetcher??fetch,now=options.now??Date.now;
 const setTimer=options.setTimer??((fn,ms)=>setTimeout(fn,ms)),clearTimer=options.clearTimer??(id=>clearTimeout(id as ReturnType<typeof setTimeout>));
 let state:IndexReadState={data:null,loading:false,error:null,loginRequired:false,lastReadAt:null,refreshAvailableAt:0};
 let active=false,disposed=false,generation=0,controller:AbortController|undefined,timer:unknown;
 const publish=(next:IndexReadState)=>{state=next;changed({...state});};
 const cancel=()=>{++generation;controller?.abort();clearTimer(timer);timer=undefined;};
 const schedule=()=>{clearTimer(timer);if(active&&!disposed)timer=setTimer(()=>{void load(false);},300000);};
 async function load(manual=true){
  if(!active||disposed||state.loading||manual&&now()<state.refreshAvailableAt)return;
  const sequence=++generation;controller=new AbortController();const bounded=AbortSignal.any([controller.signal,AbortSignal.timeout(27000)]);
  publish({...state,loading:true,refreshAvailableAt:now()+10000});
  const current=()=>active&&!disposed&&generation===sequence;
  try{
   const response=await fetcher('/api/v1/discovery/index-status',{method:'GET',credentials:'same-origin',cache:'no-store',signal:bounded});
   if(!current())return;
   if(response.status===401||response.status===403){publish({...state,data:null,loading:false,lastReadAt:null,loginRequired:response.status===401,error:response.status===401?'登入已失效，請重新登入後查看狀態。':'此帳號無權查看搜尋索引。'});active=false;return;}
   if(!response.ok)throw Error('unavailable');
   const data=parseAdminIndexStatus(await response.json());if(!current())return;
   // A successful new-source response replaces the old percentage, including unknown totals.
   publish({...state,data,loading:false,error:null,loginRequired:false,lastReadAt:now()});
  }catch{if(current())publish({...state,loading:false,error:state.data?'目前無法更新，以下保留上次記錄進度。':'目前無法讀取搜尋索引，請稍後重新讀取。'});}
  finally{if(current()){if(state.loading)publish({...state,loading:false});schedule();}}
 }
 return {get state(){return state;},load,activate(value:boolean){if(disposed||value===active)return;active=value;if(!value){cancel();publish({...state,loading:false});}else void load(false);},dispose(){disposed=true;active=false;cancel();}};
}
