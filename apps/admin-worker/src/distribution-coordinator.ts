import type { PublicationTargetState } from './publication-operations.js';
import { boundedDistributionError, type RuntimePublicationRepository } from './distribution-runtime.js';
import { ParagraphProductionService, type ParagraphPublicationInput } from './paragraph-provider.js';

export type DistributionTarget = 'paragraph' | 'substack';
export interface DistributionArticle {
  slug: string; sourceRevision: string; title: string; description?: string; body: string;
  substackDatePrecision?: 'minute'; canonicalUrl: string; publishedAt?: string; assets: { source: string; alt: string }[];
}
export interface DistributionApproval {
  target: DistributionTarget; slug: string; sourceRevision: string; approved: true; newsletter: 'skip';
  substackPolicy?: 'full-mirror'; substackDatePrecision?: 'minute';
}
export interface RemoteArticle { id: string; url: string }
export interface SubstackBrowserAdapter {
  readonly publicationPolicy?: 'full-mirror';
  preflight(): Promise<void>;
  find(article: DistributionArticle): Promise<readonly RemoteArticle[]>;
  create(article: DistributionArticle): Promise<RemoteArticle>;
  update(remote: RemoteArticle, article: DistributionArticle): Promise<void>;
  readDraft(remote: RemoteArticle, article: DistributionArticle): Promise<void>;
  checkPublish(remote: RemoteArticle, article: DistributionArticle): Promise<void>;
  publish(remote: RemoteArticle, article: DistributionArticle): Promise<RemoteArticle | void>;
  finalizePublishedDate?(remote: RemoteArticle, article: DistributionArticle): Promise<RemoteArticle | void>;
  verify(remote: RemoteArticle, article: DistributionArticle): Promise<RemoteArticle | void>;
}
export function assertDistributionApproval(article: DistributionArticle, target: DistributionTarget, approval?: DistributionApproval): void {
  if (!approval || approval.approved !== true || approval.newsletter !== 'skip' || approval.slug !== article.slug
    || approval.sourceRevision !== article.sourceRevision || approval.target !== target || target === 'substack' && approval.substackDatePrecision !== article.substackDatePrecision) throw new Error('DISTRIBUTION_APPROVAL_REQUIRED');
}
export class DistributionCoordinator {
  constructor(
    private readonly repository: RuntimePublicationRepository,
    private readonly paragraph: ParagraphProductionService,
    private readonly substack: SubstackBrowserAdapter | undefined,
    private readonly publicationSlug: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async dryRun(article: DistributionArticle, target: DistributionTarget) {
    const current = (await this.repository.listStates(article.slug)).find(s => s.target === target);
    return { target, slug: article.slug, sourceRevision: article.sourceRevision, newsletter: 'skip', externalWriteEnabled: false, operation: current?.remoteId ? 'update-draft' : 'create-draft', remoteId: current?.remoteId, canonicalUrl: article.canonicalUrl, publishedAt: article.publishedAt };
  }
  private paragraphInput(article: DistributionArticle): ParagraphPublicationInput {
    if (!article.publishedAt) throw new Error('DISTRIBUTION_PUBLISHED_AT_REQUIRED');
    return { postSlug: article.slug, sourceRevision: article.sourceRevision, title: article.title, subtitle: article.description, markdown: article.body, canonicalUrl: article.canonicalUrl, publishedAt: article.publishedAt, publicationSlug: this.publicationSlug };
  }
  async run(article: DistributionArticle, target: DistributionTarget, operation: 'prepare' | 'publish' | 'verify' | 'retry' | 'finalize', approval?: DistributionApproval): Promise<PublicationTargetState> {
    if (!article.publishedAt || !Number.isFinite(Date.parse(article.publishedAt)) || Date.parse(article.publishedAt) > Date.now()) throw new Error('DISTRIBUTION_PUBLISHED_AT_INVALID');
    if (operation === 'prepare' || operation === 'publish' || operation === 'finalize') {
      assertDistributionApproval(article, target, approval);
      if (target === 'substack' && approval?.substackPolicy !== this.substack?.publicationPolicy) throw new Error('SUBSTACK_POLICY_APPROVAL_REQUIRED');
    }
    if (operation === 'finalize' && target !== 'substack') throw new Error('DISTRIBUTION_FINALIZE_SUBSTACK_ONLY');
    if (target === 'paragraph') {
      const input = this.paragraphInput(article);
      if (operation === 'verify') return this.paragraph.verify(input);
      if (operation === 'retry') return this.paragraph.reconcile(input);
      if (operation === 'prepare') return this.paragraph.prepareDraft(input, await this.paragraph.dryRun(input));
      await this.paragraph.publish(input, await this.paragraph.dryRun(input));
      return this.paragraph.verify(input);
    }
    const owner = crypto.randomUUID();
    const runtime = this.repository.runtime;
    const isPublic = (item: RemoteArticle | undefined) => !!item && /^\/p\/[^/]+\/?$/.test(new URL(item.url).pathname);
    const record = (operation: 'create' | 'update' | 'publish' | 'metadata') => runtime.record({ postSlug: article.slug, target, sourceRevision: article.sourceRevision, operation, createdAt: this.now(), substackPolicy: this.substack?.publicationPolicy });
    if (!await runtime.acquire(article.slug, target, owner, this.now())) throw new Error('DISTRIBUTION_LOCKED');
    let current: PublicationTargetState | undefined;
    let remote: RemoteArticle | undefined;
    const save = async (status: PublicationTargetState['status'], code?: string) => {
      const state: PublicationTargetState = { ...current, postSlug: article.slug, target, sourceRevision: (await runtime.checkpoint(article.slug, target))?.sourceRevision ?? article.sourceRevision, status, remoteId: remote?.id ?? current?.remoteId, remoteUrl: remote?.url ?? current?.remoteUrl, verifiedAt: status === 'verified' ? this.now() : undefined, lastErrorCode: code, updatedAt: this.now() };
      await this.repository.putState(state); current = state; return state;
    };
    try {
      current = (await this.repository.listStates(article.slug)).find(s => s.target === target);
      remote = current?.remoteId && current.remoteUrl ? { id: current.remoteId, url: current.remoteUrl } : undefined;
      if (current?.remoteId && !current.remoteUrl) throw new Error('SUBSTACK_REMOTE_STATE_MISSING');
      if (!this.substack) throw new Error('SUBSTACK_NOT_CONFIGURED');
      const cp = await runtime.checkpoint(article.slug, target);
      if (cp && cp.sourceRevision !== article.sourceRevision) throw new Error('SUBSTACK_RECONCILIATION_REVISION_MISMATCH');
      if (cp && cp.substackPolicy !== this.substack.publicationPolicy) throw new Error('SUBSTACK_RECONCILIATION_POLICY_MISMATCH');
      if (operation === 'finalize') {
        if (!remote || !cp || !['publish', 'metadata'].includes(cp.operation) || this.substack.publicationPolicy !== 'full-mirror' || !this.substack.finalizePublishedDate) throw new Error('SUBSTACK_FINALIZE_STATE_REQUIRED');
        await record('metadata');
        remote = await this.substack.finalizePublishedDate(remote, article) ?? remote;
        remote = await this.substack.verify(remote, article) ?? remote;
        const result = await save('verified'); await runtime.clear(article.slug, target); return result;
      }
      if (operation === 'verify' || cp?.operation === 'update' && isPublic(remote) || cp?.operation === 'publish' || cp?.operation === 'metadata' || current?.status === 'verified' && current.sourceRevision === article.sourceRevision) {
        if (!remote) throw new Error('SUBSTACK_REMOTE_STATE_MISSING');
        remote = await this.substack.verify(remote, article) ?? remote;
        const result = await save('verified'); await runtime.clear(article.slug, target); return result;
      }
      await this.substack.preflight();
      if (cp) {
        // Lost draft create/update response: discover only, never create on an empty scan.
        const matches = remote ? [remote] : await this.substack.find(article);
        if (matches.length !== 1) throw new Error('SUBSTACK_RECONCILIATION_REQUIRED');
        remote = matches[0];
        await this.substack.readDraft(remote, article);
        const result = await save('pending'); await runtime.clear(article.slug, target); return result;
      }
      if (remote && isPublic(remote) && current?.status !== 'verified' && current?.status !== 'prepare_ready') {
        // A discovered public identity must be adopted by exact anonymous evidence before any overwrite.
        remote = await this.substack.verify(remote, article) ?? remote;
        return await save('verified');
      }
      if (operation === 'retry') throw new Error('SUBSTACK_RETRY_REQUIRES_CHECKPOINT');
      if (!remote) {
        const matches = await this.substack.find(article);
        if (matches.length > 1) throw new Error('SUBSTACK_DUPLICATE_REMOTE');
        const candidate = matches[0];
        remote = candidate;
        if (candidate && isPublic(candidate)) {
          remote = await this.substack.verify(candidate, article) ?? candidate;
          return await save('verified');
        }
        if (candidate) await this.substack.readDraft(candidate, article);
        if (!remote) {
          await record('create');
          remote = await this.substack.create(article);
        }
        await save('pending'); await runtime.clear(article.slug, target);
      }
      if (current?.status === 'verified' && current.sourceRevision !== article.sourceRevision && isPublic(remote)) {
        if (operation !== 'prepare') throw new Error('SUBSTACK_PUBLISHED_UPDATE_PREPARE_REQUIRED');
        await record('update');
        await this.substack.update(remote, article);
        await save('published');
        remote = await this.substack.verify(remote, article) ?? remote;
        const result = await save('verified'); await runtime.clear(article.slug, target); return result;
      }
      if (current?.status === 'prepare_ready' && current.sourceRevision === article.sourceRevision) {
        // Recheck the persisted reviewed draft instead of starting another autosave cycle.
        await this.substack.readDraft(remote, article);
      } else {
        await record('update');
        await this.substack.update(remote, article);
        await save('prepare_ready'); await runtime.clear(article.slug, target);
      }
      if (operation === 'prepare') return current!;
      await this.substack.checkPublish(remote, article);
      await record('publish');
      remote = await this.substack.publish(remote, article) ?? remote;
      await save('published');
      if (this.substack.publicationPolicy === 'full-mirror') {
        if (!this.substack.finalizePublishedDate) throw new Error('SUBSTACK_DATE_CAPABILITY_UNVERIFIED');
        await record('metadata');
        remote = await this.substack.finalizePublishedDate(remote, article) ?? remote;
      }
      remote = await this.substack.verify(remote, article) ?? remote;
      const result = await save('verified'); await runtime.clear(article.slug, target); return result;
    } catch (error) {
      const checkpoint = await runtime.checkpoint(article.slug, target);
      return await save(checkpoint ? 'uncertain' : 'manual_required', boundedDistributionError(error));
    } finally { await runtime.release(article.slug, target, owner); }
  }
}
