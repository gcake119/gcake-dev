import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventoryDistribution,openFixedSnapshot,assertGeneralPolicy,planTarget} from './distribution-inventory';
import {prepareScheduledDistribution} from './schedule-distribution';
import {assertPagesPublication} from './pages-publication';
import {CloudflareD1Database} from './d1-api';
import {D1PublicationRepository,type PublicationTargetState} from '../../apps/admin-worker/src/publication-operations';
import {boundedDistributionError,type WriteCheckpoint} from '../../apps/admin-worker/src/distribution-runtime';
import type {DistributionConfig} from './run-distribution';
import type {DistributionTarget} from './prepare-distribution';
export type TargetSnapshot={state?:PublicationTargetState;checkpoint?:WriteCheckpoint;locked:boolean};
export async function prepareAllDistribution(root:string,config:DistributionConfig,out:string,readTarget:(slug:string,target:DistributionTarget)=>Promise<TargetSnapshot>,prove=assertPagesPublication){
 assertGeneralPolicy(config);
 const sourceCommit=await openFixedSnapshot(root),inventory=await inventoryDistribution(root,sourceCommit,prove);
 const articles=[];
 for(const entry of inventory.entries.filter(e=>e.status==='eligible')){
  const targets:Partial<Record<DistributionTarget,ReturnType<typeof planTarget>>>= {},selection:Partial<Record<DistributionTarget,('prepare'|'publish'|'verify'|'retry')[]>>={};
  for(const target of config.unattended!.targets){
   try{const snapshot=await readTarget(entry.slug,target);targets[target]=planTarget(entry.sourceRevision!,snapshot.state,snapshot.checkpoint,snapshot.locked);}
   catch(error){targets[target]={operations:[],reason:boundedDistributionError(error)};}
   if(targets[target]!.operations.length)selection[target]=targets[target]!.operations;
  }
  const selected=Object.keys(selection) as DistributionTarget[];
  const finalizeTargets:('substack')[]=targets.substack?.recovery==='finalize'?['substack']:[];
  let run:Awaited<ReturnType<typeof prepareScheduledDistribution>>|undefined,reason:string|undefined;
  if(selected.length){
   try{run=await prepareScheduledDistribution(entry.slug,root,{...config,unattended:{...config.unattended!,targets:selected}},out,prove,selection,finalizeTargets);}
   catch(error){reason=boundedDistributionError(error);}
  }
  articles.push({slug:entry.slug,sourceRevision:entry.sourceRevision,targets,run,reason});
 }
 return {version:1,sourceCommit,externalWriteEnabled:false,inventory,articles};
}
async function main(){
 const [sourceRoot,configFile,out,...extra]=process.argv.slice(2);if(!sourceRoot||!configFile||!out||extra.length)throw Error('DISTRIBUTION_USAGE: distribution:all-plan fixed-source-root private-config private-output');
 const config=JSON.parse(await fs.readFile(configFile,'utf8')) as DistributionConfig;assertGeneralPolicy(config);
 const database=new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??'');
 const repository=new D1PublicationRepository(database);
 const readTarget=async(slug:string,target:DistributionTarget):Promise<TargetSnapshot>=>({state:(await repository.listStates(slug)).find(s=>s.target===target),checkpoint:await repository.runtime.checkpoint(slug,target),locked:!!await database.prepare('SELECT owner FROM publication_locks WHERE post_slug = ? AND target = ?').bind(slug,target).first()});
 const result=await prepareAllDistribution(path.resolve(sourceRoot),config,path.resolve(out),readTarget);
 await fs.mkdir(out,{recursive:true,mode:0o700});const file=path.join(out,'all-plan.json');await fs.writeFile(file,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({output:file,sourceCommit:result.sourceCommit,eligible:result.articles.length,externalWriteEnabled:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
