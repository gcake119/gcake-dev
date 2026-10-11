/**
 * Pure editorial planner. It makes no Git or provider writes.
 * All queued items must carry durable readyAt instants supplied by an ingestion layer.
 * Published items are excluded by the caller and existing commitments passed as reservedSlots.
 */
export interface PendingArticle {
  slug: string;
  kind: 'standalone' | 'series';
  readyAt: string;
  seriesSlug?: string;
  order?: number;
}
export interface ReleasePlanInput {
  articles: PendingArticle[];
  startAt: string;
  reservedSlots?: string[];
}
export interface ReleaseSlot {
  slug: string;
  releaseAt: string;
}
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
function instant(value: string): number {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('Explicit timezone is required');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid timestamp');
  return time;
}
function slotAtOrAfter(time: number): number {
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
function formatTaipei(ms: number): string {
  const d = new Date(ms + 8 * HOUR_MS);
  return d.toISOString().slice(0, 19) + '+08:00';
}
export function planReleaseQueue(input: ReleasePlanInput): ReleaseSlot[] {
  const slugs = new Set<string>();
  const series = new Map<string, PendingArticle[]>();
  const singles: PendingArticle[] = [];
  for (const item of input.articles) {
    if (slugs.has(item.slug)) throw new Error('Duplicate slug: ' + item.slug);
    slugs.add(item.slug);
    instant(item.readyAt);
    if (item.kind === 'standalone') singles.push(item);
    else {
      if (!item.seriesSlug || !Number.isSafeInteger(item.order) || (item.order ?? -1) < 0) throw new Error('Missing series order');
      const items = series.get(item.seriesSlug) ?? [];
      items.push(item);
      series.set(item.seriesSlug, items);
    }
  }
  const groups = [...series.entries()].map(([slug, items]) => {
    items.sort((a, b) => a.order! - b.order!);
    if (new Set(items.map(x => x.order)).size !== items.length) throw new Error('Duplicate series order: ' + slug);
    return { slug, items, readyAt: Math.max(...items.map(x => instant(x.readyAt))), index: 0 };
  });
  const reserved = new Set((input.reservedSlots ?? []).map(x => slotAtOrAfter(instant(x))));
  const result: ReleaseSlot[] = [];
  let time = slotAtOrAfter(instant(input.startAt));
  let active: typeof groups[number] | undefined;
  while (result.length < input.articles.length) {
    if (reserved.has(time)) { time = slotAtOrAfter(time + 1); continue; }
    const eligibleSingles = singles.filter(x => instant(x.readyAt) <= time);
    eligibleSingles.sort((a, b) => instant(a.readyAt) - instant(b.readyAt) || a.slug.localeCompare(b.slug));
    const standalone = eligibleSingles[0];
    let chosen: PendingArticle | undefined;
    if (standalone) {
      chosen = standalone;
      singles.splice(singles.indexOf(standalone), 1);
    } else {
      if (!active) {
        const available = groups.filter(x => x.index < x.items.length && x.readyAt <= time);
        available.sort((a,b) => a.readyAt - b.readyAt || a.slug.localeCompare(b.slug));
        active = available[0];
      }
      if (active) {
        chosen = active.items[active.index++];
        if (active.index === active.items.length) active = undefined;
      }
    }
    if (chosen) result.push({slug: chosen.slug, releaseAt: formatTaipei(time)});
    else {
      const future = [...singles.map(x=>instant(x.readyAt)), ...groups.filter(x=>x.index===0).map(x=>x.readyAt)].filter(t=>t>time);
      if (!future.length) throw new Error('Queue deadlock');
      time = slotAtOrAfter(Math.min(...future));
      continue;
    }
    time = slotAtOrAfter(time + 1);
  }
  return result;
}
