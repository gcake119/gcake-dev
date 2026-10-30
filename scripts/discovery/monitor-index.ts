import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {INDEX_STATUS_URL,boundedJson,parseIndexSnapshot,indexAssessment,type SourceTotal} from '../../packages/admin-contract/src/index-status';
import {createIndexSourceReader as sourceReader} from '../../packages/admin-contract/src/index-source';
export interface MonitorCheckpoint {afterReceipt:number;workerVersionId:string;baselineReceiptId?:number;}
interface MonitorOptions {checkpoint?:MonitorCheckpoint;credential:()=>Promise<string>;fetcher?:typeof fetch;source?:(signal:AbortSignal)=>Promise<SourceTotal>;saveEvidence:(value:unknown)=>Promise<void>;saveCheckpoint:(value:MonitorCheckpoint)=>Promise<void>;}
export async function monitorOnce(options:MonitorOptions){
 const fetcher=options.fetcher??fetch,signal=AbortSignal.timeout(30000),source=options.source??sourceReader(fetcher);
 let cursor=options.checkpoint?.afterReceipt??0,pin=options.checkpoint?.workerVersionId;
 try{
  const token=await options.credential();if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('credential');
  let result:any;let baseline=options.checkpoint?.baselineReceiptId;
  for(let page=0;page<11;page++){
   signal.throwIfAborted();const single=AbortSignal.any([signal,AbortSignal.timeout(5000)]);
   const url=new URL(INDEX_STATUS_URL);url.searchParams.set('afterReceipt',String(cursor));url.searchParams.set('limit','50');
   const snapshot=parseIndexSnapshot(await boundedJson(await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'manual',cache:'no-store',signal:single}),single));
   if(pin&&pin!==snapshot.workerVersionId)throw Error('version');pin=snapshot.workerVersionId;
   const p=snapshot.receiptPage;
   const initialBaseline=!options.checkpoint&&page===0&&p.historyGap;
   if(initialBaseline){baseline=p.firstRetainedReceiptId;cursor=baseline-1;}
   if(p.historyReset||p.historyGap&&!initialBaseline||p.receipts.some((r,i)=>r.id!==cursor+i+1))throw Error('history');
   let publicSource:SourceTotal|null=null;try{publicSource=await source(signal);}catch{/* Keep source-unavailable evidence, never infer a total. */}
   if((p.receipts.at(-1)?.id??cursor)>p.latestReceiptId||p.hasMore!==((p.receipts.at(-1)?.id??cursor)<p.latestReceiptId))throw Error('history');
   const status=initialBaseline?'initial_baseline':p.hasMore?'backlog':indexAssessment(snapshot,publicSource);
   result={schemaVersion:1,status,snapshot,source:publicSource,searchAcceptance:'unverified',initialBaseline:!options.checkpoint,receiptContinuity:baseline?'from_retained_baseline':'from_checkpoint',providerAudit:'unverified'};
   await options.saveEvidence(result);
   const next=p.receipts.at(-1)?.id??cursor;
   if(p.hasMore&&next===cursor)throw Error('history');
   await options.saveCheckpoint({afterReceipt:next,workerVersionId:pin,...(baseline?{baselineReceiptId:baseline}:{})});cursor=next;
   if(!p.hasMore)return result;
  }
  return result;
 }catch{
  const result={schemaVersion:1,status:'unavailable',afterReceipt:cursor,searchAcceptance:'unverified'};
  await options.saveEvidence(result);return result;
 }
}
async function main(){
 const root=resolve('output/discovery/index-status-monitor');await mkdir(root,{recursive:true,mode:0o700});
 let checkpoint:MonitorCheckpoint|undefined;
 try{checkpoint=JSON.parse(await readFile(resolve(root,'checkpoint.json'),'utf8'));if(!Number.isSafeInteger(checkpoint?.afterReceipt)||checkpoint!.afterReceipt<0||typeof checkpoint?.workerVersionId!=='string')throw Error('invalid checkpoint');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');let sequence=0;
 const publicSource=sourceReader(fetch,{load:async()=>{try{const raw=await readFile(resolve(root,'public-source.json'),'utf8');if(Buffer.byteLength(raw)>25*1024*1024)throw Error('cache too large');return JSON.parse(raw);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}},save:async value=>{const tmp=resolve(root,`${stamp}-source.tmp`);await writeFile(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});await rename(tmp,resolve(root,'public-source.json'));}});
 const result=await monitorOnce({checkpoint,source:publicSource,credential:async()=>{const {stdout}=await promisify(execFile)('/usr/bin/security',['find-generic-password','-s','gcake-index-status-production','-a',process.env.USER??'', '-w'],{timeout:5000,maxBuffer:4096});return stdout.trim();},
 saveEvidence:async value=>{await writeFile(resolve(root,`${stamp}-${sequence++}.json`),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});},
 saveCheckpoint:async value=>{const temp=resolve(root,`${stamp}.tmp`);await writeFile(temp,JSON.stringify(value)+'\n',{mode:0o600,flag:'wx'});await rename(temp,resolve(root,'checkpoint.json'));}});
 console.log(JSON.stringify({status:result.status,searchAcceptance:'unverified',evidenceDirectory:root}));if(result.status==='unavailable')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().catch(()=>{console.error('監測未完成，保留既有紀錄；未變更雲端。');process.exitCode=1;});
