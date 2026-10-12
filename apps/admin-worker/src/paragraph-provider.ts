import { marked } from 'marked';
import type { PublicationRepository, PublicationTargetState } from './publication-operations.js';
import { boundedDistributionError, type DistributionRuntime } from './distribution-runtime.js';
import { assertParagraphProductionGate, controlledCohortGate, type ParagraphProductionGate, type ParagraphTrialAuthorization } from './paragraph-gate.js';

export const PARAGRAPH_OPENAPI_COMMIT = '56c2fd279cfad810dab400236773406e41080d65' as const;
export const PARAGRAPH_API_BASE_URL = 'https://public.api.paragraph.com/api' as const;

export interface ParagraphPublicationInput {
  readonly postSlug: string;
  readonly sourceRevision: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly markdown: string;
  readonly canonicalUrl: string;
  readonly publishedAt: string;
  readonly publicationSlug: string;
}

export interface ParagraphPostEvidence {
  readonly id: string;
  readonly title?: string;
  readonly slug: string;
  readonly status?: 'draft' | 'published' | 'archived';
  readonly publishedAt?: string | number;
  readonly markdown?: string;
  readonly canonicalUrl?: string;
}

export interface ParagraphProviderClient {
  assertPublicationSlug?(slug: string): Promise<void>;
  findOwnBySlug(slug: string): Promise<readonly { readonly id: string }[]>;
  createDraft(input: ParagraphPublicationInput): Promise<{ readonly id: string }>;
  updateDraft(remoteId: string, input: ParagraphPublicationInput): Promise<void>;
  publish(remoteId: string, input: ParagraphPublicationInput): Promise<void>;
  readPrivate(remoteId: string): Promise<ParagraphPostEvidence | undefined>;
  readPublic(publicationSlug: string, postSlug: string): Promise<ParagraphPostEvidence | undefined>;
  readPublicHtml(remoteUrl: string): Promise<string>;
}

export interface ParagraphDryRunReceipt {
  readonly version: 1;
  readonly operation: 'create' | 'update';
  readonly postSlug: string;
  readonly sourceRevision: string;
  readonly remoteId?: string;
  readonly inputHash: string;
  readonly sendNewsletter: false;
}

function publishedAtMilliseconds(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('PARAGRAPH_PUBLISHED_AT_INVALID');
  return timestamp;
}

