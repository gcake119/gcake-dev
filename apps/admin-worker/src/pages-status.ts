import type { PagesPublicationStatus } from '@gcake/admin-contract';
import { D1ReleaseStore, type ReleaseDatabase } from './release-queue.js';
const validTime = (v:unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const states = new Set(['committed-slot','publishing','awaiting-verification','verified-public','failed','verification-unknown']);
/** Persisted observations only: no queue ingestion, provider reads or verification. */
export async function readPagesStatus(db:ReleaseDatabase, slug:string):Promise<PagesPublicationStatus> {
  const stored = await new D1ReleaseStore(db).read();
  if (!Number.isSafeInteger(stored.version) || stored.version < 0 || !Array.isArray(stored.data?.releases)) throw Error('PAGES_HISTORY_INVALID');
  const history = stored.data.releases.filter(r => r.slug === slug);
  const active = history.filter(r => !r.unlockedAt);
  if (active.length > 1) throw Error('PAGES_HISTORY_AMBIGUOUS');
  const r = active[0];
  if (!r) return {source:'release-queue',state:'not-recorded',historyCount:history.length,deployment:{state:'not-recorded'},verification:{state:'not-verified'}};
  if (!r.id || !states.has(r.state) || !r.sourceRevision || !validTime(r.slot)) throw Error('PAGES_HISTORY_INVALID');
  const canonical = `https://gcake119.github.io/gcake-dev/posts/${slug}/`;
  const page = validTime(r.pageVerifiedAt);
  const verified = r.state === 'verified-public' && page && validTime(r.verifiedAt) && r.rssGuid === canonical && /^[a-f0-9]{64}$/.test(r.publicationDigest ?? '') && !!r.commitSha;
  const deployment = r.deployment;
  const matched = !!r.commitSha && deployment?.commitSha === r.commitSha;
  const deploymentUrl = matched && deployment?.url?.startsWith('https://github.com/gcake119/gcake-dev/actions/runs/') ? deployment.url : undefined;
  return {
    source:'release-queue',state:r.state,historyCount:history.length,releaseId:r.id,sourceRevision:r.sourceRevision,commitSha:r.commitSha,releaseAt:r.slot,
    deployment:{state:deployment ? matched ? deployment.state : 'unknown' : 'not-recorded',...(deploymentUrl ? {url:deploymentUrl} : {})},
    verification:{state:verified ? 'verified' : r.state === 'verified-public' ? 'incomplete' : page ? 'page-only' : 'not-verified',
      ...(verified ? {verifiedAt:r.verifiedAt,publicUrl:canonical} : {}),...(page ? {pageVerifiedAt:r.pageVerifiedAt} : {})},
  };
}
