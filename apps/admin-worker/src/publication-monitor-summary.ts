import type { ScheduleRecord } from './substack-schedules.js';
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


/** Existing monitor authority: disclose verified public evidence, never draft records. */
async function substackPublications(db: ReleaseDatabase, posts: ReleaseSnapshot['posts']) {
  try {
    const read = async () => {
      const row = await db.prepare('SELECT json_group_array(record_json) AS records FROM (SELECT record_json FROM publication_schedules ORDER BY schedule_id LIMIT 10001)').first<{records: string}>();
      if (!row || typeof row.records !== 'string' || row.records.length > 4 * 1024 * 1024) throw new Error('Unavailable schedules');
      return row.records;
    };
    const raw = await read();
    const encoded: unknown = JSON.parse(raw);
    if (!Array.isArray(encoded) || encoded.length > 10000 || encoded.some(value => typeof value !== 'string')) throw new Error('Invalid schedules');
    const now = Date.now();
    const fresh = (at: unknown) => typeof at === 'string' && Number.isFinite(Date.parse(at)) && now - Date.parse(at) >= -5000 && now - Date.parse(at) <= 3600000;
    const revision = (value: unknown) => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
    const publications: {slug:string;id:string;revision:string;title:string;confirmedAt:string;actualAt:string;differenceSeconds:number}[] = [];
    for (const value of encoded) {
      const record = JSON.parse(value) as ScheduleRecord;
      if (!record || record.policyVersion !== 'scheduled-source-first-delivery-v1' || record.observedState !== 'verified' || record.verification?.status !== 'verified' || record.intent || record.pendingAction || record.lastErrorCode) continue;
      const post = posts.find(post => post.slug === record.slug);
      const proof = record.publicationEvidence;
      const url = 'https://gcakedev.substack.com/p/' + record.slug;
      if (!post || !['ready','published'].includes(post.status) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug) || !record.remoteId || !/^[0-9]{1,30}$/.test(record.remoteId) || record.remoteUrl !== url || record.expectedPublicUrl && record.expectedPublicUrl !== url) continue;
      if (!revision(record.contentDigest) || !revision(record.contentVerifiedRevision) || record.sourceRevision !== record.contentVerifiedRevision || !fresh(record.verifiedAt) || !fresh(record.verification.checkedAt)) continue;
      const current = 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(post.source))), byte => byte.toString(16).padStart(2,'0')).join('');
      if (record.contentVerifiedRevision !== current || !proof || proof.title !== post.title || typeof proof.title !== 'string' || !proof.title.length || proof.title.length > 300 || /[\x00-\x1f\x7f]/.test(proof.title)) continue;
      if (typeof proof.actualAt !== 'string' || !Number.isFinite(Date.parse(proof.actualAt)) || Date.parse(proof.actualAt) > now + 5000) continue;
      let notificationRevision: string, confirmedAt: string, differenceSeconds: number;
      let actualAt = proof.actualAt;
      if (record.publicationAuthorization !== undefined) {
        const authorization = record.publicationAuthorization;
        // Immediate approval is separate authority, never an inferred scheduled slot.
        if (!authorization || authorization.kind !== 'immediate' || record.everPublished !== true || record.armedRevision !== undefined || record.slot !== undefined || proof.confirmedAt !== undefined || proof.differenceSeconds !== undefined) continue;
        if (typeof authorization.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(authorization.operationId) || !revision(authorization.sourceRevision)) continue;
        if (typeof authorization.authorizedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(authorization.authorizedAt) || !Number.isFinite(Date.parse(authorization.authorizedAt)) || Date.parse(authorization.authorizedAt) > Date.parse(proof.actualAt)) continue;
        notificationRevision = authorization.sourceRevision;
        // Both runtimes must compute the interval from the same millisecond instants.
        confirmedAt = new Date(authorization.authorizedAt).toISOString();
        actualAt = new Date(proof.actualAt).toISOString();
        differenceSeconds = (Date.parse(actualAt) - Date.parse(confirmedAt)) / 1000;
      } else {
        if (!revision(record.armedRevision) || typeof proof.confirmedAt !== 'string' || !Number.isFinite(Date.parse(proof.confirmedAt)) || typeof proof.differenceSeconds !== 'number' || !Number.isFinite(proof.differenceSeconds) || Math.abs((Date.parse(proof.actualAt)-Date.parse(proof.confirmedAt))/1000-proof.differenceSeconds)>0.000001) continue;
        if (!record.slot?.confirmed || record.slot.slug !== record.slug || Date.parse(record.slot.scheduledAt) !== Date.parse(proof.confirmedAt)) continue;
        notificationRevision = record.armedRevision!;
        confirmedAt = proof.confirmedAt;
        differenceSeconds = proof.differenceSeconds;
      }
      publications.push({slug:record.slug,id:record.remoteId,revision:notificationRevision,title:proof.title,confirmedAt,actualAt,differenceSeconds});
    }
    if (new Set(publications.map(p=>p.slug)).size !== publications.length || new Set(publications.map(p=>p.id)).size !== publications.length || await read() !== raw) throw new Error('Changed schedule authority');
    return {complete:true,publications};
  } catch {
    return {complete:false,publications:[]};
  }
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
    const substack = await substackPublications(db, snapshot.posts);
    const revision = await catalogue.revision();
    const current = await store.read();
    if (current.version !== stored.version || revision !== snapshot.revision) throw new Error('Source changed');
    const payload = { substackPublications: substack, schemaVersion: 1, generatedAt: new Date().toISOString(), gitRevision: snapshot.revision, queueVersion: stored.version, complete: true, articles, ...(requestId===undefined?{}:{requestId}) };
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 512 * 1024) throw new Error('Incomplete bounded response');
    return Response.json(payload, { headers });
  } catch {
    return unavailable();
  }
}
