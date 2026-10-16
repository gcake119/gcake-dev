import YAML from 'yaml';
import { collectReleaseEligibility, type ReleaseSeriesSnapshot } from '@gcake/publishing-contract/release-eligibility';
import { planReleaseQueue, instant, slotAtOrBefore, formatTaipei } from '@gcake/publishing-contract/release-queue';
import type { QueueView, QueueControl, OverridePreview, ReleaseRecord } from '@gcake/admin-contract';
export interface SnapshotFile {
  path: string;
  sha: string;
  source: string;
}
export interface SnapshotPost extends SnapshotFile {
  slug: string;
  title: string;
  status: string;
  publishedAt?: string;
}
export interface SnapshotSeries extends SnapshotFile, ReleaseSeriesSnapshot { paused?: boolean; external?: boolean; }
export interface ReleaseSnapshot {
  revision: string;
  posts: SnapshotPost[];
  series: SnapshotSeries[];
  firstReadyAt?: (post: SnapshotPost) => Promise<string>;
  firstSeriesReadyAt?: (series: SnapshotSeries) => Promise<string>;
}
interface Runtime {
  posts: Record<string, { firstReadyAt?: string; eligibilityFloor?: string }>;
  startedAt?: string;
  observedRevision?: string;
  activeSeries?: string;
  seriesReadyAt: Record<string, string>;
  seriesEligibilityFloor?: Record<string,string>;
  seriesOrder: Record<string, string>;
  paused: string[];
  overrides: Record<string, string>;
  adopted: string[];
  releases: ReleaseRecord[];
}
interface Stored {
  version: number;
  data: Runtime;
}
export interface ReleaseDatabase {
  prepare(sql: string): {
    bind(...v: unknown[]): any;
    first<T>(): Promise<T | null>;
    run(): Promise<any>;
  };
}
export class D1ReleaseStore {
  constructor(private db: ReleaseDatabase) {}
  async read(): Promise<Stored> {
    const row = await this.db
      .prepare('SELECT version, document FROM release_queue_runtime WHERE id = 1')
      .first<{ version: number; document: string }>();
    if (!row) throw new Error('RELEASE_MIGRATION_REQUIRED');
    return { version: row.version, data: JSON.parse(row.document) };
  }
  async write(previous: Stored): Promise<void> {
    const result = await this.db
      .prepare('UPDATE release_queue_runtime SET document = ?, version = version + 1 WHERE id = 1 AND version = ?')
      .bind(JSON.stringify(previous.data), previous.version)
      .run();
    if (Number(result.meta?.changes) !== 1) throw new Error('QUEUE_CONFLICT');
  }
}
const dateOf = (value: string) => new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 10);
export const currentSlot = (now: string) => dateOf(now) + 'T07:00:00+08:00';
function fixedSlot(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T07:00:00\+08:00$/.test(value) || !Number.isFinite(Date.parse(value)) || dateOf(value) !== value.slice(0, 10))
    throw new Error('INVALID_RELEASE_SLOT');
  const day = new Date(Date.parse(value) + 8 * 3600000).getUTCDay();
  if (day !== 1 && day !== 4) throw new Error('INVALID_RELEASE_SLOT');
  return value;
}
function event(r: ReleaseRecord, at: string, type: string, detail?: string) {
  r.events.push({ at, type, detail });
  r.events = r.events.slice(-100);
}
export class ReleaseQueue {
  constructor(
    readonly store: D1ReleaseStore,
    readonly now: () => string = () => new Date().toISOString(),
    readonly enabled = false,
  ) {}
  private async mutate<T>(fn: (s: Stored) => T): Promise<T> {
    const s = await this.store.read();
    const value = fn(s);
    await this.store.write(s);
    return value;
  }
  private eligible(s: Stored, snapshot: ReleaseSnapshot) {
    const posts = snapshot.posts.map((p) => ({
      slug: p.slug,
      status: p.status as 'draft' | 'ready' | 'published',
      readyAt: s.data.posts[p.slug]?.firstReadyAt,
    }));
    const result = collectReleaseEligibility(posts, snapshot.series);
    const heldSeries = new Set(result.blockedSeries.map((b) => b.seriesSlug));
    for (const series of snapshot.series) {
      if (series.paused || series.external) {
        heldSeries.add(series.slug);
        result.blockedSeries.push({seriesSlug:series.slug,reasons:[series.paused?'MANIFEST_PAUSED':'EXTERNAL_SERIES']});
      }
      const refs = series.sections.flatMap((x) => x.posts);
      const started = refs.some((x) => x.status === 'published') || s.data.releases.some((r) => r.seriesSlug === series.slug);
      const order = JSON.stringify(refs.map((x) => x.slug));
      if (started && s.data.seriesOrder[series.slug] && order !== s.data.seriesOrder[series.slug]) {
        heldSeries.add(series.slug);
        result.blockedSeries.push({
          seriesSlug: series.slug,
          reasons: ['STARTED_SERIES_ORDER_CHANGED'],
        });
      }
      if (refs.some(ref => {
        const p = snapshot.posts.find(p => p.slug === ref.slug);
        return ref.status === 'published' && p?.publishedAt &&
          Date.parse(p.publishedAt.length === 10 ? p.publishedAt + 'T00:00:00+08:00' : p.publishedAt) > Date.parse(this.now());
      })) {
        heldSeries.add(series.slug);
        result.blockedSeries.push({seriesSlug: series.slug, reasons: ['FUTURE_PREDECESSOR']});
      }
      let readySeen = false;
      if (
        refs.some((x) => {
          if (x.status === 'ready') readySeen = true;
          return readySeen && x.status === 'published';
        })
      ) {
        heldSeries.add(series.slug);
        result.blockedSeries.push({
          seriesSlug: series.slug,
          reasons: ['NONCONTIGUOUS_PUBLICATION'],
        });
      }
    }
    const articles = result.articles.filter((p) => !heldSeries.has(p.seriesSlug ?? ''));
    return {
      ...result,
      articles: articles.map((p) => ({
        ...p,
        readyAt: p.seriesSlug ? (s.data.seriesReadyAt[p.seriesSlug] ?? p.readyAt) : p.readyAt,
      })),
    };
  }
  private presentation(s: Stored, snapshot: ReleaseSnapshot): QueueView {
    const now = this.now();
    const eligible = this.eligible(s, snapshot);
    const releases = s.data.releases;
    const reserved = new Set(releases.filter((r) => !r.unlockedAt && r.mode!=='manual').map((r) => r.slot));
    for(const r of releases.filter(r=>!r.unlockedAt && r.mode==='manual')) {
      const date=dateOf(r.slot);const day=new Date(date+'T00:00:00Z').getUTCDay();
      if(day===1 || day===4)reserved.add(date+'T07:00:00+08:00');
    }
    for (const p of snapshot.posts)
      if (
        p.status === 'published' &&
        p.publishedAt &&
        Date.parse(p.publishedAt.length === 10 ? p.publishedAt + 'T00:00:00+08:00' : p.publishedAt) >=
          Date.parse(currentSlot(now)) - 7 * 3600000
      ) {
        const date = dateOf(p.publishedAt);
        // Classify the extracted Taipei date without moving off-calendar dates to the next slot.
        const taipeiWeekday = new Date(date + 'T00:00:00Z').getUTCDay();
        if (taipeiWeekday === 1 || taipeiWeekday === 4) reserved.add(date + 'T07:00:00+08:00');
      }
    const baseReason = (slug: string, seriesSlug?: string) => {
      if (s.data.paused.includes('post:' + slug) || s.data.paused.includes('series:' + seriesSlug)) return 'PAUSED';
      const p = snapshot.posts.find((p) => p.slug === slug)!;
      if (s.data.overrides[slug] && Date.parse(s.data.overrides[slug]) < Date.parse(currentSlot(now))) return 'MISSED_FIXED_SLOT';
      if (p.publishedAt && !s.data.adopted.includes(slug) && !s.data.overrides[slug]) return 'LEGACY_SCHEDULE_REQUIRES_ADOPTION';
      return undefined;
    };
    const reason = (slug: string, seriesSlug?: string) => {
      const own = baseReason(slug, seriesSlug);
      if (own) return own;
      const refs = snapshot.series.find((series) => series.slug === seriesSlug)?.sections.flatMap((section) => section.posts) ?? [];
      const position = refs.findIndex((p) => p.slug === slug);
      if (refs.slice(0, position).some((p) => p.status === 'ready' && baseReason(p.slug, seriesSlug))) return 'SERIES_PREDECESSOR_HELD';
      return undefined;
    };
    const candidates = eligible.articles.filter(
      (p) => !reason(p.slug, p.seriesSlug) && !releases.some((r) => r.slug === p.slug && !r.unlockedAt),
    );
    const active = s.data.activeSeries;
    // A held active series cannot be replaced by another waiting series.
    if (active && !candidates.some(p=>p.seriesSlug===active)) {
      for (let i=candidates.length-1;i>=0;i--)
        if (candidates[i].seriesSlug && candidates[i].seriesSlug !== active) candidates.splice(i,1);
    }
    // Preserve the active series without changing its stored whole-series readyAt.
    const fixedSlots = Object.entries(s.data.overrides)
      .filter(([slug]) => candidates.some((p) => p.slug === slug))
      .map(([slug, releaseAt]) => ({ slug, releaseAt }));
    // Pausing or withholding a fixed article never releases its committed date.
    for (const [slug, slot] of Object.entries(s.data.overrides)) if (!fixedSlots.some((p) => p.slug === slug)) reserved.add(slot);
    const start = fixedSlots.some((p) => p.releaseAt === currentSlot(now))
      ? currentSlot(now)
      : Date.parse(now) > Date.parse(currentSlot(now))
        ? new Date(Date.parse(currentSlot(now)) + 1).toISOString()
        : now;
    const plan = planReleaseQueue({
      articles: candidates,
      startAt: start,
      reservedSlots: [...reserved],
      fixedSlots,
      activeSeriesSlug: active,
    });
    return {
      version: s.version,
      revision: snapshot.revision,
      enabled: this.enabled,
      plan,
      releases: structuredClone(releases),
      blockedSeries: eligible.blockedSeries,
      seriesReadyAt: { ...s.data.seriesReadyAt },
      items: snapshot.posts
        .filter((p) => p.status === 'ready' || releases.some((r) => r.slug === p.slug))
        .map((p) => {
          const a = eligible.articles.find((x) => x.slug === p.slug);
          const r = releases.find((x) => x.slug === p.slug && !x.unlockedAt);
          const membership = snapshot.series.find((x) => x.sections.some((s) => s.posts.some((x) => x.slug === p.slug)));
          const candidateReason = reason(p.slug, membership?.slug) ?? (!a && p.status === 'ready' ? 'INCOMPLETE_SERIES' : undefined);
          // A retained public release is complete, not a legacy-date candidate awaiting adoption.
          const why = p.status === 'published' && r?.state === 'verified-public' && candidateReason === 'LEGACY_SCHEDULE_REQUIRES_ADOPTION'
            ? undefined : candidateReason;
          return {
            slug: p.slug,
            title: p.title,
            contentStatus: p.status,
            postPaused: s.data.paused.includes(`post:${p.slug}`),
            seriesPaused: !!membership && s.data.paused.includes(`series:${membership.slug}`),
            seriesSlug: membership?.slug,
            order: a?.order,
            readyAt: s.data.posts[p.slug]?.firstReadyAt,
            state: r?.state ?? (why === 'PAUSED' ? 'paused' : why ? 'waiting-eligibility' : 'queued'),
            reason: why,
            estimatedAt: r?.slot ?? plan.find((x) => x.slug === p.slug)?.releaseAt,
            notification: 'external-unreported',
          };
        }),
    };
  }
  async ingest(snapshot: ReleaseSnapshot): Promise<QueueView> {
    if (!snapshot.revision || new Set(snapshot.posts.map((p) => p.slug)).size !== snapshot.posts.length)
      throw new Error('INVALID_SNAPSHOT');
    const stored = await this.store.read();
    const readiness = new Map<string, string>();
    const at = this.now();
    instant(at);
    for (const p of snapshot.posts.filter(p => p.status === 'ready')) {
      const previous = stored.data.posts[p.slug];
      const value = snapshot.firstReadyAt && (!previous?.firstReadyAt || stored.data.observedRevision !== snapshot.revision)
        ? await snapshot.firstReadyAt(p) : previous?.firstReadyAt ?? at;
      if (instant(value) > instant(at)) throw new Error('INVALID_READY_HISTORY');
      const floor=previous?.eligibilityFloor;
      readiness.set(p.slug,floor && instant(floor)>instant(value)?floor:value);
    }
    const seriesHistory = new Map<string,string>();
    if (snapshot.firstSeriesReadyAt && stored.data.observedRevision !== snapshot.revision) {
      for (const series of snapshot.series) {
        const refs = series.sections.flatMap(s => s.posts);
        if (!series.paused && !series.external && refs.length && refs.every(ref => ['ready','published'].includes(ref.status) &&
          snapshot.posts.some(p => p.slug === ref.slug && p.status === ref.status))) {
          const value = await snapshot.firstSeriesReadyAt(series);
          if (instant(value) > instant(at)) throw new Error('INVALID_READY_HISTORY');
          seriesHistory.set(series.slug, value);
        }
      }
    }
    await this.mutate((s) => {
      if (s.version !== stored.version) throw new Error('QUEUE_CONFLICT');
      s.data.startedAt ??= at;
      s.data.observedRevision = snapshot.revision;
      for (const slug of Object.keys(s.data.posts))
        if (!snapshot.posts.some(p => p.slug === slug)) delete s.data.posts[slug];
      for (const p of snapshot.posts) {
        if (!['draft', 'ready', 'published'].includes(p.status)) throw new Error('INVALID_SNAPSHOT');
        const record = (s.data.posts[p.slug] ??= {});
        if (p.status === 'ready') record.firstReadyAt = readiness.get(p.slug)!;
        else if (p.status !== 'published') delete record.firstReadyAt;
      }
      const eligible = this.eligible(s, snapshot);
      const started = snapshot.series.filter(series => {
        const refs = series.sections.flatMap(x => x.posts);
        const unfinished = refs.some(p => p.status !== 'published') || refs.some(ref => {
          const p=snapshot.posts.find(p=>p.slug===ref.slug);
          return p?.publishedAt && Date.parse(p.publishedAt) > Date.parse(at);
        });
        return unfinished && (refs.some(p=>p.status==='published') ||
          s.data.releases.some(r=>r.seriesSlug===series.slug && !r.unlockedAt));
      });
      if (s.data.activeSeries) {
        const active = snapshot.series.find(x=>x.slug===s.data.activeSeries);
        if (active && active.sections.flatMap(x=>x.posts).every(ref=> {
          const p=snapshot.posts.find(p=>p.slug===ref.slug);
          return ref.status==='published' && p?.status==='published' &&
            (!p.publishedAt || Date.parse(p.publishedAt)<=Date.parse(at));
        }) && !s.data.releases.some(r=>r.seriesSlug===active.slug && !r.unlockedAt && r.state!=='verified-public'))
          delete s.data.activeSeries;
      }
      if (!s.data.activeSeries) {
        if (started.length > 1) throw new Error('MULTIPLE_ACTIVE_SERIES');
        s.data.activeSeries = started[0]?.slug;
      }
      for (const slug of Object.keys(s.data.seriesReadyAt))
        if (!snapshot.series.some(p=>p.slug===slug)) delete s.data.seriesReadyAt[slug];
      for (const series of snapshot.series) {
        const refs=series.sections.flatMap(x=>x.posts);
        const order=JSON.stringify(refs.map(p=>p.slug));
        const hasStarted=refs.some(p=>p.status==='published') || s.data.releases.some(r=>r.seriesSlug===series.slug);
        if (eligible.blockedSeries.some(b=>b.seriesSlug===series.slug)) {
          if (!hasStarted) delete s.data.seriesReadyAt[series.slug];
          continue;
        }
        if (!refs.some(p=>p.status==='ready')) continue;
        const changed=s.data.seriesOrder[series.slug] && s.data.seriesOrder[series.slug]!==order;
        const evidence=[...refs.filter(p=>p.status==='ready').map(p=>s.data.posts[p.slug].firstReadyAt!),seriesHistory.get(series.slug),s.data.seriesEligibilityFloor?.[series.slug]].filter((x):x is string=>!!x);
        const history=seriesHistory.has(series.slug) ? evidence.reduce((latest,value)=>instant(value)>instant(latest)?value:latest) : undefined;
        const previous=s.data.seriesReadyAt[series.slug];
        s.data.seriesReadyAt[series.slug]=changed && !hasStarted ? at :
          history && (!previous || instant(history)>instant(previous)) ? history : previous ?? at;
        s.data.seriesOrder[series.slug]=order;
      }
      for (const r of s.data.releases)
        if (['publishing', 'committed-slot'].includes(r.state) && Date.parse(r.leaseUntil) <= Date.parse(this.now())) {
          r.state = 'verification-unknown';
          r.error = 'LEASE_EXPIRED';
          event(r, this.now(), 'lease-expired');
        }
    });
    return this.view(snapshot);
  }
  async view(snapshot: ReleaseSnapshot) {
    return this.presentation(await this.store.read(), snapshot);
  }
  private manualCandidate(s:Stored,snapshot:ReleaseSnapshot,slug:string) {
    const at=this.now();instant(at);
    // A real observation at the manual time, not reconstructed historical readiness.
    for(const p of snapshot.posts.filter(p=>p.status==='ready')) (s.data.posts[p.slug]??={}).firstReadyAt??=at;
    const post=snapshot.posts.find(p=>p.slug===slug);
    if(!post || post.status!=='ready')throw new Error('MANUAL_NOT_READY');
    if(post.publishedAt || s.data.overrides[slug])throw new Error('MANUAL_DATE_COMMITMENT_HELD');
    if(s.data.releases.some(r=>!r.unlockedAt && r.state!=='verified-public'))throw new Error('PENDING_RELEASE_RECONCILIATION_REQUIRED');
    const view=this.presentation(s,snapshot);const item=view.items.find(p=>p.slug===slug);
    if(!item || item.reason)throw new Error('MANUAL_INELIGIBLE');
    const series=snapshot.series.find(x=>x.slug===item.seriesSlug);
    if(series) {
      const refs=series.sections.flatMap(s=>s.posts);const position=refs.findIndex(p=>p.slug===slug);
      if(refs.slice(0,position).some(ref=>ref.status!=='published' || !s.data.releases.some(r=>r.slug===ref.slug && !r.unlockedAt && r.state==='verified-public') || !snapshot.posts.some(p=>p.slug===ref.slug && p.status==='published' && (!p.publishedAt || Date.parse(p.publishedAt)<=Date.parse(at)))))
        throw new Error('MANUAL_PREDECESSOR_NOT_PUBLIC');
      if(s.data.activeSeries && s.data.activeSeries!==series.slug)throw new Error('ACTIVE_SERIES_RECONCILIATION_REQUIRED');
      const started=snapshot.series.filter(x=>x.sections.some(s=>s.posts.some(p=>p.status==='published')) && x.sections.some(s=>s.posts.some(p=>p.status!=='published')));
      if(!s.data.activeSeries && started.length>1)throw new Error('MULTIPLE_ACTIVE_SERIES');
    }
    return {post,item,series};
  }
  async previewManual(snapshot:ReleaseSnapshot,slug:string) {
    const s=await this.store.read();const {post,item}=this.manualCandidate(s,snapshot,slug);
    return {slug,title:post.title,seriesSlug:item.seriesSlug,version:s.version,revision:snapshot.revision};
  }
  async acquireManual(snapshot:ReleaseSnapshot,slug:string,version:number,revision:string,actor:string,enabled:boolean) {
    if(!enabled)throw new Error('RELEASE_DISABLED');
    const s=await this.store.read();const prior=s.data.releases.find(r=>r.slug===slug && !r.unlockedAt);
    if(prior) {
      if(prior.mode==='manual' && prior.sourceRevision===revision)return {created:false,record:structuredClone(prior)};
      throw new Error('RELEASE_IDENTITY_LOCKED');
    }
    if(s.version!==version || snapshot.revision!==revision)throw new Error('QUEUE_CONFLICT');
    const {item,series}=this.manualCandidate(s,snapshot,slug);const now=this.now();
    const record:ReleaseRecord={id:crypto.randomUUID(),mode:'manual',slug,seriesSlug:item.seriesSlug,slot:formatTaipei(instant(now)),
      sourceRevision:revision,state:'committed-slot',lease:crypto.randomUUID(),leaseUntil:new Date(instant(now)+10*60000).toISOString(),attempts:0,events:[]};
    s.data.startedAt??=now;
    if(series){s.data.activeSeries??=series.slug;s.data.seriesOrder[series.slug]=JSON.stringify(series.sections.flatMap(s=>s.posts.map(p=>p.slug)));}
    event(record,now,'manual-authorized',actor);s.data.releases.push(record);
    await this.store.write(s);return {created:true,record:structuredClone(record)};
  }
  async acquire(snapshot: ReleaseSnapshot, enabled: boolean): Promise<ReleaseRecord | undefined> {
    if (!enabled) throw new Error('RELEASE_DISABLED');
    await this.ingest(snapshot);
    return this.mutate((s) => {
      const now = this.now();
      const slot = formatTaipei(slotAtOrBefore(instant(now)));
      if (!s.data.startedAt || instant(s.data.startedAt) > instant(slot)) return undefined;
      if (s.data.activeSeries) {
        const active=snapshot.series.find(x=>x.slug===s.data.activeSeries);
        if (!active || this.eligible(s,snapshot).blockedSeries.some(b=>b.seriesSlug===s.data.activeSeries))
          throw new Error('ACTIVE_SERIES_RECONCILIATION_REQUIRED');
      }
      if (s.data.releases.some((r) => !r.unlockedAt && (r.slot === slot || r.state !== 'verified-public'))) return undefined;
      // Plan as of the due slot while using already ingested durable readiness.
      const temporary = new ReleaseQueue(this.store, () => slot, this.enabled);
      const view = temporary.presentation(s, snapshot);
      const candidate = view.plan.find((x) => x.releaseAt === slot);
      if (!candidate) return undefined;
      const item = view.items.find((x) => x.slug === candidate.slug)!;
      const r: ReleaseRecord = {
        id: s.data.releases.find((r) => r.slug === candidate.slug)?.id ?? crypto.randomUUID(),
        slug: candidate.slug,
        seriesSlug: item.seriesSlug,
        slot,
        sourceRevision: snapshot.revision,
        state: 'committed-slot',
        lease: crypto.randomUUID(),
        leaseUntil: new Date(Date.parse(now) + 10 * 60000).toISOString(),
        attempts: s.data.releases.find((r) => r.slug === candidate.slug)?.attempts ?? 0,
        events: s.data.releases.find((r) => r.slug === candidate.slug)?.events ?? [],
      };
      if (item.seriesSlug) s.data.activeSeries ??= item.seriesSlug;
      event(r, item.readyAt ?? now, 'first-ready');
      event(r, now, 'plan-version', String(s.version));
      event(r, now, 'slot-committed', slot);
      const previous = s.data.releases.findIndex((p) => p.slug === candidate.slug);
      if (previous >= 0) s.data.releases[previous] = r;
      else s.data.releases.push(r);
      return structuredClone(r);
    });
  }
  async update(id: string, lease: string, change: (r: ReleaseRecord) => void) {
    return this.mutate((s) => {
      const r = s.data.releases.find((x) => x.id === id);
      if (!r || r.lease !== lease) throw new Error('LEASE_CONFLICT');
      change(r);
      return structuredClone(r);
    });
  }
  async beginWrite(id: string, lease: string) {
    return this.update(id, lease, (r) => {
      if (r.state !== 'committed-slot' || Date.parse(r.leaseUntil) <= Date.parse(this.now())) throw new Error('LEASE_CONFLICT');
      r.state = 'publishing';
      r.attempts++;
      event(r, this.now(), 'write-started');
    });
  }
  async record(id: string, lease: string, patch: Partial<ReleaseRecord>, type: string) {
    return this.update(id, lease, (r) => {
      if (r.state === 'verified-public') return;
      Object.assign(r, patch);
      event(r, this.now(), type, patch.error);
    });
  }
  async previewOverride(snapshot: ReleaseSnapshot, slug: string, releaseAt: string): Promise<OverridePreview> {
    fixedSlot(releaseAt);
    const s = await this.store.read();
    const before = this.presentation(s, snapshot).plan;
    const conflicts: string[] = [];
    if (Date.parse(releaseAt) < Date.parse(this.now())) conflicts.push('PAST_SLOT');
    if (!before.some((p) => p.slug === slug)) conflicts.push('NOT_ELIGIBLE');
    if (
      s.data.releases.some((r) => !r.unlockedAt && (r.slot === releaseAt || r.slug === slug)) ||
      Object.entries(s.data.overrides).some(([key, value]) => key !== slug && value === releaseAt)
    )
      conflicts.push('SLOT_OCCUPIED');
    if (snapshot.posts.some((p) => p.status === 'published' && p.publishedAt && dateOf(p.publishedAt) === dateOf(releaseAt)))
      conflicts.push('LEGACY_SLOT_OCCUPIED');
    s.data.overrides[slug] = releaseAt;
    let after = before;
    if (!conflicts.length) {
      try {
        after = this.presentation(s, snapshot).plan;
      } catch {
        conflicts.push('SERIES_ORDER_CONFLICT');
      }
    }
    return {
      version: s.version,
      revision: snapshot.revision,
      releaseAt,
      conflicts,
      before,
      after,
      affected: before
        .filter((p) => after.find((x) => x.slug === p.slug)?.releaseAt !== p.releaseAt)
        .map((p) => ({
          slug: p.slug,
          before: p.releaseAt,
          after: after.find((x) => x.slug === p.slug)?.releaseAt,
        })),
    };
  }
  async control(snapshot: ReleaseSnapshot, input: QueueControl) {
    const preview = input.action === 'override' ? await this.previewOverride(snapshot, input.slug, input.releaseAt ?? '') : undefined;
    await this.mutate((s) => {
      if (
        (input.version !== undefined && s.version !== input.version) ||
        (input.revision !== undefined && snapshot.revision !== input.revision)
      )
        throw new Error('QUEUE_CONFLICT');
      if (
        !(input.action === 'unlock' && s.data.releases.some((r) => r.slug === input.slug)) &&
        !snapshot.posts.some((p) => p.slug === input.slug) &&
        !snapshot.series.some((p) => p.slug === input.slug)
      )
        throw new Error('NOT_FOUND');
      const key = (input.scope ?? 'post') + ':' + input.slug;
      if (input.action === 'pause') {
        if (!s.data.paused.includes(key)) s.data.paused.push(key);
      } else if (input.action === 'resume') {
        if(s.data.paused.includes(key)) {
          if(input.scope==='series') {
            (s.data.seriesEligibilityFloor ??= {})[input.slug]=this.now();
            s.data.seriesReadyAt[input.slug]=this.now();
          } else {
            const post=(s.data.posts[input.slug] ??= {});
            post.eligibilityFloor=this.now();post.firstReadyAt=this.now();
          }
        }
        s.data.paused=s.data.paused.filter(k=>k!==key);
      }
      else if (input.action === 'adopt-auto') {
        if (!s.data.adopted.includes(input.slug)) s.data.adopted.push(input.slug);
      } else if (input.action === 'override') {
        if (!preview || preview.version !== s.version || preview.conflicts.length) throw new Error('SLOT_CONFLICT');
        s.data.overrides[input.slug] = preview.releaseAt;
      } else if (input.action === 'cancel-override') delete s.data.overrides[input.slug];
      else if (input.action === 'unlock') {
        const r = s.data.releases.find((r) => r.slug === input.slug);
        if (!input.confirmed) throw new Error('CONFIRMATION_REQUIRED');
        if (!r || r.state !== 'failed' || r.commitSha || !['GIT_CONFLICT', 'ELIGIBILITY_CHANGED'].includes(r.error ?? ''))
          throw new Error('UNSAFE_UNLOCK');
        r.unlockedAt = this.now();
        event(r, this.now(), 'safe-unlock');
      }
    });
    return this.view(snapshot);
  }
  async assertSeriesWrites(snapshot: ReleaseSnapshot, files: readonly { path: string; source?: string }[]) {
    const s = await this.store.read();
    for (const series of snapshot.series) {
      const file = files.find((f) => f.path === series.path);
      if (!file) continue;
      const started =
        series.sections.some((section) => section.posts.some((p) => p.status === 'published')) ||
        s.data.releases.some((r) => r.seriesSlug === series.slug);
      if (!started) continue;
      // Lifecycle writes retain both the identity and article order of a started series.
      if (file.source === undefined) throw new Error('STARTED_SERIES_ORDER_LOCKED');
      const parsed = YAML.parse(file.source);
      if (parsed.slug !== series.slug) throw new Error('STARTED_SERIES_ORDER_LOCKED');
      const order = JSON.stringify(parsed.sections.flatMap((section: any) => section.posts.map((p: any) => p.slug)));
      const current = JSON.stringify(series.sections.flatMap((section) => section.posts.map((p) => p.slug)));
      if (order !== current) throw new Error('STARTED_SERIES_ORDER_LOCKED');
    }
  }
  async assertPostIdentityChange(snapshot: ReleaseSnapshot, slug: string) {
    const { data } = await this.store.read();
    if (
      data.releases.some((r) => r.slug === slug) ||
      snapshot.series.some(
        (series) =>
          series.sections.some((section) => section.posts.some((p) => p.slug === slug)) &&
          series.sections.some((section) => section.posts.some((p) => p.status === 'published')),
      )
    )
      throw new Error('RELEASE_IDENTITY_LOCKED');
  }
  async retryLease(id: string) {
    return this.mutate((s) => {
      const r = s.data.releases.find((r) => r.id === id);
      if (!r || r.state !== 'failed' || r.unlockedAt || !['GIT_CONFLICT', 'ELIGIBILITY_CHANGED'].includes(r.error ?? '') || r.commitSha)
        throw new Error('REVERIFY_REQUIRED');
      r.lease = crypto.randomUUID();
      r.leaseUntil = new Date(Date.parse(this.now()) + 600000).toISOString();
      r.state = 'committed-slot';
      event(r, this.now(), 'safe-retry');
      return structuredClone(r);
    });
  }
}