async function inputHash(input: ParagraphPublicationInput): Promise<string> {
  const stable = JSON.stringify([
    input.postSlug, input.sourceRevision, input.title, input.subtitle ?? '', input.markdown,
    input.canonicalUrl, input.publishedAt, input.publicationSlug,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function boundedProviderError(response: Response): Promise<Error> {
  return new Error(`PARAGRAPH_PROVIDER_HTTP_${response.status}`);
}

export class ParagraphRestClient implements ParagraphProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly baseUrl: string = PARAGRAPH_API_BASE_URL,
  ) {
    if (!apiKey) throw new Error('PARAGRAPH_API_KEY_REQUIRED');
  }

  private async api(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) throw await boundedProviderError(response);
    return response;
  }

  async assertPublicationSlug(slug: string): Promise<void> {
    const identity = await (await this.api('/v1/me')).json() as { slug?: unknown };
    if (identity.slug !== slug) throw new Error('PARAGRAPH_PUBLICATION_IDENTITY_MISMATCH');
  }

  async findOwnBySlug(slug: string): Promise<readonly { readonly id: string }[]> {
    const matches = new Set<string>();
    // The official list defaults to published; drafts must also be reconciled.
    for (const status of ['published', 'draft', 'scheduled', 'archived']) {
      const cursors = new Set<string>();
      let cursor: string | undefined, complete = false;
      for (let page = 0; page < 100; page++) {
        const response = await this.api(`/v1/posts?limit=100&status=${status}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
        const payload = await response.json() as { items?: { id?: unknown; slug?: unknown }[]; pagination?: { hasMore?: boolean; cursor?: unknown } };
        if (!Array.isArray(payload.items)) throw new Error('PARAGRAPH_REMOTE_SCAN_INCOMPLETE');
        for (const post of payload.items) if (post.slug === slug && typeof post.id === 'string' && post.id) matches.add(post.id);
        if (payload.pagination?.hasMore === false) { complete = true; break; }
        if (!payload.pagination || payload.pagination.hasMore !== true || typeof payload.pagination.cursor !== 'string' || !payload.pagination.cursor || cursors.has(payload.pagination.cursor)) throw new Error('PARAGRAPH_REMOTE_SCAN_INCOMPLETE');
        cursor = payload.pagination.cursor; cursors.add(cursor);
      }
      if (!complete) throw new Error('PARAGRAPH_REMOTE_SCAN_INCOMPLETE');
    }
    return [...matches].map(id => ({ id }));
  }

  async createDraft(input: ParagraphPublicationInput): Promise<{ readonly id: string }> {
    const response = await this.api('/v1/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        subtitle: input.subtitle,
        slug: input.postSlug,
        markdown: input.markdown,
        status: 'draft',
        sendNewsletter: false,
      }),
    });
    const payload = await response.json() as { readonly id?: unknown };
    if (typeof payload.id !== 'string' || !payload.id) throw new Error('PARAGRAPH_CREATE_RESPONSE_INVALID');
    return { id: payload.id };
  }

  async updateDraft(remoteId: string, input: ParagraphPublicationInput): Promise<void> {
    await this.api(`/v1/posts/${encodeURIComponent(remoteId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: input.title,
        subtitle: input.subtitle,
        slug: input.postSlug,
        markdown: input.markdown,
        canonicalUrl: input.canonicalUrl,
        publishedAt: publishedAtMilliseconds(input.publishedAt),
        sendNewsletter: false,
      }),
    });
  }

  async publish(remoteId: string, input: ParagraphPublicationInput): Promise<void> {
    await this.api(`/v1/posts/${encodeURIComponent(remoteId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'published',
        publishOnline: true,
        canonicalUrl: input.canonicalUrl,
        publishedAt: publishedAtMilliseconds(input.publishedAt),
        sendNewsletter: false,
      }),
    });
  }

  async readPrivate(remoteId: string): Promise<ParagraphPostEvidence | undefined> {
    const response = await this.api(`/v1/posts/${encodeURIComponent(remoteId)}?includeContent=true`);
    return await response.json() as ParagraphPostEvidence;
  }

  async readPublic(publicationSlug: string, postSlug: string): Promise<ParagraphPostEvidence | undefined> {
    const response = await this.fetchImplementation(`${this.baseUrl}/v1/publications/slug/${encodeURIComponent(publicationSlug)}/posts/slug/${encodeURIComponent(postSlug)}?includeContent=true`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw await boundedProviderError(response);
    return await response.json() as ParagraphPostEvidence;
  }

  async readPublicHtml(remoteUrl: string): Promise<string> {
    const response = await this.fetchImplementation(remoteUrl);
    if (!response.ok) throw await boundedProviderError(response);
    return response.text();
  }
}

function canonicalFromHtml(html: string): string | undefined {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const link of links) {
    const rel = link.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase().split(/\s+/);
    if (!rel?.includes('canonical')) continue;
    return link.match(/\bhref=["']([^"']+)["']/i)?.[1];
  }
  return undefined;
}

function containsSourceText(remoteMarkdown: string | undefined, sourceMarkdown: string): boolean {
  if (!remoteMarkdown) return false;
  const signature = (markdown: string) => {
    const tokens = marked.lexer(markdown), references: string[] = [];
    marked.walkTokens(tokens, token => {
      if (token.type === 'link' || token.type === 'image') references.push(`${token.type}:${token.href}:${token.text}`);
    });
    const text = marked.parse(markdown, { async: false }).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return JSON.stringify({ text, references: references.sort() });
  };
  return signature(remoteMarkdown) === signature(sourceMarkdown);
}

function publicEvidenceMatches(input: ParagraphPublicationInput, remoteId: string, evidence: ParagraphPostEvidence | undefined): boolean {
  return !!evidence
    && evidence.id === remoteId
    && evidence.slug === input.postSlug
    && evidence.title === input.title
    && (typeof evidence.publishedAt === 'number' || /^\d+$/.test(evidence.publishedAt ?? '') ? Number(evidence.publishedAt) : Date.parse(evidence.publishedAt ?? '')) === publishedAtMilliseconds(input.publishedAt)
    && containsSourceText(evidence.markdown, input.markdown);
}

export class ParagraphProductionService {
  constructor(
    private readonly repository: PublicationRepository,
    private readonly client: ParagraphProviderClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly gate?: ParagraphProductionGate,
    private readonly runtime: DistributionRuntime | undefined = (repository as PublicationRepository & { runtime?: DistributionRuntime }).runtime,
    private readonly trial?: ParagraphTrialAuthorization,
    private readonly beforeWrite?: () => Promise<unknown>,
  ) {}

  private async authorizeWrite(input: ParagraphPublicationInput, operation: 'prepare' | 'publish') {
    if (!this.trial) return assertParagraphProductionGate(this.gate ?? controlledCohortGate(input.publicationSlug, input.postSlug));
    const trial = this.trial;
    if (trial.kind !== 'controlled-trial' || trial.approved !== true || trial.newsletter !== 'skip'
      || trial.postSlug !== input.postSlug || trial.sourceRevision !== input.sourceRevision
      || trial.publicationSlug !== input.publicationSlug || trial.operation !== operation) throw new Error('PARAGRAPH_TRIAL_SCOPE_MISMATCH');
    if (operation === 'publish') {
      const state = await this.existingState(input.postSlug);
      if (!state?.remoteId || !['prepare_ready', 'verified'].includes(state.status) || state.sourceRevision !== input.sourceRevision) throw new Error('PARAGRAPH_TRIAL_PREPARED_DRAFT_REQUIRED');
    }
    if (!this.client.assertPublicationSlug) throw new Error('PARAGRAPH_PUBLICATION_IDENTITY_REQUIRED');
    await this.client.assertPublicationSlug(input.publicationSlug);
  }

  private async existingState(postSlug: string): Promise<PublicationTargetState | undefined> {
    return (await this.repository.listStates(postSlug)).find((state) => state.target === 'paragraph');
  }

  async dryRun(input: ParagraphPublicationInput): Promise<ParagraphDryRunReceipt> {
    const existing = await this.existingState(input.postSlug);
    return {
      version: 1,
      operation: existing?.remoteId ? 'update' : 'create',
      postSlug: input.postSlug,
      sourceRevision: input.sourceRevision,
      remoteId: existing?.remoteId,
      inputHash: await inputHash(input),
      sendNewsletter: false,
    };
  }

  async publish(input: ParagraphPublicationInput, receipt: ParagraphDryRunReceipt): Promise<PublicationTargetState> {
    await this.authorizeWrite(input, 'publish');
    if (!this.runtime) throw new Error('PARAGRAPH_DURABLE_RUNTIME_REQUIRED');
    const owner = crypto.randomUUID();
    if (!await this.runtime.acquire(input.postSlug, 'paragraph', owner, this.now())) throw new Error('DISTRIBUTION_LOCKED');
    try { return await this.publishLocked(input, receipt); }
    finally { await this.runtime.release(input.postSlug, 'paragraph', owner); }
  }

  async prepareDraft(input: ParagraphPublicationInput, receipt: ParagraphDryRunReceipt): Promise<PublicationTargetState> {
    await this.authorizeWrite(input, 'prepare');
    if (!this.runtime) throw new Error('PARAGRAPH_DURABLE_RUNTIME_REQUIRED');
    const owner = crypto.randomUUID();
    if (!await this.runtime.acquire(input.postSlug, 'paragraph', owner, this.now())) throw new Error('DISTRIBUTION_LOCKED');
    try { return await this.publishLocked(input, receipt, true); }
    finally { await this.runtime.release(input.postSlug, 'paragraph', owner); }
  }

  private async publishLocked(input: ParagraphPublicationInput, receipt: ParagraphDryRunReceipt, draftOnly = false): Promise<PublicationTargetState> {
    if (await this.runtime!.checkpoint(input.postSlug, 'paragraph')) throw new Error('PARAGRAPH_RECONCILIATION_REQUIRED');
    const current = await this.existingState(input.postSlug);
    const expectedOperation = current?.remoteId ? 'update' : 'create';
    if (receipt.version !== 1 || receipt.postSlug !== input.postSlug || receipt.sourceRevision !== input.sourceRevision
      || receipt.operation !== expectedOperation || receipt.remoteId !== current?.remoteId
      || receipt.sendNewsletter !== false || receipt.inputHash !== await inputHash(input)) {
      throw new Error('PARAGRAPH_DRY_RUN_MISMATCH');
    }

    let remoteId = current?.remoteId;
    const remoteUrl = `https://paragraph.com/@${input.publicationSlug}/${input.postSlug}`;
    try {
      if (current?.status === 'verified' && current.sourceRevision === input.sourceRevision) return await this.verifyLocked(input);
      if (this.trial && !draftOnly) {
        if (!remoteId || current?.status !== 'prepare_ready' || current.sourceRevision !== input.sourceRevision) throw new Error('PARAGRAPH_TRIAL_PREPARED_DRAFT_REQUIRED');
        const evidence = await this.client.readPrivate(remoteId);
        if (!publicEvidenceMatches(input, remoteId, evidence) || evidence?.canonicalUrl !== input.canonicalUrl) throw new Error('PARAGRAPH_DRAFT_EVIDENCE_MISMATCH');
        if (evidence.status === 'published') return await this.verifyLocked(input);
        if (evidence.status !== 'draft') throw new Error('PARAGRAPH_DRAFT_EVIDENCE_MISMATCH');
        // Publishing approval cannot rewrite the draft reviewed in the prepare stage.
        await this.checkpoint(input, 'publish');
        await this.client.publish(remoteId, input);
        const state: PublicationTargetState = { ...current, status: 'published', verifiedAt: undefined, updatedAt: this.now() };
        await this.repository.putState(state); return state;
      }
      if (!remoteId) {
        const matches = await this.client.findOwnBySlug(input.postSlug);
        if (matches.length > 1) throw new Error('PARAGRAPH_REMOTE_SLUG_AMBIGUOUS');
        const candidateId = matches[0]?.id;
        if (candidateId) {
          const existingEvidence = await this.client.readPrivate(candidateId);
          if (!existingEvidence || existingEvidence.title !== input.title || existingEvidence.slug !== input.postSlug || !containsSourceText(existingEvidence.markdown, input.markdown)) throw new Error('PARAGRAPH_EXISTING_ARTICLE_REQUIRES_RECONCILIATION');
          remoteId = candidateId;
        }
        if (!remoteId) {
          await this.checkpoint(input, 'create');
          remoteId = (await this.client.createDraft(input)).id;
        }
        await this.repository.putState({
          postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
          status: 'pending', remoteId, remoteUrl, updatedAt: this.now(),
        });
      }
      if (draftOnly && current?.status === 'verified' && current.sourceRevision !== input.sourceRevision && current.remoteId === remoteId) {
        const saved = await this.client.readPrivate(remoteId);
        if (saved?.id !== remoteId || saved.slug !== input.postSlug || saved.status !== 'published' || saved.canonicalUrl !== input.canonicalUrl) throw new Error('PARAGRAPH_EXISTING_ARTICLE_REQUIRES_RECONCILIATION');
        await this.checkpoint(input, 'update');
        await this.client.updateDraft(remoteId, input);
        await this.repository.putState({ ...current, sourceRevision: input.sourceRevision, status: 'published', verifiedAt: undefined, updatedAt: this.now() });
        return await this.verifyLocked(input);
      }
      if (this.trial && draftOnly) {
        const saved = await this.client.readPrivate(remoteId);
        if (saved?.status === 'published') {
          if (!publicEvidenceMatches(input, remoteId, saved) || saved.canonicalUrl !== input.canonicalUrl) throw new Error('PARAGRAPH_EXISTING_ARTICLE_REQUIRES_RECONCILIATION');
          return await this.verifyLocked(input);
        }
      }
      await this.runtime!.clear(input.postSlug, 'paragraph');
      await this.checkpoint(input, 'update');
      await this.client.updateDraft(remoteId, input);
      if (draftOnly) {
        if (this.trial) {
          const evidence = await this.client.readPrivate(remoteId);
          if (!publicEvidenceMatches(input, remoteId, evidence) || evidence?.status !== 'draft' || evidence.canonicalUrl !== input.canonicalUrl) throw new Error('PARAGRAPH_DRAFT_EVIDENCE_MISMATCH');
        }
        const state: PublicationTargetState = { ...current, postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision, remoteId, remoteUrl, status: 'prepare_ready', updatedAt: this.now() };
        await this.repository.putState(state); await this.runtime!.clear(input.postSlug, 'paragraph'); return state;
      }
      await this.runtime!.clear(input.postSlug, 'paragraph');
      await this.checkpoint(input, 'publish');
      await this.client.publish(remoteId, input);
      const state: PublicationTargetState = {
        ...current, postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
        status: 'published', remoteId, remoteUrl, verifiedAt: undefined, updatedAt: this.now(),
      };
      await this.repository.putState(state);
      return state;
    } catch (error) {
      await this.repository.putState({
        ...current, postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
        status: await this.runtime!.checkpoint(input.postSlug, 'paragraph') ? 'uncertain' : 'failed', verifiedAt: undefined, remoteId, remoteUrl: remoteId ? remoteUrl : undefined,
        lastErrorCode: boundedDistributionError(error),
        updatedAt: this.now(),
      });
      throw error;
    }
  }

  private async checkpoint(input: ParagraphPublicationInput, operation: 'create' | 'update' | 'publish') {
    await this.beforeWrite?.();
    await this.runtime!.record({ postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision, operation, createdAt: this.now() });
  }

  async reconcile(input: ParagraphPublicationInput): Promise<PublicationTargetState> {
    if (!this.runtime) throw new Error('PARAGRAPH_DURABLE_RUNTIME_REQUIRED');
    const owner = crypto.randomUUID();
    if (!await this.runtime.acquire(input.postSlug, 'paragraph', owner, this.now())) throw new Error('DISTRIBUTION_LOCKED');
    try {
      const checkpoint = await this.runtime.checkpoint(input.postSlug, 'paragraph');
      if (checkpoint && checkpoint.sourceRevision !== input.sourceRevision) throw new Error('PARAGRAPH_RECONCILIATION_REVISION_MISMATCH');
      if (checkpoint?.operation === 'publish') return this.verifyLocked(input);
      const current = await this.existingState(input.postSlug);
      const matches = current?.remoteId ? [{ id: current.remoteId }] : await this.client.findOwnBySlug(input.postSlug);
      if (matches.length !== 1) throw new Error('PARAGRAPH_RECONCILIATION_REQUIRED');
      const evidence = await this.client.readPrivate(matches[0].id);
      if (checkpoint?.operation === 'update' && current?.remoteId === matches[0].id && evidence?.status === 'published') return await this.verifyLocked(input);
      if (!evidence || evidence.title !== input.title || evidence.slug !== input.postSlug || !containsSourceText(evidence.markdown, input.markdown)) throw new Error('PARAGRAPH_RECONCILIATION_REQUIRED');
      const state: PublicationTargetState = { ...current, postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision, remoteId: matches[0].id, remoteUrl: `https://paragraph.com/@${input.publicationSlug}/${input.postSlug}`, status: 'pending', lastErrorCode: undefined, updatedAt: this.now() };
      await this.repository.putState(state);
      await this.runtime.clear(input.postSlug, 'paragraph');
      return state;
    } finally { await this.runtime.release(input.postSlug, 'paragraph', owner); }
  }

  async verify(input: ParagraphPublicationInput): Promise<PublicationTargetState> {
    if (!this.runtime) throw new Error('PARAGRAPH_DURABLE_RUNTIME_REQUIRED');
    const owner = crypto.randomUUID();
    if (!await this.runtime.acquire(input.postSlug, 'paragraph', owner, this.now())) throw new Error('DISTRIBUTION_LOCKED');
    try { return await this.verifyLocked(input); }
    catch (error) {
      const current = await this.existingState(input.postSlug);
      if (current) await this.repository.putState({ ...current, status: await this.runtime.checkpoint(input.postSlug, 'paragraph') ? 'uncertain' : 'failed', verifiedAt: undefined, lastErrorCode: boundedDistributionError(error), updatedAt: this.now() });
      throw error;
    }
    finally { await this.runtime.release(input.postSlug, 'paragraph', owner); }
  }

  private async verifyLocked(input: ParagraphPublicationInput): Promise<PublicationTargetState> {
    const current = await this.existingState(input.postSlug);
    if (!current?.remoteId || current.sourceRevision !== input.sourceRevision) {
      throw new Error('PARAGRAPH_REMOTE_STATE_MISSING');
    }
    const expectedUrl = `https://paragraph.com/@${input.publicationSlug}/${input.postSlug}`;
    if (current.remoteUrl && current.remoteUrl !== expectedUrl) throw new Error('PARAGRAPH_REMOTE_URL_MISMATCH');
    const privateEvidence = await this.client.readPrivate(current.remoteId);
    if (!publicEvidenceMatches(input, current.remoteId, privateEvidence) || privateEvidence?.status !== 'published') {
      throw new Error('PARAGRAPH_PRIVATE_EVIDENCE_MISMATCH');
    }
    const publicEvidence = await this.client.readPublic(input.publicationSlug, input.postSlug);
    if (!publicEvidenceMatches(input, current.remoteId, publicEvidence)) throw new Error('PARAGRAPH_PUBLIC_EVIDENCE_MISMATCH');
    const publicHtml = await this.client.readPublicHtml(current.remoteUrl ?? `https://paragraph.com/@${input.publicationSlug}/${input.postSlug}`);
    if (canonicalFromHtml(publicHtml) !== input.canonicalUrl) throw new Error('PARAGRAPH_PUBLIC_CANONICAL_MISMATCH');
    const state: PublicationTargetState = {
      ...current,
      status: 'verified',
      verifiedAt: this.now(),
      lastErrorCode: undefined,
      updatedAt: this.now(),
    };
    await this.repository.putState(state);
    await this.runtime?.clear(input.postSlug, 'paragraph');
    return state;
  }
}
