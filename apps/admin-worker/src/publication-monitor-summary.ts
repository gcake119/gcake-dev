import { D1ReleaseStore, type ReleaseDatabase, type ReleaseSnapshot } from './release-queue.js';
import { instant } from '@gcake/publishing-contract/release-queue';

export const PUBLICATION_MONITOR_PATH = '/api/v1/monitoring/publications';
export interface PublicationCatalogue {
  snapshot(): Promise<ReleaseSnapshot>;
  revision(): Promise<string>;
}
const headers = { 'Cache-Control': 'no-store' };
const unavailable = () => Response.json({ error: { code: 'OBSERVATION_UNAVAILABLE' } }, { status: 503, headers });

export async function monitorAuthorized(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const supplied = request.headers.get('authorization') ?? '';
  if (supplied.length > 1024) return false;
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encode.encode(supplied)),
    crypto.subtle.digest('SHA-256', encode.encode('Bearer ' + secret)),
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}

/** Only SELECT and immutable editorial reads are dependencies of this observer. */
export async function publicationSummary(db: ReleaseDatabase, catalogue: PublicationCatalogue, requestId?: string): Promise<Response> {
  try {
    const store = new D1ReleaseStore(db);
    const [stored, snapshot] = await Promise.all([store.read(), catalogue.snapshot()]);
    const data = stored.data;
    if (!Number.isSafeInteger(stored.version) || stored.version < 0 || !snapshot.revision ||
        !Array.isArray(snapshot.posts) || !Array.isArray(snapshot.series) ||
        !Array.isArray(data?.releases) || !Array.isArray(data.paused) ||
        !data.overrides || typeof data.overrides !== 'object') throw new Error('Invalid source');
    const seen = new Set<string>();
    const articles = snapshot.posts.map(post => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || seen.has(post.slug)) throw new Error('Invalid identity');
      seen.add(post.slug);
      const membership = snapshot.series.filter(series => !series.external && series.sections.some(section => section.posts.some(ref => ref.slug === post.slug)));
      if (membership.length > 1) throw new Error('Ambiguous membership');
      const series = membership[0];
      const base = {
        articleId: post.slug,
        canonicalUrl: `https://gcake119.github.io/gcake-dev/posts/${post.slug}/`,
        kind: series ? 'series' : 'standalone',
        ...(series ? { seriesId: series.slug, readingPosition: series.sections.flatMap(s => s.posts).findIndex(p => p.slug === post.slug) + 1 } : {}),
      };
      const records = data.releases.filter(record => record.slug === post.slug);
      const active = records.filter(record => !record.unlockedAt);
      if (active.length > 1) throw new Error('Ambiguous commitment');
      if (data.paused.includes('post:' + post.slug) || (series && (series.paused || data.paused.includes('series:' + series.slug))))
        return { ...base, scheduleState: 'paused' };
      const record = active[0];
      if (record) {
        if (!record.id || !['committed-slot','publishing','awaiting-verification','verified-public','failed','verification-unknown'].includes(record.state)) throw new Error('Invalid commitment');
        instant(record.slot);
        return { ...base, scheduleState: 'confirmed', commitment: { identity: record.id, scheduledAt: record.slot } };
      }
      if (records.length) return { ...base, scheduleState: 'unknown' };
      if (Object.hasOwn(data.overrides, post.slug)) {
        instant(data.overrides[post.slug]);
        return { ...base, scheduleState: 'estimate-only' };
      }
      return { ...base, scheduleState: 'unscheduled' };
    });
    // Repeat reads detect changes during enumeration. Do not return a mixed snapshot.
    const revision = await catalogue.revision();
    const current = await store.read();
    if (current.version !== stored.version || revision !== snapshot.revision) throw new Error('Source changed');
    const payload = { schemaVersion: 1, generatedAt: new Date().toISOString(), gitRevision: snapshot.revision, queueVersion: stored.version, complete: true, articles, ...(requestId===undefined?{}:{requestId}) };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 512 * 1024) throw new Error('Incomplete bounded response');
    return Response.json(payload, { headers });
  } catch {
    return unavailable();
  }
}
