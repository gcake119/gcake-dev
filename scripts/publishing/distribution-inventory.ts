import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { listLocalPostFiles } from '../../src/lib/content/local-posts';
import type { PublicationTargetState } from '../../apps/admin-worker/src/publication-operations';
import type { WriteCheckpoint } from '../../apps/admin-worker/src/distribution-runtime';
import { boundedDistributionError } from '../../apps/admin-worker/src/distribution-runtime';
import { buildDistributionBundle } from './prepare-distribution';
import { assertPagesPublication } from './pages-publication';
import type { DistributionConfig } from './run-distribution';
const exec = promisify(execFile);
export interface InventoryEntry {
 slug:string; sourcePath:string; kind:'markdown'|'mdx'|'external'; title?:string;
 status:'eligible'|'blocked'; reason?:string; sourceRevision?:string;
 canonicalUrl?:string; publishedAt?:string; pages?:Awaited<ReturnType<typeof assertPagesPublication>>;
}
export interface InventoryReport {
 version:1; repository:'gcake119/gcake-dev'; branch:'main'; sourceCommit:string;
 generatedAt:string; externalWriteEnabled:false; entries:InventoryEntry[];
}
/** The production seam validates a clean immutable clone, never the working runtime. */
export async function openFixedSnapshot(root:string):Promise<string>{
 const git=async(...args:string[])=>(await exec('git',args,{cwd:root})).stdout.trim();
 if(await git('remote','get-url','origin')!=='https://github.com/gcake119/gcake-dev.git')throw Error('DISTRIBUTION_SOURCE_REPOSITORY_MISMATCH');
 const head=await git('rev-parse','HEAD');
 if(!/^[a-f0-9]{40}$/.test(head)||await git('rev-parse','refs/remotes/origin/main')!==head||await git('status','--porcelain','--untracked-files=all'))throw Error('DISTRIBUTION_SOURCE_NOT_FIXED_MAIN');
 return head;
}
export function assertGeneralPolicy(config:DistributionConfig):void{
 const p=config.unattended;
 if(p?.enabled!==true||p.scope!=='all-formal-markdown'||p.repository!=='gcake119/gcake-dev'||p.branch!=='main'
  ||p.policy!=='pages-first-no-newsletter'||!Array.isArray(p.targets)||!p.targets.length||new Set(p.targets).size!==p.targets.length||p.targets.some(t=>!['substack'].includes(t))
  ||config.substack.ui.origin!=='https://gcakedev.substack.com'||config.substack.ui.publicationPolicy!=='full-mirror')throw Error('UNATTENDED_POLICY_REQUIRED');
}
export function planTarget(revision:string,state?:PublicationTargetState,checkpoint?:WriteCheckpoint,locked=false,background=false):{operations:('prepare'|'publish'|'verify'|'retry')[];reason?:string;recovery?:'finalize'}{
 const blocked=(reason:string)=>({operations:[],reason});
 if(locked)return blocked('DISTRIBUTION_LOCKED');
 if(state?.status==='manual_required')return blocked('DISTRIBUTION_MANUAL_REQUIRED');
 if(background){
  let publicIdentity=false;
  try{const url=new URL(state?.remoteUrl??'');publicIdentity=url.origin==='https://gcakedev.substack.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/p\/[a-z0-9-]+$/.test(url.pathname)&&!!state?.remoteId;}catch{}
  return !checkpoint&&publicIdentity&&state?.sourceRevision===revision&&['verified','published'].includes(state.status)?{operations:['verify']}:blocked('SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
 }
 if(checkpoint){
  if(checkpoint.sourceRevision!==revision)return blocked('DISTRIBUTION_INTENT_REVISION_MISMATCH');
  return {operations:['retry'],...(checkpoint.target==='substack'&&checkpoint.operation==='metadata'&&state?.remoteId&&state.remoteUrl?{recovery:'finalize' as const}:{})};
 }
 if(state?.status==='verified'&&(!state.remoteId||!state.remoteUrl))return blocked('DISTRIBUTION_REMOTE_STATE_MISSING');
 if(state?.status==='uncertain')return blocked('DISTRIBUTION_RECONCILIATION_REQUIRED');
 if(state?.status==='verified')return {operations:state.sourceRevision===revision?['verify']:['prepare']};
 if(state?.status==='published')return {operations:state.sourceRevision===revision?['verify']:[] ,...(state.sourceRevision!==revision?{reason:'DISTRIBUTION_PRIOR_VERSION_NOT_VERIFIED'}:{})};
 if(state?.status==='prepare_ready'&&state.sourceRevision===revision)return {operations:['publish']};
 return {operations:['prepare','publish']};
}
export async function inventoryDistribution(root:string,sourceCommit:string,prove=assertPagesPublication,now=()=>new Date().toISOString()):Promise<InventoryReport>{
 if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('DISTRIBUTION_SOURCE_COMMIT_REQUIRED');
 const entries:InventoryEntry[]=[],postsDir=path.join(root,'src/content/posts'),files=await listLocalPostFiles(postsDir);
 const counts=new Map<string,number>();for(const file of files)counts.set(file.slug,(counts.get(file.slug)??0)+1);
 for(const file of files){
  const entry:InventoryEntry={slug:file.slug,sourcePath:path.relative(root,file.path),kind:/\.mdx$/i.test(file.path)?'mdx':'markdown',status:'blocked'};
  entries.push(entry);
  try{
   if(counts.get(file.slug)!==1)throw Error('DISTRIBUTION_DUPLICATE_SLUG');
   const raw=await fs.readFile(file.path,'utf8'),parsed=matter(raw);entry.title=typeof parsed.data.title==='string'?parsed.data.title:undefined;
   if(entry.kind==='mdx')throw Error('DISTRIBUTION_MDX_REQUIRES_FULL_SOURCE_REVIEW');
   if(parsed.data.distribution?.mode==='interactive-summary')throw Error('DISTRIBUTION_SUMMARY_NOT_FULL_MIRROR');
   const bundle=await buildDistributionBundle(file.slug,postsDir,{},now);
   entry.sourceRevision=bundle.sourceRevision;entry.canonicalUrl=bundle.canonicalUrl;entry.publishedAt=bundle.publishedAt;
   entry.pages=await prove(bundle);
   if(entry.pages.sourceRevision!==bundle.sourceRevision)throw Error('PAGES_PUBLIC_SOURCE_INVALID');
   entry.status='eligible';
  }catch(error){
   entry.reason=boundedDistributionError(error);
   if(entry.reason==='DISTRIBUTION_PROVIDER_FAILED')entry.reason=error instanceof Error&&error.message.includes('MDX/site-only')?'DISTRIBUTION_NONPORTABLE_BODY':'DISTRIBUTION_SOURCE_INVALID';
  }
 }
 const externalDir=path.join(root,'src/data/external');
 const externalFiles=await fs.readdir(externalDir).catch((error:NodeJS.ErrnoException)=>{if(error.code==='ENOENT')return [];throw error;});
 for(const file of externalFiles.filter(f=>f.endsWith('.generated.json')).sort()){
  const sourcePath=path.join('src/data/external',file);
  try{
   const data=JSON.parse(await fs.readFile(path.join(root,sourcePath),'utf8'));
   if(!Array.isArray(data.posts))throw Error('DISTRIBUTION_EXTERNAL_INVENTORY_INVALID');
   for(const post of data.posts)entries.push({slug:typeof post.slug==='string'?post.slug:'unknown',sourcePath,kind:'external',title:post.title,status:'blocked',reason:'DISTRIBUTION_EXTERNAL_SOURCE_NOT_FORMAL'});
  }catch{entries.push({slug:file,sourcePath,kind:'external',status:'blocked',reason:'DISTRIBUTION_EXTERNAL_INVENTORY_INVALID'});}
 }
 entries.sort((a,b)=>a.slug.localeCompare(b.slug)||a.sourcePath.localeCompare(b.sourcePath));
 return {version:1,repository:'gcake119/gcake-dev',branch:'main',sourceCommit,generatedAt:now(),externalWriteEnabled:false,entries};
}
async function main(){
 const [sourceRoot,out,...extra]=process.argv.slice(2);if(!sourceRoot||!out||extra.length)throw Error('DISTRIBUTION_USAGE: distribution:inventory fixed-source-root output-json');
 const root=path.resolve(sourceRoot),commit=await openFixedSnapshot(root),report=await inventoryDistribution(root,commit);
 await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true,mode:0o700});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({sourceCommit:commit,output:path.resolve(out),eligible:report.entries.filter(e=>e.status==='eligible').length,blocked:report.entries.filter(e=>e.status==='blocked').length,externalWriteEnabled:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
