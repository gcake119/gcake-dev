import {isDeepStrictEqual,promisify} from 'node:util';
import {buildDraftSource} from './substack-draft-media';
import {validateDraftActivation} from './substack-draft-activation';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
import {ScheduleRepository,SCHEDULE_POLICY} from '../../apps/admin-worker/src/substack-schedules';
import {D1DistributionRuntime} from '../../apps/admin-worker/src/distribution-runtime';
import {listLocalPostFiles} from '../../src/lib/content/local-posts';
import {buildScheduledSource,type ScheduledSource} from './scheduled-source';
import {DraftSyncCoordinator,assertDraftPolicy,type DraftSyncPolicy,type DraftPort} from './substack-draft-sync';
import {ComputerUseDraftPort,type DraftExchangeRequest} from './substack-draft-computer-use';
import {FileAttendedExchange} from './substack-attended';
import {replyWithDraftExecutor,type DraftExecutorOptions} from './substack-draft-executor';
interface Policy extends DraftSyncPolicy {maxArticles:number;timeoutMs:number;maxRoundMs?:number}
interface Dependencies {readSource?:typeof buildScheduledSource;assertMain?:(root:string,commit:string,signal?:AbortSignal)=>Promise<void>;fetcher?:typeof fetch;provider?:(s:ScheduledSource)=>DraftPort;now?:()=>string;runtimePinFile?:string;verifyActivation?:(policy:DraftSyncPolicy)=>Promise<void>;execute?:DraftExecutorOptions['execute']}
export async function runDraftSyncRound(root:string,db:D1DatabaseLike,configFile:string,deps:Dependencies={}){
 const config=async()=>JSON.parse(await fs.readFile(configFile,'utf8')) as {draftSync?:Policy};
 const initial=(await config()).draftSync;if(initial?.enabled!==true)return [];
 const now=deps.now??(()=>new Date().toISOString());assertDraftPolicy(initial,now());const verifyActivation=deps.verifyActivation??((policy:DraftSyncPolicy)=>validateDraftActivation(policy,deps.runtimePinFile,now()));await verifyActivation(initial);
 if(!Number.isSafeInteger(initial.maxArticles)||initial.maxArticles<1||initial.maxArticles>20||!Number.isSafeInteger(initial.timeoutMs)||initial.timeoutMs<100||initial.timeoutMs>600000)throw Error('SUBSTACK_DRAFT_BUDGET_INVALID');
 const budget=initial.maxRoundMs??60000;if(!Number.isSafeInteger(budget)||budget<initial.timeoutMs||budget>840000)throw Error('SUBSTACK_DRAFT_BUDGET_INVALID');
 const deadline=Date.now()+budget,repo=new ScheduleRepository(db),records=await repo.list();
 const files=await listLocalPostFiles(path.join(root,'src/content/posts'));
 const slugs=new Set(records.map(s=>s.slug));
 for(const f of files){const status=matter(await fs.readFile(f.path,'utf8')).data.status;if(['ready','published'].includes(status))slugs.add(f.slug);}
 // A vanished original plus a new path/slug can be a rename: never infer a new identity.
 const missingTracked=records.some(s=>!files.some(f=>f.slug===s.slug));
 const ordered=[...slugs].sort((a,b)=>{const time=(slug:string)=>records.find(r=>r.slug===slug)?.draftSync?.checkedAt??'';return time(a).localeCompare(time(b))||a.localeCompare(b);});
 const results:{slug:string;sourceRevision?:string;target:string;operation:string;status:string;code?:string}[]=[];
 for(const slug of ordered.slice(0,initial.maxArticles)){
  if(Date.now()>=deadline)break;
  let exchange:FileAttendedExchange<DraftExchangeRequest>|undefined;
  const readSource=async()=>{
   const remaining=deadline-Date.now();if(remaining<=0)throw Error('SUBSTACK_DRAFT_BUDGET_EXHAUSTED');
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   const expired=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{const error=Error('SUBSTACK_DRAFT_BUDGET_EXHAUSTED');controller.abort(error);reject(error);},remaining);});
   const fetchSource=(async(input,options)=>{
    controller.signal.throwIfAborted();
    return (deps.fetcher??fetch)(input,{...options,signal:AbortSignal.any([controller.signal,...(options?.signal?[options.signal]:[])])});
   }) as typeof fetch;
   const work=async()=>{
    const source=await (deps.readSource??buildDraftSource)(root,slug,fetchSource);controller.signal.throwIfAborted();
    if(deps.assertMain)await deps.assertMain(root,source.sourceCommit,controller.signal);
    else {
     const result=await promisify(execFile)('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8',timeout:Math.max(1,Math.min(30000,deadline-Date.now())),signal:controller.signal,killSignal:'SIGKILL'});
     if(result.stdout.trim().split(/\s+/)[0]!==source.sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');
    }
    controller.signal.throwIfAborted();return source;
   };
   try{return await Promise.race([work(),expired]);}
   catch(e){if(controller.signal.aborted||Date.now()>=deadline)throw Error('SUBSTACK_DRAFT_BUDGET_EXHAUSTED');if(e instanceof Error&&['SUBSTACK_SOURCE_NOT_FINALIZED','SUBSTACK_SOURCE_SERIES_INCOMPLETE'].includes(e.message))return undefined;throw e;}
   finally{clearTimeout(timer);controller.abort();}
  };
  try{
   if(missingTracked&&!records.some(r=>r.slug===slug))throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
   const source=await readSource();
   const authority=async()=>{if(Date.now()>=deadline)throw Error('SUBSTACK_DRAFT_BUDGET_EXHAUSTED');const policy=(await config()).draftSync;assertDraftPolicy(policy,now());await verifyActivation(policy!);if(!isDeepStrictEqual(policy,initial))throw Error('SUBSTACK_DRAFT_SCOPE_CHANGED');};
   const provider=source?(deps.provider?.(source)??new ComputerUseDraftPort(source,repo,async r=>{
    await authority();
    exchange??=await FileAttendedExchange.create<DraftExchangeRequest>(path.join(path.dirname(root),'draft-sessions'),root,Math.min(initial.timeoutMs,Math.max(1,deadline-Date.now())),250,async file=>{
     const check=async()=>{await authority();const latest=await readSource();if(!latest||JSON.stringify(latest)!==JSON.stringify(source))throw Error('SUBSTACK_SOURCE_CHANGED');const state=await repo.bySlug(slug);if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');return state;};
     await replyWithDraftExecutor(file,{policy:initial,source,timeoutMs:Math.min(initial.timeoutMs,Math.max(1,deadline-Date.now())),check,execute:deps.execute});
    });
    return exchange.exchange(r);
   },authority)):{find:async()=>{throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');},read:async()=>{throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');},create:async()=>{throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');},update:async()=>{throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');}};
   const state=await new DraftSyncCoordinator(repo,new D1DistributionRuntime(db),provider,{readPolicy:async()=>(await config()).draftSync,readSource,now}).sync(slug);
   const ok=['verified','excluded'].includes(state.draftSync?.status??'');
   results.push({slug,sourceRevision:source?.sourceRevision,target:'substack',operation:'sync-draft',status:ok?'observed':state.draftSync?.status==='inconclusive'?'blocked':'manual_required',code:ok?undefined:state.intent?'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED':state.draftSync?.code??'SUBSTACK_DRAFT_PREPARATION_REQUIRED'});
   if(exchange&&!state.intent)await fs.rm(exchange.directory,{recursive:true});
  }catch(e){
   const code=e instanceof Error&&/^SUBSTACK_[A-Z_]+$/.test(e.message)?e.message:'SUBSTACK_DRAFT_READ_INCONCLUSIVE';
   const file=files.find(f=>f.slug===slug);
   // Record failed eligibility as metadata only, so one broken new original cannot monopolize every round.
   if(file&&(!missingTracked||code==='SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED')&&!await repo.bySlug(slug))await repo.save({policyVersion:SCHEDULE_POLICY,scheduleId:'substack:'+slug,slug,sourcePath:path.relative(root,file.path),version:0,observedState:'draft_prepared',delivery:'not_armed',...(code==='SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED'?{lastErrorCode:code}:{}),draftSync:{status:code==='SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED'?'foreground-required':'inconclusive',code,checkedAt:now(),transport:'computer-use'},updatedAt:now()},0);
   results.push({slug,target:'substack',operation:'sync-draft',status:'blocked',code});
  }
 }
 if(results.length<ordered.length)results.push({slug:'',target:'substack',operation:'sync-draft',status:'blocked',code:'SUBSTACK_DRAFT_INVENTORY_INCOMPLETE'});
 return results;
}
