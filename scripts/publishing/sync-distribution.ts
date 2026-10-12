import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {snapshotDistribution} from './snapshot-distribution';
import {prepareAllDistribution} from './plan-all-distribution';
import {assertGeneralPolicy} from './distribution-inventory';
import {main as distribution,type DistributionConfig} from './run-distribution';
import {CloudflareD1Database} from './d1-api';
import {D1PublicationRepository} from '../../apps/admin-worker/src/publication-operations';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
type Plan=Awaited<ReturnType<typeof prepareAllDistribution>>;
type Run=NonNullable<Plan['articles'][number]['run']>;
type Command=Run['commands'][number]|Run['recoveries'][number];
type Audit={locks:unknown[];checkpoints:unknown[];intents:unknown[]};
export interface SyncDependencies {
 validate(configFile:string,acceptanceFile:string):Promise<void>;
 audit():Promise<Audit>;
 snapshot(destination:string):Promise<{sourceRoot:string;sourceCommit:string}>;
 plan(source:string,config:string,output:string):Promise<Plan>;
 execute(slug:string,command:Command,run:Run):Promise<{status:string;lastErrorCode?:string}>;
}
export interface SyncOptions {runtime:string;pin:string;configFile:string;acceptanceFile:string;output:string;lock:string;execute:boolean}
const save=async(file:string,data:unknown)=>fs.writeFile(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
async function outside(root:string,directory:string){
 const rel=path.relative(await fs.realpath(root),await fs.realpath(directory));
 if(!rel||rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel))throw Error('DISTRIBUTION_ROUND_OUTSIDE_RUNTIME');
}
export async function verifyRuntimePin(runtime:string,file:string,required:string[]=[]){
 const pin=JSON.parse(await fs.readFile(file,'utf8'));
 if(!pin||typeof pin!=='object'||Array.isArray(pin)||!Object.keys(pin).length)throw Error('DISTRIBUTION_PIN_INVALID');
 if(required.some(name=>!(name in pin)))throw Error('DISTRIBUTION_PIN_COVERAGE_MISSING');
 for(const [name,digest] of Object.entries(pin)){
  if(path.isAbsolute(name)||name.split(/[\\/]/).includes('..')||typeof digest!=='string'||!(/^[a-f0-9]{64}$/).test(digest))throw Error('DISTRIBUTION_PIN_INVALID');
  let actual:string;try{actual=createHash('sha256').update(await fs.readFile(path.join(runtime,name))).digest('hex');}catch{throw Error('DISTRIBUTION_PIN_MISMATCH');}
  if(actual!==digest)throw Error('DISTRIBUTION_PIN_MISMATCH');
 }
}
async function unanswered(directory:string):Promise<boolean>{
 for(const item of await fs.readdir(directory,{withFileTypes:true}).catch(()=>[])){
  if(item.name==='source'||item.name==='.git')continue;
  const file=path.join(directory,item.name);
  if(item.isDirectory()&&await unanswered(file))return true;
  if(item.isFile()&&item.name==='request.json'){try{await fs.access(path.join(directory,'reply.json'));}catch{return true;}}
 }
 return false;
}
export async function runSyncRound(options:SyncOptions,deps:SyncDependencies){
 await verifyRuntimePin(options.runtime,options.pin);await deps.validate(options.configFile,options.acceptanceFile);
 await fs.mkdir(path.dirname(options.lock),{recursive:true,mode:0o700});await outside(options.runtime,path.dirname(options.lock));
 const owner=randomUUID();try{await fs.mkdir(options.lock,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw Error('DISTRIBUTION_ROUND_LOCKED');throw error;}
 let directory='';const results:{slug:string;sourceRevision?:string;target:string;operation:string;status:string;code?:string}[]=[];
 let status:'planned'|'completed'|'attention'=options.execute?'completed':'planned';let source:'absent'|'removed'|'retained'='absent';
 try{
  await save(path.join(options.lock,'owner.json'),{owner,pid:process.pid,createdAt:new Date().toISOString()});
  await fs.mkdir(options.output,{recursive:true,mode:0o700});await outside(options.runtime,options.output);
  directory=await fs.mkdtemp(path.join(options.output,'round-'));await fs.chmod(directory,0o700);await save(path.join(directory,'ownership.json'),{owner,automation:'pages-substack',runtime:options.runtime});
  const preflight=await deps.audit();await save(path.join(directory,'preflight-d1.json'),preflight);if(preflight.locks.length)throw Error('DISTRIBUTION_ACTIVE_WRITER');
  const snapshot=await deps.snapshot(path.join(directory,'source'));source='retained';await save(path.join(directory,'snapshot.json'),snapshot);
  const plan=await deps.plan(snapshot.sourceRoot,options.configFile,path.join(directory,'plans'));await save(path.join(directory,'all-plan.json'),plan);
  for(const article of plan.articles){
   if(article.reason){status='attention';results.push({slug:article.slug,sourceRevision:article.sourceRevision,target:'all',operation:'plan',status:'blocked',code:article.reason});continue;}
   for(const [target,t] of Object.entries(article.targets??{}))if(t?.reason){status='attention';results.push({slug:article.slug,sourceRevision:article.sourceRevision,target,operation:'plan',status:'blocked',code:t.reason});}
   if(!options.execute||!article.run)continue;
   const stopped=new Set<string>();
   for(const command of article.run.commands){
    if(stopped.has(command.target))continue;
    try{
     const result=await deps.execute(article.slug,command,article.run);results.push({slug:article.slug,sourceRevision:article.sourceRevision,target:command.target,operation:command.operation,status:result.status,code:result.lastErrorCode});
     if(!(command.operation==='prepare'?['verified','prepare_ready']:['verified']).includes(result.status)){status='attention';stopped.add(command.target);}
    }catch(error){status='attention';stopped.add(command.target);results.push({slug:article.slug,sourceRevision:article.sourceRevision,target:command.target,operation:command.operation,status:'blocked',code:boundedDistributionError(error)});}
   }
   // Only an explicitly planned, preexisting metadata recovery can finalize. Never infer recovery from a new failure.
   for(const recovery of article.run.recoveries){
    const latest=results.findLast(r=>r.slug===article.slug&&r.target===recovery.target);
    if(latest?.status==='verified')continue;
    try{const result=await deps.execute(article.slug,recovery,article.run);results.push({slug:article.slug,sourceRevision:article.sourceRevision,target:recovery.target,operation:recovery.operation,status:result.status,code:result.lastErrorCode});if(result.status!=='verified')status='attention';}
    catch(error){status='attention';results.push({slug:article.slug,sourceRevision:article.sourceRevision,target:recovery.target,operation:recovery.operation,status:'blocked',code:boundedDistributionError(error)});}
   }
  }
  const finalAudit=await deps.audit(); await save(path.join(directory,'final-d1.json'),finalAudit);
  if(finalAudit.locks.length||finalAudit.checkpoints.length||finalAudit.intents.length){status='attention';results.push({slug:'',target:'all',operation:'audit',status:'blocked',code:'DISTRIBUTION_UNSETTLED_INTENT'});}
 }catch(error){status='attention';results.push({slug:'',target:'all',operation:'round',status:'blocked',code:boundedDistributionError(error)});}
 finally{
  if(directory){
   if(await unanswered(directory)){source='retained';status='attention';}
   else {try{await fs.rm(path.join(directory,'source'),{recursive:true,force:true});source='removed';}catch{status='attention';source='retained';}}
   const fingerprint=createHash('sha256').update(JSON.stringify({status,results,source})).digest('hex');
   const previousFile=options.lock+'.last-result.json';
   let previous:{fingerprint:string;status:string}|undefined;
   try{previous=JSON.parse(await fs.readFile(previousFile,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw Error('DISTRIBUTION_ROUND_HISTORY_INVALID');}
   const meaningful=status==='attention'||results.some(r=>['prepare','publish','finalize'].includes(r.operation))||previous?.status==='attention';
   const notification=meaningful&&previous?.fingerprint!==fingerprint?'meaningful':'quiet';
   await save(path.join(directory,'result.json'),{directory,status,results,cleanup:{source},notification});
   const temporary=previousFile+'.'+owner;await save(temporary,{fingerprint,status});await fs.rename(temporary,previousFile);
  }
  const saved=JSON.parse(await fs.readFile(path.join(options.lock,'owner.json'),'utf8'));if(saved.owner!==owner)throw Error('DISTRIBUTION_ROUND_OWNER_MISMATCH');await fs.rm(options.lock,{recursive:true});
 }
 if(!directory)throw Error('DISTRIBUTION_ROUND_SETUP_FAILED');
 return JSON.parse(await fs.readFile(path.join(directory,'result.json'),'utf8')) as {directory:string;status:string;results:typeof results;cleanup:{source:string};notification:string};
}
export function productionDependencies(runtime:string):SyncDependencies{
 const db=new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??'');const repo=new D1PublicationRepository(db);
 const query=async(sql:string)=>(await db.prepare(sql).all()).results;
 return {
  validate:async(configFile,acceptanceFile)=>{const config=JSON.parse(await fs.readFile(configFile,'utf8'));assertGeneralPolicy(config);const accepted=JSON.parse(await fs.readFile(acceptanceFile,'utf8'));if(accepted.status!=='passed'||!Array.isArray(accepted.providerStates)||!['substack'].every(t=>accepted.providerStates.some((s:{target:string;status:string})=>s.target===t&&s.status==='verified')))throw Error('DISTRIBUTION_LIVE_ACCEPTANCE_REQUIRED');},
  audit:async()=>({locks:await query('SELECT post_slug,target,owner,acquired_at FROM publication_locks'),checkpoints:await query('SELECT post_slug,target,source_revision,operation,attempt_id FROM publication_checkpoints'),intents:await query("SELECT id,target,status FROM publication_attempts WHERE status='intent'")}),
  snapshot:destination=>snapshotDistribution(destination,runtime),
  plan:async(source,configFile,out)=>prepareAllDistribution(source,JSON.parse(await fs.readFile(configFile,'utf8')) as DistributionConfig,out,async(slug,target)=>({state:(await repo.listStates(slug)).find(s=>s.target===target),checkpoint:await repo.runtime.checkpoint(slug,target),locked:!!await db.prepare('SELECT owner FROM publication_locks WHERE post_slug = ? AND target = ?').bind(slug,target).first()})),
  execute:async(slug,command,run)=>{await distribution([command.operation,slug,command.target,'--config',run.configFile,'--receipt',command.receiptFile,'--approval',command.approvalFile,'--mode','controlled-trial','--source-root',run.sourceRoot],undefined,runtime);const state=(await repo.listStates(slug)).find(s=>s.target===command.target);if(!state)throw Error('DISTRIBUTION_RESULT_MISSING');return state;},
 };
}
export async function main(args=process.argv.slice(2)){
 const values=new Map<string,string>();let execute=false;
 for(let i=0;i<args.length;i++){if(args[i]==='--execute'){if(execute)throw Error('DISTRIBUTION_ARGUMENT_INVALID');execute=true;continue;}if(!['--config','--pin','--acceptance','--out','--lock'].includes(args[i])||values.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('DISTRIBUTION_ARGUMENT_INVALID');values.set(args[i],args[++i]);}
 for(const key of ['--config','--pin','--acceptance','--out','--lock'])if(!values.has(key))throw Error('DISTRIBUTION_SYNC_USAGE');
 const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 await verifyRuntimePin(runtime,values.get('--pin')!,['scripts/publishing/sync-distribution.ts','scripts/publishing/distribution-handoff.ts']);
 const result=await runSyncRound({runtime,pin:values.get('--pin')!,configFile:values.get('--config')!,acceptanceFile:values.get('--acceptance')!,output:values.get('--out')!,lock:values.get('--lock')!,execute},productionDependencies(runtime));console.log(JSON.stringify(result));if(result.status==='attention')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
