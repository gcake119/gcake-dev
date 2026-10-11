import fs from 'node:fs/promises';
import {mkdirSync,writeFileSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import matter from 'gray-matter';
import YAML from 'yaml';
import {listLocalPostFiles} from '../../src/lib/content/local-posts';
import {postFrontmatterSchema} from '../../src/lib/publishing/publication-schema';
import {emptyQueue,queueSchema,ingestQueue,reserveRelease,confirmRelease,type QueuePost,type QueueManifest,type QueueState} from '../../src/lib/publishing/editorial-state';
export const JOURNAL='src/data/editorial-queue.json';
const digest=(raw:string)=>createHash('sha256').update(raw).digest('hex');
type Post=QueuePost & {file:string;raw:string};
type Manifest=QueueManifest & {file:string;raw:string};
export interface Snapshot {posts:Post[];manifests:Manifest[];journalRaw?:string}
function readinessHistory(root:string,file:string,eligible:(raw:string)=>boolean):string|undefined {
 try{
  const log=git(root,'log','--first-parent','--format=%H %cI','--',file);
  let since:string|undefined;
  for(const line of log.split('\n').filter(Boolean)){
   const [revision,time]=line.split(' ');
   let raw:string;try{raw=git(root,'show',`${revision}:${file}`);}catch{break;}
   if(!eligible(raw))break;
   since=time;
  }
  return since;
 }catch{return undefined;} // Uncommitted fixtures use durable observation time.
}
export async function readSnapshot(root:string):Promise<Snapshot>{
 const posts:Post[]=[];const manifests:Manifest[]=[];
 for(const file of await listLocalPostFiles(path.join(root,'src/content/posts'))){
  const raw=await fs.readFile(file.path,'utf8');const data=postFrontmatterSchema.parse(matter(raw).data);
  const relative=path.relative(root,file.path);
  const eligibleSince=readinessHistory(root,relative,source=>['ready','published'].includes(matter(source).data.status));
  posts.push({slug:file.slug,status:data.status,revision:digest(raw),publishedAt:data.publishedAt?.toISOString(),eligibleSince,raw,file:relative});
 }
 for(const name of (await fs.readdir(path.join(root,'src/content/series'))).filter(n=>/\.ya?ml$/.test(n)).sort()){
  const file='src/content/series/'+name;if(!(await fs.lstat(path.join(root,file))).isFile())throw new Error('Unsafe manifest');
  const raw=await fs.readFile(path.join(root,file),'utf8');const m=YAML.parse(raw);
  if(!m || !Array.isArray(m.sections))throw new Error('Invalid manifest');
  const refs=m.sections.flatMap((s:any)=>s.posts??[]);
  const eligibleSince=readinessHistory(root,file,source=>{
   const historic=YAML.parse(source);const planned=historic?.sections?.flatMap((s:any)=>s.posts??[]);
   return Array.isArray(planned)&&JSON.stringify(planned.map((p:any)=>p.slug))===JSON.stringify(refs.map((p:any)=>p.slug))&&planned.every((p:any)=>['ready','published'].includes(p.status))&&historic.publication?.status!=='paused'&&historic.status!=='paused';
  });
  manifests.push({slug:m.slug,file,raw,eligibleSince,external:m.source?.type==='external',paused:m.publication?.status==='paused'||m.status==='paused',posts:refs});
 }
 let journalRaw:string|undefined;
 try{journalRaw=await fs.readFile(path.join(root,JOURNAL),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return {posts,manifests,journalRaw};
}
function publishPost(raw:string,releaseAt:string):string{
 const match=/^(---\r?\n)([\s\S]*?)(\r?\n---)(?=\r?\n|$)/.exec(raw);
 if(!match)throw new Error('Missing frontmatter');
 const doc=YAML.parseDocument(match[2]);doc.set('status','published');
 const date=doc.createNode(releaseAt);date.type='QUOTE_DOUBLE';doc.set('publishedAt',date);
 // Preserve the exact Markdown suffix, including whitespace, byte-for-byte.
 return match[1]+doc.toString().trimEnd()+match[3]+raw.slice(match[0].length);
}
function publishManifest(raw:string,slug:string):string{
 const doc=YAML.parseDocument(raw);const sections=doc.get('sections',true);
 if(!YAML.isSeq(sections))throw new Error('Invalid manifest');
 for(const section of sections.items){if(!YAML.isMap(section))continue;const posts=section.get('posts',true);if(!YAML.isSeq(posts))continue;for(const post of posts.items)if(YAML.isMap(post)&&post.get('slug')===slug)post.set('status','published');}
 return doc.toString();
}
export function prepareRelease(snapshot:Snapshot,state:QueueState,now:string,allowReserve:boolean){
 let next=ingestQueue(state,snapshot.posts,snapshot.manifests,now);
 if(allowReserve || next.pending)next=reserveRelease(next,snapshot.posts,snapshot.manifests,now);
 const changes=new Map<string,string>();
 if(next.pending){
  const pending=next.pending;const post=snapshot.posts.find(p=>p.slug===pending.slug);
  if(!post)throw new Error('Missing pending article');
  if(state.pending){
   if(post.revision!==pending.revision)throw new Error('Pending revision changed; operator repair required');
   if(post.status!=='published'||post.publishedAt!==new Date(pending.releaseAt).toISOString())throw new Error('Inconsistent pending article; operator repair required');
   if(pending.seriesSlug && !snapshot.manifests.find(m=>m.slug===pending.seriesSlug)?.posts.some(p=>p.slug===pending.slug&&p.status==='published'))throw new Error('Inconsistent pending manifest');
  }else{
   const published=publishPost(post.raw,pending.releaseAt);
   changes.set(post.file,published);pending.revision=digest(published);
   if(pending.seriesSlug){const manifest=snapshot.manifests.find(m=>m.slug===pending.seriesSlug)!;changes.set(manifest.file,publishManifest(manifest.raw,pending.slug));}
  }
 }
 // Finishing the last chapter clears the active-series marker on subsequent ingestion.
 if(next.activeSeries){
  const m=snapshot.manifests.find(m=>m.slug===next.activeSeries);
  if(m?.posts.every(p=>p.status==='published' && snapshot.posts.some(x=>x.slug===p.slug&&x.status==='published'&&(!x.publishedAt||Date.parse(x.publishedAt)<=Date.parse(now)))))delete next.activeSeries;
 }
 const json=JSON.stringify(queueSchema.parse(next),null,2)+'\n';
 if(json!==snapshot.journalRaw)changes.set(JOURNAL,json);
 return {state:next,changes};
}
const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function commitChanges(root:string,expectedHead:string,changes:Map<string,string>,enabled:boolean):string{
 if(!enabled)throw new Error('Production writes disabled');
 if(git(root,'rev-parse','HEAD')!==expectedHead)throw new Error('Repository conflict');
 if(git(root,'branch','--show-current')!=='main')throw new Error('Writes require main');
 if(git(root,'status','--porcelain'))throw new Error('Dirty repository conflict');
 if(!changes.size)return expectedHead;
 for(const [file] of changes){
  if(!(file===JOURNAL||/^src\/content\/(?:posts\/[^\0]+\.mdx?|series\/[^/]+\.ya?ml)$/.test(file)) || file.split('/').some(s=>s==='..'||s==='.'))throw new Error('Unsafe release path');
  let current=root;for(const part of file.split('/')){current=path.join(current,part);try{if(lstatSync(current).isSymbolicLink())throw new Error('Unsafe symlink');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 }
 for(const [file,raw] of changes){mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),raw);}
 git(root,'add','--',...changes.keys());git(root,'-c','user.name=Editorial Queue','-c','user.email=editorial-queue@users.noreply.github.com','commit','-m','chore: persist editorial release attempt [skip ci]');
 return git(root,'rev-parse','HEAD');
}
export async function verifyPublic(root:string,url:string,revision:string):Promise<void>{
 // Shared strict XML/canonical parser with Hermes; no credentials or notifications here.
 execFileSync('python3',[path.join(root,'scripts/hermes/rss_monitor.py'),'--verify-url',url,'--revision',revision],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
async function main(){
 const command=process.argv[2]??'plan';if(!['plan','prepare','confirm'].includes(command))throw new Error('Unknown command');
 const write=process.argv.includes('--write');const enabled=process.env.EDITORIAL_RELEASE_ENABLED==='true';
 if(write&&!enabled)throw new Error('Production writes disabled');
 const root=process.cwd();const head=git(root,'rev-parse','HEAD');const snapshot=await readSnapshot(root);
 const state=snapshot.journalRaw?queueSchema.parse(JSON.parse(snapshot.journalRaw)):emptyQueue();const now=new Date().toISOString();
 let changes:Map<string,string>,next:QueueState;
 if(command==='confirm'){
  if(!state.pending){console.log('No pending publication');return;}
  const retry=prepareRelease(snapshot,state,now,false); // Validate pending consistency before public confirmation.
  const url='https://gcake119.github.io/gcake-dev/posts/'+state.pending.slug+'/';
  await verifyPublic(root,url,state.pending.revision);next=confirmRelease(retry.state,state.pending.slug,now);changes=new Map([[JOURNAL,JSON.stringify(next,null,2)+'\n']]);
 }else{const prepared=prepareRelease(snapshot,state,now,command==='prepare'&&process.argv.includes('--allow-reserve'));next=prepared.state;changes=prepared.changes;}
 console.log(JSON.stringify({mode:write?'write':'dry-run',pending:next.pending??null,groups:Object.keys(next.groups),changedFiles:[...changes.keys()]},null,2));
 if(write&&changes.size){commitChanges(root,head,changes,enabled);git(root,'push','origin','HEAD:refs/heads/main');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
