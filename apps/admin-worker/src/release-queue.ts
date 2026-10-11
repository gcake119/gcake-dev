import YAML from 'yaml';
import { collectReleaseEligibility, type ReleaseSeriesSnapshot } from '@gcake/publishing-contract/release-eligibility';
import { planReleaseQueue } from '@gcake/publishing-contract/release-queue';
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
export interface SnapshotSeries extends SnapshotFile, ReleaseSeriesSnapshot {}
export interface ReleaseSnapshot {
  revision: string;
  posts: SnapshotPost[];
  series: SnapshotSeries[];
  firstReadyAt?: (post: SnapshotPost) => Promise<string>;
}
interface Runtime {
  posts: Record<string, { firstReadyAt?: string }>;
  seriesReadyAt: Record<string, string>;
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
    const reserved = new Set(releases.filter((r) => !r.unlockedAt).map((r) => r.slot));
    for (const p of snapshot.posts)
      if (
        p.status === 'published' &&
        p.publishedAt &&
        Date.parse(p.publishedAt.length === 10 ? p.publishedAt + 'T00:00:00+08:00' : p.publishedAt) >=
          Date.parse(currentSlot(now)) - 7 * 3600000
      )
        reserved.add(dateOf(p.publishedAt) + 'T07:00:00+08:00');
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
    const active =
      snapshot.series.find(
        (series) =>
          series.sections.some((x) => x.posts.some((p) => p.status === 'published')) &&
          candidates.some((p) => p.seriesSlug === series.slug),
      )?.slug ??
      releases.find((r) => r.state === 'verified-public' && r.seriesSlug && candidates.some((p) => p.seriesSlug === r.seriesSlug))
        ?.seriesSlug;
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
          const why = reason(p.slug, membership?.slug) ?? (!a && p.status === 'ready' ? 'INCOMPLETE_SERIES' : undefined);
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
    for (const p of snapshot.posts.filter((p) => p.status === 'ready' && !stored.data.posts[p.slug]?.firstReadyAt)) {
      const value = snapshot.firstReadyAt ? await snapshot.firstReadyAt(p) : this.now();
      if (!Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.parse(this.now())) throw new Error('INVALID_READY_HISTORY');
      readiness.set(p.slug, value);
    }
    await this.mutate((s) => {
      for (const p of snapshot.posts) {
        if (!['draft', 'ready', 'published'].includes(p.status)) throw new Error('INVALID_SNAPSHOT');
        const record = (s.data.posts[p.slug] ??= {});
        if (p.status === 'ready' && !record.firstReadyAt) record.firstReadyAt = readiness.get(p.slug)!;
        s.data.posts[p.slug] = record;
      }
      const eligible = this.eligible(s, snapshot);
      for (const series of snapshot.series)
        if (
          !eligible.blockedSeries.some((b) => b.seriesSlug === series.slug) &&
          series.sections.some((x) => x.posts.some((p) => p.status === 'ready'))
        ) {
          s.data.seriesReadyAt[series.slug] ??= this.now();
          s.data.seriesOrder[series.slug] = JSON.stringify(series.sections.flatMap((x) => x.posts.map((p) => p.slug)));
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
  async acquire(snapshot: ReleaseSnapshot, enabled: boolean): Promise<ReleaseRecord | undefined> {
    if (!enabled) throw new Error('RELEASE_DISABLED');
    await this.ingest(snapshot);
    return this.mutate((s) => {
      const now = this.now();
      const slot = currentSlot(now);
      const day = new Date(Date.parse(slot) + 8 * 3600000).getUTCDay();
      if ((day !== 1 && day !== 4) || Date.parse(now) < Date.parse(slot)) return undefined;
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
      } else if (input.action === 'resume') s.data.paused = s.data.paused.filter((k) => k !== key);
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
  async assertSeriesWrites(snapshot: ReleaseSnapshot, files: readonly { path: string; source: string }[]) {
    const s = await this.store.read();
    for (const series of snapshot.series) {
      const file = files.find((f) => f.path === series.path);
      if (!file) continue;
      const started =
        series.sections.some((section) => section.posts.some((p) => p.status === 'published')) ||
        s.data.releases.some((r) => r.seriesSlug === series.slug);
      if (!started) continue;
      // caller passes parsed series through validateAndSerialize; only compare order here.
      const parsed = YAML.parse(file.source);
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
