import type {D1DatabaseLike} from '../../apps/admin-worker/src/media';
import type {ConfirmedSlot} from '../../apps/admin-worker/src/substack-schedules';
import {ScheduleRepository} from '../../apps/admin-worker/src/substack-schedules';
import {D1DistributionRuntime} from '../../apps/admin-worker/src/distribution-runtime';
import {D1PublicationRepository} from '../../apps/admin-worker/src/publication-operations';
import {anonymousSubstackReader} from './substack-attended';
import type {SubstackUiContract} from './substack-browser';
import type {ScheduleObservation} from './substack-schedule';
export function scheduledRuntime(db:D1DatabaseLike,ui:SubstackUiContract){
 const repo=new ScheduleRepository(db),legacy=new D1PublicationRepository(db);
 return {repo,runtime:new D1DistributionRuntime(db),
  async readSlot(slug:string,seriesSlug?:string):Promise<ConfirmedSlot|undefined>{
   const row=await db.prepare("SELECT version,document FROM release_queue_runtime WHERE id = 1").first<{version:number;document:string}>();
   if(!row)return;const d=JSON.parse(row.document) as {overrides?:Record<string,string>;paused?:string[];releases?:{slug:string;unlockedAt?:string}[]};
   const time=d.overrides?.[slug];if(!time||d.paused?.includes('post:'+slug)||seriesSlug&&d.paused?.includes('series:'+seriesSlug)||d.releases?.some(r=>r.slug===slug&&!r.unlockedAt))return;
   return {reservationId:`fixed:${slug}:${time}`,queueVersion:row.version,slug,scheduledAt:time,confirmed:true};
  },
  async legacyIdentity(slug:string){return (await legacy.listStates(slug)).find(s=>s.target==='substack');},
  async readPublic(id:string,url:string):Promise<ScheduleObservation>{const e=await anonymousSubstackReader(ui)({id,url});if(e.postId!==id||!e.html||e.images.some(i=>!i.loaded))throw Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');return {id,slug:new URL(url).pathname.split('/')[2],state:'published',saved:true,images:e.images,content:{title:e.title,description:e.description,html:e.html},canonical:e.canonical,publishedAt:e.publishedAt};}
 };
}
