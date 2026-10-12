import YAML from 'yaml';
import type { SaveContentRequest, DeploymentObservation, ReleaseRecord } from '@gcake/admin-contract';
import { ReleaseQueue, type ReleaseSnapshot } from './release-queue.js';
import { RepositoryConflictError } from './git-writes.js';
export interface ReleaseGit {
  snapshot(): Promise<ReleaseSnapshot>;
  save(request: SaveContentRequest): Promise<{ commitSha: string; paths: readonly string[] }>;
  deployment?(sha?: string): Promise<DeploymentObservation | undefined>;
  retryDeployment?(sha: string): Promise<void>;
}
function frontmatter(source: string, status: 'ready' | 'published', publishedAt?: string): string {
  const m = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(source);
  if (!m) throw new Error('INVALID_FRONTMATTER');
  const document = YAML.parseDocument(m[2]);
  if (document.errors.length) throw new Error('INVALID_FRONTMATTER');
  document.set('status', status);
  if (publishedAt) document.set('publishedAt', publishedAt);
  return m[1] + document.toString().trimEnd() + m[3] + source.slice(m[0].length);
}
export function publicationFiles(snapshot: ReleaseSnapshot, slug: string, at: string, status: 'ready' | 'published' = 'published') {
  const post = snapshot.posts.find((p) => p.slug === slug);
  if (!post || (post.status !== 'ready' && status === 'published') || (post.status === 'published' && status === 'ready'))
    throw new Error('ARTICLE_NOT_READY');
  const files = [
    {
      path: post.path,
      expectedBlobSha: post.sha,
      source: frontmatter(post.source, status, status === 'published' ? at : undefined),
    },
  ];
  for (const series of snapshot.series) {
    if (!series.sections.some((s) => s.posts.some((p) => p.slug === slug))) continue;
    const doc = YAML.parseDocument(series.source);
    if (doc.errors.length) throw new Error('INVALID_SERIES');
    const sections = doc.get('sections', true) as YAML.YAMLSeq;
    for (const section of sections.items as YAML.YAMLMap[]) {
      const posts = section.get('posts', true) as unknown as YAML.YAMLSeq;
      for (const item of posts.items as YAML.YAMLMap[]) if (item.get('slug') === slug) item.set('status', status);
    }
    files.push({
      path: series.path,
      expectedBlobSha: series.sha,
      source: doc.toString(),
    });
  }
  return files;
}
export async function publicationDigest(source: string): Promise<string> {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function entities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function tag(xml: string, name: string) {
  return entities(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i').exec(xml)?.[1] ?? '').trim();
}
export async function verifyPublicRelease(
  fetcher: typeof fetch,
  base: string,
  slug: string,
  title: string,
  expectedAt?: string,
  expectedRevision?: string,
): Promise<{ page: boolean; rssGuid?: string; url: string; error?: string }> {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('INVALID_CANONICAL_ORIGIN');
  const url = new URL('posts/' + encodeURIComponent(slug) + '/', base).href;
  const get = async (u: string) => {
    const response = await fetcher(u, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('PUBLIC_HTTP_' + response.status);
    return response.text();
  };
  let page = false;
  try {
    const html = await get(url);
    const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
    const canonical = links.find((m) => /\brel=["']canonical["']/i.test(m[1]));
    const href = /\bhref=["']([^"']+)["']/i.exec(canonical?.[1] ?? '')?.[1];
    const metadata = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
      const p = JSON.parse(m[1]);
      return Array.isArray(p) ? p : (p['@graph'] ?? [p]);
    });
    const article = metadata.find((p) => ['BlogPosting', 'Article'].includes(p['@type']));
    page =
      entities(href ?? '') === url &&
      article?.headline === title &&
      Boolean(article.datePublished) &&
      Number.isFinite(Date.parse(article.datePublished)) &&
      (!article.url || article.url === url) &&
      (!expectedAt || Date.parse(article.datePublished) === Date.parse(expectedAt));
    if (!page) return { page: false, url, error: 'PAGE_IDENTITY_MISMATCH' };
    if (expectedRevision) {
      const meta=[...html.matchAll(/<meta\b([^>]+)>/gi)].find(m=>/\bname=["']gcake-source-revision["']/i.test(m[1]));
      const revision=/\bcontent=["']([a-f0-9]{64})["']/i.exec(meta?.[1]??'')?.[1];
      if (revision!==expectedRevision) return {page:false,url,error:'PAGE_SOURCE_MISMATCH'};
    }
    const rss = await get(new URL('rss.xml', base).href);
    const item = [...rss.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].find(
      (m) => tag(m[1], 'link') === url && tag(m[1], 'title') === title,
    );
    const guid = item ? tag(item[1], 'guid') : undefined;
    return {
      page,
      url,
      rssGuid: guid === url ? guid : undefined,
      error: guid === url ? undefined : 'RSS_PENDING',
    };
  } catch {
    return { page, url, error: page ? 'RSS_UNAVAILABLE' : 'PAGE_UNAVAILABLE' };
  }
}
export class ReleaseDelivery {
  constructor(
    readonly queue: ReleaseQueue,
    readonly git: ReleaseGit,
    readonly enabled = false,
    readonly fetcher: typeof fetch = fetch,
    readonly base = 'https://gcake119.github.io/gcake-dev/',
  ) {}
  async publishNow(slug:string,version:number,revision:string,actor:string) {
    if(!this.enabled)throw new Error('RELEASE_DISABLED');
    const snapshot=await this.git.snapshot();
    const intent=await this.queue.acquireManual(snapshot,slug,version,revision,actor,true);
    return intent.created?this.write(intent.record,snapshot):intent.record;
  }
  async execute() {
    if (!this.enabled) throw new Error('RELEASE_DISABLED');
    const snapshot = await this.git.snapshot();
    const r = await this.queue.acquire(snapshot, true);
    return r ? this.write(r, snapshot) : undefined;
  }
  private async write(r: ReleaseRecord, snapshot: ReleaseSnapshot) {
    // Revalidate against a fresh complete Git revision immediately before a write.
    const latest = await this.git.snapshot();
    if (latest.revision !== snapshot.revision)
      return this.queue.record(r.id, r.lease, { state: 'failed', error: 'GIT_CONFLICT' }, 'revision-conflict');
    const view = await this.queue.view(latest);
    const item = view.items.find((p) => p.slug === r.slug);
    if (!item || item.reason || item.contentStatus !== 'ready')
      return this.queue.record(r.id, r.lease, { state: 'failed', error: 'ELIGIBILITY_CHANGED' }, 'eligibility-changed');
    const files = publicationFiles(latest, r.slug, r.slot);
    // Persist expected public bytes before any external write; lost replies keep this evidence.
    await this.queue.record(r.id,r.lease,{publicationDigest:await publicationDigest(files[0].source)},'publication-source');
    await this.queue.beginWrite(r.id, r.lease);
    try {
      const result = await this.git.save({
        expectedBaseCommitSha: latest.revision,
        message: 'Publish ' + r.slug + ' [release:' + r.id + ']',
        files,
      });
      return await this.queue.record(
        r.id,
        r.lease,
        {
          state: 'awaiting-verification',
          commitSha: result.commitSha,
          error: undefined,
          nextRetryAt: new Date(Date.parse(this.queue.now()) + 3600000).toISOString(),
        },
        'git-committed',
      );
    } catch (error) {
      return this.queue.record(
        r.id,
        r.lease,
        {
          state: error instanceof RepositoryConflictError ? 'failed' : 'verification-unknown',
          error: error instanceof RepositoryConflictError ? 'GIT_CONFLICT' : 'GIT_WRITE_UNKNOWN',
        },
        'git-write-result',
      );
    }
  }
  async reverify(id: string) {
    const snapshot = await this.git.snapshot();
    const view = await this.queue.view(snapshot);
    const r = view.releases.find((r) => r.id === id);
    if (!r) throw new Error('NOT_FOUND');
    if (r.unlockedAt) throw new Error('REVERIFY_REQUIRED');
    if (r.state === 'verified-public') return r;
    if (r.state === 'publishing' && Date.parse(r.leaseUntil) > Date.parse(this.queue.now())) throw new Error('LEASE_ACTIVE');
    const post = snapshot.posts.find((p) => p.slug === r.slug);
    if (!post) throw new Error('ARTICLE_NOT_FOUND');
    const membership=snapshot.series.find(series=>series.slug===r.seriesSlug);
    const mismatch=!r.publicationDigest ? 'PUBLICATION_DIGEST_REQUIRED' :
      post.status!=='published' || Date.parse(post.publishedAt??'')!==Date.parse(r.slot) ||
      await publicationDigest(post.source)!==r.publicationDigest ||
      (r.seriesSlug && !membership?.sections.some(section=>section.posts.some(p=>p.slug===r.slug && p.status==='published')))
        ? 'PENDING_SOURCE_CHANGED' : undefined;
    if(mismatch) return this.queue.record(r.id,r.lease,{state:'verification-unknown',error:mismatch},'source-reconciliation-required');
    const result = await verifyPublicRelease(this.fetcher, this.base, r.slug, post.title, r.slot, r.publicationDigest);
    const deployment = await this.git.deployment?.(r.commitSha);
    return this.queue.record(
      r.id,
      r.lease,
      {
        state:
          result.page && result.rssGuid ? 'verified-public' : r.commitSha || result.page ? 'awaiting-verification' : 'verification-unknown',
        pageVerifiedAt: result.page ? this.queue.now() : undefined,
        rssGuid: result.rssGuid,
        verifiedAt: result.page && result.rssGuid ? this.queue.now() : undefined,
        error: result.error,
        deployment: deployment?.commitSha === r.commitSha ? deployment : r.deployment,
        nextRetryAt: result.page && result.rssGuid ? undefined : new Date(Date.parse(this.queue.now()) + 3600000).toISOString(),
      },
      'public-verification',
    );
  }
  async retry(id: string) {
    if (!this.enabled) throw new Error('RELEASE_DISABLED');
    const snapshot = await this.git.snapshot();
    const r = (await this.queue.view(snapshot)).releases.find((r) => r.id === id);
    if (!r) throw new Error('NOT_FOUND');
    if (r.unlockedAt) throw new Error('REVERIFY_REQUIRED');
    if (r.state === 'failed' && ['GIT_CONFLICT', 'ELIGIBILITY_CHANGED'].includes(r.error ?? '') && !r.commitSha) {
      const next = await this.queue.retryLease(id);
      return this.write({ ...next, sourceRevision: snapshot.revision }, snapshot);
    }
    if (r.commitSha) {
      const deployment = await this.git.deployment?.(r.commitSha);
      if (deployment?.commitSha !== r.commitSha || deployment.state !== 'failed') throw new Error('REVERIFY_REQUIRED');
      if (!this.git.retryDeployment) throw new Error('DEPLOYMENT_RETRY_NOT_CONFIGURED');
      await this.git.retryDeployment(r.commitSha);
      return this.queue.record(r.id, r.lease, { state: 'awaiting-verification', deployment, error: undefined }, 'deployment-retried');
    }
    throw new Error('REVERIFY_REQUIRED');
  }
  async finalize(slug: string, revision: string, blobSha: string, source: string) {
    const snapshot = await this.git.snapshot();
    const post = snapshot.posts.find((p) => p.slug === slug);
    if (!post || snapshot.revision !== revision || post.sha !== blobSha) throw new Error('GIT_CONFLICT');
    const updated = {
      ...snapshot,
      posts: snapshot.posts.map((p) => (p.slug === slug ? { ...p, source } : p)),
    };
    const result = await this.git.save({
      expectedBaseCommitSha: revision,
      message: 'Finalize ' + slug,
      files: publicationFiles(updated, slug, '', 'ready'),
    });
    await this.queue.ingest(await this.git.snapshot());
    return result;
  }
}
