import { z } from 'zod';
import { createHash } from 'node:crypto';
import { instant, slotAtOrAfter, formatTaipei, planReleaseQueue } from './release-queue';
export interface QueuePost { slug:string; status:string; revision:string; publishedAt?:string; eligibleSince?:string }
export interface QueueManifest { slug:string; external?:boolean; paused?:boolean; eligibleSince?:string; posts:{slug:string;status:string}[] }
const timestamp=z.string().refine(v=>{try{instant(v);return true;}catch{return false;}},'Invalid timestamp');
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const slot=timestamp.refine(v=>slotAtOrAfter(instant(v))===instant(v),'Invalid slot');
export const queueSchema=z.object({
 version:z.literal(1),
 startedAt:timestamp.optional(),
 groups:z.record(z.string(),z.object({signature:z.string(),readyAt:timestamp}).strict()),
 activeSeries:slug.optional(),
 pending:z.object({slug,seriesSlug:slug.optional(),releaseAt:slot,revision:z.string().min(1)}).strict().optional(),
 completed:z.array(z.object({slug,releaseAt:slot,confirmedAt:timestamp}).strict()),
}).strict().superRefine((s,ctx)=>{
 if(new Set(s.completed.map(x=>x.releaseAt)).size!==s.completed.length || new Set(s.completed.map(x=>x.slug)).size!==s.completed.length || (s.pending && s.completed.some(x=>x.slug===s.pending!.slug || x.releaseAt===s.pending!.releaseAt))) ctx.addIssue({code:'custom',message:'Duplicate commitment'});
});
export type QueueState=z.infer<typeof queueSchema>;
export const emptyQueue=():QueueState=>({version:1,groups:{},completed:[]});
interface Group {key:string; seriesSlug?:string; slugs:string[]; signature:string; started:boolean}
const signature=(slugs:string[])=>createHash('sha256').update(JSON.stringify(slugs)).digest('hex');
function eligibleGroups(posts:QueuePost[],manifests:QueueManifest[],now:string):Group[] {
 const bySlug=new Map(posts.map(p=>[p.slug,p]));
 if(bySlug.size!==posts.length)throw new Error('Duplicate article');
 const memberships=new Set<string>(), seriesNames=new Set<string>(), result:Group[]=[];
 for(const m of manifests){
  slug.parse(m.slug);
  if(seriesNames.has(m.slug))throw new Error('Duplicate series');seriesNames.add(m.slug);
  for(const p of m.posts){slug.parse(p.slug);if(memberships.has(p.slug))throw new Error('Ambiguous manifest membership');memberships.add(p.slug);}
  if(m.external || m.paused || !m.posts.length)continue;
  let readySeen=false, valid=true,started=false;const pending:string[]=[];
  for(const ref of m.posts){
   const p=bySlug.get(ref.slug);
   if(!p || !['ready','published'].includes(ref.status) || p.status!==ref.status){valid=false;break;}
   if(p.status==='ready'){readySeen=true;pending.push(p.slug);}
   else {started=true;if(readySeen || (p.publishedAt && instant(p.publishedAt)>instant(now))){valid=false;break;}}
  }
  if(valid && pending.length)result.push({key:'series:'+m.slug,seriesSlug:m.slug,slugs:pending,signature:signature(m.posts.map(p=>p.slug)),started});
 }
 for(const p of posts){slug.parse(p.slug);if(p.status==='ready'&&!memberships.has(p.slug))result.push({key:'post:'+p.slug,slugs:[p.slug],signature:p.slug,started:false});}
 return result;
}
export function ingestQueue(state:QueueState,posts:QueuePost[],manifests:QueueManifest[],now:string):QueueState {
 queueSchema.parse(state);instant(now);
 const groups:QueueState['groups']={};
 const eligible=eligibleGroups(posts,manifests,now);
 for(const g of eligible){
  const old=state.groups[g.key];
  const evidence=[...g.slugs.map(s=>posts.find(p=>p.slug===s)?.eligibleSince),manifests.find(m=>m.slug===g.seriesSlug)?.eligibleSince].filter((s):s is string=>!!s);
  const evidenceAt=evidence.length?Math.max(...evidence.map(instant)):undefined;
  // A draft/pause cycle between polls is visible in Git history even if membership is unchanged.
  const sameMembership=old?.signature===g.signature;
  const renewed=sameMembership && evidenceAt!==undefined && evidenceAt>instant(old.readyAt);
  const readyAt=renewed?new Date(evidenceAt).toISOString():old?now:evidenceAt!==undefined?new Date(evidenceAt).toISOString():now;
  groups[g.key]=sameMembership&&!renewed?old:{signature:g.signature,readyAt};
 }
 const started=eligible.filter(g=>g.started);
 // Multiple manually-started groups need an explicit choice; never silently reorder them.
 if(!state.activeSeries && started.length>1)throw new Error('Multiple active series require operator reconciliation');
 return {...state,startedAt:state.startedAt??now,groups, ...(state.activeSeries?{}:started[0]?{activeSeries:started[0].seriesSlug}:{})};
}
export function latestSlot(now:string):string {
 const ms=instant(now);let day=Math.floor((ms+8*3600000)/86400000);
 for(;;day--){const candidate=day*86400000-3600000;const wd=new Date(day*86400000).getUTCDay();if((wd===1||wd===4)&&candidate<=ms)return formatTaipei(candidate);}
}
export function reserveRelease(state:QueueState,posts:QueuePost[],manifests:QueueManifest[],now:string):QueueState {
 queueSchema.parse(state);instant(now);
 if(state.pending){if(!posts.some(p=>p.slug===state.pending!.slug && ['ready','published'].includes(p.status)))throw new Error('Missing or invalid pending article');return state;}
 const releaseAt=latestSlot(now);
 if(!state.startedAt || instant(state.startedAt)>instant(releaseAt))return state;
 if(state.completed.some(x=>x.releaseAt===releaseAt) || posts.some(p=>p.status==='published'&&p.publishedAt&&latestSlot(p.publishedAt)===releaseAt && instant(p.publishedAt)<=instant(now)))return state;
 const groups=eligibleGroups(posts,manifests,now);
 const activeManifest=manifests.find(m=>m.slug===state.activeSeries);
 if(state.activeSeries&&!activeManifest)throw new Error('Deleted active series; operator repair required');
 const active=activeManifest?.posts.every(p=>p.status==='published' && posts.some(x=>x.slug===p.slug && x.status==='published' && (!x.publishedAt || instant(x.publishedAt)<=instant(now))))?undefined:state.activeSeries;
 const articles=groups.filter(g=>!g.seriesSlug || !active || g.seriesSlug===active).flatMap(g=>{
  const stored=state.groups[g.key];if(!stored || stored.signature!==g.signature)return [];
  return g.slugs.filter(s=>!state.completed.some(x=>x.slug===s)).map((s,i)=>({slug:s,kind:g.seriesSlug?'series' as const:'standalone' as const,seriesSlug:g.seriesSlug,order:i,readyAt:stored.readyAt}));
 });
 if(!articles.length)return state;
 const chosen=planReleaseQueue({articles,startAt:releaseAt,activeSeries:active})[0];
 if(chosen.releaseAt!==releaseAt)return state;
 const post=posts.find(p=>p.slug===chosen.slug)!;
 const group=groups.find(g=>g.slugs.includes(post.slug))!;
 return {...state,activeSeries:group.seriesSlug??active,pending:{slug:post.slug,releaseAt,revision:post.revision,...(group.seriesSlug?{seriesSlug:group.seriesSlug}:{})}};
}
// Caller supplies verified public evidence, never a workflow success alone.
export function confirmRelease(state:QueueState,slug:string,now:string):QueueState {
 queueSchema.parse(state);instant(now);
 if(!state.pending || state.pending.slug!==slug)throw new Error('No matching pending release');
 if(instant(now)<instant(state.pending.releaseAt))throw new Error('Confirmation before slot');
 const {pending,...rest}=state;
 return {...rest,completed:[...rest.completed,{slug,releaseAt:pending.releaseAt,confirmedAt:now}]};
}
