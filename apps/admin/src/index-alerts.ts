import {boundedJson,parseIndexAlertHistory,type IndexAlertHistory} from '@gcake/admin-contract';
export interface AlertReadState {data:IndexAlertHistory|null;loading:boolean;error:string|null;loginRequired:boolean;lastReadAt:number|null;refreshAvailableAt:number;}
interface Options {now?:()=>number;fetcher?:typeof fetch;}
export function createAlertHistoryReader(changed:(s:AlertReadState)=>void,options:Options={}){
 const state:AlertReadState={data:null,loading:false,error:null,loginRequired:false,lastReadAt:null,refreshAvailableAt:0};
 const now=options.now??Date.now,fetcher=options.fetcher??fetch;let disposed=false,request:AbortController|undefined;
 const publish=()=>changed({...state});
 async function load(){
  if(disposed||state.loading||now()<state.refreshAvailableAt)return;
  const current=new AbortController();request=current;state.loading=true;state.error=null;state.refreshAvailableAt=now()+10000;publish();
  const signal=AbortSignal.any([current.signal,AbortSignal.timeout(27000)]),valid=()=>!disposed&&request===current&&!current.signal.aborted;
  try{
   const response=await fetcher('/api/v1/discovery/index-alerts',{method:'GET',credentials:'same-origin',cache:'no-store',signal});
   if(!valid())return;
   if(response.status===401||response.status===403){state.data=null;state.lastReadAt=null;state.loginRequired=true;state.error='請以擁有者帳號登入，才能查看通知紀錄。';return;}
   const data=parseIndexAlertHistory(await boundedJson(response,signal));if(!valid())return;
   state.data=data;state.lastReadAt=now();state.loginRequired=false;
  }catch{if(valid())state.error=state.data?'目前無法更新通知；下方為上次讀取紀錄。':'目前無法讀取通知紀錄。';}
  finally{if(valid()){state.loading=false;publish();}if(request===current)request=undefined;}
 }
 return {state,load,dispose:()=>{disposed=true;request?.abort();request=undefined;}};
}
export const alertDeliveryLabels={sending:'寄送結果待確認',sent:'Telegram 已確認接收',rejected:'Telegram 拒絕接收',unknown:'寄送結果不明，已停止自動重送',not_configured:'通知管道未設定'};
export const alertMonitorLabels={active:'雲端定期檢查中',paused:'雲端檢查已暫停，需人工處理',disabled:'雲端通知尚未啟用',not_configured:'雲端通知設定尚未完成',not_started:'等待首次雲端檢查'};
export const alertReasonLabels:Record<string,string>={activation_check:'雲端通知啟用驗證（測試訊息）',completion_candidate:'同步完成候選，搜尋驗收仍待確認',evidence_expired:'監測或容量證據已到期',observation_unavailable:'目前無法讀取可信的索引狀態',history_gap:'觀測收據不連續',runtime_changed:'搜尋服務版本已變更',source_unavailable:'公開來源無法核對',stale:'索引紀錄長時間未更新',unknown_delivery:'前次寄送結果不明',delivery_rejected:'Telegram 拒絕接收通知',notification_not_configured:'通知管道未設定',blocked:'索引處理已停止',disabled:'索引或語意搜尋已停用',ineligible:'使用資格已到期',unknown_inference:'推論結果需要人工核實',capacity_expired:'容量證據已到期'};
