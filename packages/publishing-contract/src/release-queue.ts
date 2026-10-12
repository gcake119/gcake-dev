/**
 * Pure editorial planner. It makes no Git or provider writes.
 * All queued items must carry durable readyAt instants supplied by an ingestion layer.
 * Published items are excluded by the caller and existing commitments passed as reservedSlots.
 */
export interface PendingArticle {
  slug: string;
  kind: "standalone" | "series";
  readyAt: string;
  seriesSlug?: string;
  order?: number;
}
export interface ReleasePlanInput {
  articles: PendingArticle[];
  startAt: string;
  reservedSlots?: string[];
  fixedSlots?: ReleaseSlot[];
  activeSeriesSlug?: string;
}
export interface ReleaseSlot {
  slug: string;
  releaseAt: string;
}
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Explicit timezone timestamp is required');
  const calendar = value.slice(0, 10);
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new Error('Invalid timestamp');
  const day = Date.parse(calendar + 'T00:00:00Z');
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== calendar) throw new Error('Invalid timestamp');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid timestamp');
  return time;
}
export function slotAtOrAfter(time: number): number {
  // Taiwan has no daylight saving time; convert into local-day UTC arithmetic.
  const taipei = time + 8 * HOUR_MS;
  let day = Math.floor(taipei / DAY_MS);
  if (taipei > day * DAY_MS + 7 * HOUR_MS) day++;
  for (;;) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (weekday === 1 || weekday === 4) return day * DAY_MS - HOUR_MS; // 07:00 +08:00 = prior 23:00 UTC
    day++;
  }
}
export function slotAtOrBefore(time: number): number {
  let day = Math.floor((time + 8 * HOUR_MS) / DAY_MS);
  for (;; day--) {
    const slot = day * DAY_MS - HOUR_MS;
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if ((weekday === 1 || weekday === 4) && slot <= time) return slot;
  }
}
export function formatTaipei(ms: number): string {
  const d = new Date(ms + 8 * HOUR_MS);
  return d.toISOString().slice(0, 19) + "+08:00";
}
export function planReleaseQueue(input: ReleasePlanInput): ReleaseSlot[] {
  const slugs = new Set<string>();
  const series = new Map<string, PendingArticle[]>();
  const singles: PendingArticle[] = [];
  for (const item of input.articles) {
    if (slugs.has(item.slug)) throw new Error('Duplicate slug: ' + item.slug);
    slugs.add(item.slug); instant(item.readyAt);
    if (item.kind === 'standalone') singles.push(item);
    else {
      if (!item.seriesSlug || !Number.isSafeInteger(item.order) || (item.order ?? -1) < 0) throw new Error('Missing series order');
      const items = series.get(item.seriesSlug) ?? []; items.push(item); series.set(item.seriesSlug, items);
    }
  }
  const groups = [...series.entries()].map(([slug, items]) => {
    items.sort((a,b)=>a.order! - b.order!);
    if (new Set(items.map(x=>x.order)).size !== items.length) throw new Error('Duplicate series order: '+slug);
    return {slug,items,readyAt:Math.max(...items.map(x=>instant(x.readyAt))),index:0};
  });
  const reserved = new Set((input.reservedSlots ?? []).map(x=>{
    const time=instant(x);
    if(slotAtOrAfter(time)!==time)throw new Error('Invalid reserved slot');
    return time;
  }));
  const fixed = new Map<number,string>(); const fixedBySlug = new Map<string,number>();
  for (const slot of input.fixedSlots ?? []) {
    const time=instant(slot.releaseAt);
    if (!slugs.has(slot.slug) || fixed.has(time) || fixedBySlug.has(slot.slug) || reserved.has(time) || slotAtOrAfter(time)!==time || time<instant(input.startAt)) throw new Error('SLOT_CONFLICT');
    const article=input.articles.find(p=>p.slug===slot.slug)!;
    if (instant(article.readyAt)>time)throw new Error('SLOT_CONFLICT');
    fixed.set(time,slot.slug);fixedBySlug.set(slot.slug,time);
  }
  const result: ReleaseSlot[] = []; let time=slotAtOrAfter(instant(input.startAt));
  let active=groups.find(g=>g.slug===input.activeSeriesSlug && g.readyAt<=time);
  const takeGroup=(group:typeof groups[number])=>{
    const next=group.items[group.index];
    if (!next || fixedBySlug.has(next.slug) && fixedBySlug.get(next.slug)!==time) return undefined;
    if (active && active!==group && active.index<active.items.length)throw new Error('SERIES_ORDER_CONFLICT');
    active=group;group.index++;if(group.index===group.items.length)active=undefined;return next;
  };
  while (result.length<input.articles.length) {
    if(reserved.has(time)){time=slotAtOrAfter(time+1);continue;}
    let chosen:PendingArticle|undefined;
    const pinned=fixed.get(time);
    if(pinned){
      const single=singles.find(x=>x.slug===pinned);
      if(single){chosen=single;singles.splice(singles.indexOf(single),1);}
      else {const group=groups.find(g=>g.items.some(x=>x.slug===pinned))!;if(group.items[group.index]?.slug!==pinned||group.readyAt>time)throw new Error('SERIES_ORDER_CONFLICT');chosen=takeGroup(group);}
    }else{
      // A fixed later chapter commits the last available predecessor slots too.
      // Late standalones cannot invalidate an already confirmed series promise.
      const urgent=groups.filter(g=>g.readyAt<=time && g.index<g.items.length).map(g=>{
        const position=g.items.findIndex((p,i)=>i>=g.index && fixedBySlug.has(p.slug));
        const deadline=position<0?undefined:fixedBySlug.get(g.items[position].slug);
        if(deadline===undefined||deadline<=time)return undefined;
        let free=0;for(let t=time;t<deadline;t=slotAtOrAfter(t+1))if(!reserved.has(t)&&!fixed.has(t))free++;
        return free<=position-g.index?{group:g,deadline}:undefined;
      }).filter((x):x is {group:typeof groups[number];deadline:number}=>Boolean(x)).sort((a,b)=>a.deadline-b.deadline);
      if(urgent[0])chosen=takeGroup(urgent[0].group);
      if(!chosen){
        const eligibleSingles=singles.filter(x=>!fixedBySlug.has(x.slug)&&instant(x.readyAt)<=time).sort((a,b)=>instant(a.readyAt)-instant(b.readyAt)||a.slug.localeCompare(b.slug));
        if(eligibleSingles[0]){chosen=eligibleSingles[0];singles.splice(singles.indexOf(chosen),1);}
        else {
          if(!active)active=groups.filter(g=>g.index<g.items.length&&g.readyAt<=time&&!fixedBySlug.has(g.items[g.index].slug)).sort((a,b)=>a.readyAt-b.readyAt||a.slug.localeCompare(b.slug))[0];
          if(active)chosen=takeGroup(active);
        }
      }
    }
    if(chosen)result.push({slug:chosen.slug,releaseAt:formatTaipei(time)});
    else {
      const future=[...singles.map(x=>instant(x.readyAt)),...groups.filter(g=>g.index<g.items.length).map(g=>g.readyAt),...fixed.keys()].filter(t=>t>time);
      if(!future.length)throw new Error('Queue deadlock');time=slotAtOrAfter(Math.min(...future));continue;
    }
    time=slotAtOrAfter(time+1);
  }
  return result;
}
