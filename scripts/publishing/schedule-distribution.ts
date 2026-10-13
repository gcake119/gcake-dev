import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDistributionBundle} from './prepare-distribution';
import {assertPagesPublication} from './pages-publication';
import {main as distribution,reviewDigest,articleFromBundle,type DistributionConfig} from './run-distribution';
import {assertGeneralPolicy,openFixedSnapshot} from './distribution-inventory';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
/** Generate one-version execution files under the user's Pages-first unattended policy. */
export async function prepareScheduledDistribution(slug:string,root:string,config:DistributionConfig,out:string,prove=assertPagesPublication,selection?:Partial<Record<'substack',('prepare'|'publish'|'verify'|'retry')[]>>,finalizeTargets:('substack')[]=[]){
 const policy=config.unattended;
 let sourceCommit:string|undefined;
 if(policy?.scope==='all-formal-markdown'){assertGeneralPolicy(config);sourceCommit=await openFixedSnapshot(root);}
 if(policy?.enabled!==true||policy.scope!=='all-formal-markdown'&&policy.slug!==slug||policy.policy!=='pages-first-no-newsletter'||!policy.targets.length||new Set(policy.targets).size!==policy.targets.length||policy.targets.some(target=>!['substack'].includes(target))
  ||config.substack.ui.origin!=='https://gcakedev.substack.com'||config.substack.ui.publicationPolicy!=='full-mirror')throw Error('UNATTENDED_POLICY_REQUIRED');
 const relative=path.relative(path.resolve(root),path.resolve(out));
 if(relative!== '..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('UNATTENDED_OUTPUT_OUTSIDE_GIT');
 const bundle=await buildDistributionBundle(slug,path.join(root,'src/content/posts'));
 const pages=await prove(bundle);
 if(pages.sourceRevision!==bundle.sourceRevision)throw Error('PAGES_PUBLIC_SOURCE_INVALID');
 await fs.mkdir(out,{recursive:true,mode:0o700});
 const physicalRelative=path.relative(await fs.realpath(root),await fs.realpath(out));
 if(physicalRelative!=='..'&&!physicalRelative.startsWith('..'+path.sep)&&!path.isAbsolute(physicalRelative))throw Error('UNATTENDED_OUTPUT_OUTSIDE_GIT');
 const directory=await fs.mkdtemp(path.join(out,'run-'));await fs.chmod(directory,0o700);
 const article=articleFromBundle(bundle,config.substack.ui.displayedDatePrecision),configFile=path.join(directory,'config.json');
 const scoped={...config,trial:{...(sourceCommit?{sourceCommit}:{}),writeEnabled:!selection||finalizeTargets.includes('substack')||Object.values(selection).some(operations=>operations?.some(op=>op==='prepare'||op==='publish')),slug,sourceRevision:article.sourceRevision,substackOrigin:config.substack.ui.origin,digests:{substack:reviewDigest(article,'substack',undefined,config.substack.ui.publicIdentity)},sessionDirectory:path.join(directory,'handoffs')}};
 await fs.writeFile(configFile,JSON.stringify(scoped,null,2)+'\n',{flag:'wx',mode:0o600});
 const commands:{target:'substack';operation:'prepare'|'publish'|'verify'|'retry';receiptFile:string;approvalFile:string}[]=[];
 const recoveries:{target:'substack';operation:'finalize';receiptFile:string;approvalFile:string}[]=[];
 for(const target of policy.targets){
  const receiptFile=path.join(directory,`${target}-review.json`);
  await distribution(['dry-run',slug,target,'--mode','controlled-trial','--out',receiptFile,'--config',configFile],undefined,root);
  const receipt=JSON.parse(await fs.readFile(receiptFile,'utf8'));
  const operations=selection?.[target]??['prepare','publish'] as const;
  for(const operation of [...operations,...(target==='substack'&&(!selection||finalizeTargets.includes('substack'))?['finalize'] as const:[])]){
   const approvalFile=path.join(directory,`${target}-${operation}-approval.json`);
   await fs.writeFile(approvalFile,JSON.stringify({...receipt.approvalTemplate,operation,approved:true,approvedAt:new Date().toISOString(),authorization:'pages-first-unattended'},null,2)+'\n',{flag:'wx',mode:0o600});
   if(operation==='finalize')recoveries.push({target:'substack',operation,receiptFile,approvalFile});
   else commands.push({target,operation,receiptFile,approvalFile});
  }
 }
 const result={directory,configFile,sourceRoot:path.resolve(root),sourceRevision:article.sourceRevision,pages,commands,recoveries};
 await fs.writeFile(path.join(directory,'run.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});return result;
}
async function cli(){const [slug,configFile,out,sourceRoot,...extra]=process.argv.slice(2);if(!slug||!configFile||!out||extra.length)throw Error('USAGE: distribution:schedule-plan slug private-config private-output [source-root]');const config=JSON.parse(await fs.readFile(configFile,'utf8'));console.log(JSON.stringify(await prepareScheduledDistribution(slug,path.resolve(sourceRoot??process.cwd()),config,out)));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cli().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
