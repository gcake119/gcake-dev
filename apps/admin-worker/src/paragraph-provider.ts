import type { PublicationRepository, PublicationTargetState } from './publication-operations.js';
import { assertParagraphProductionGate, controlledCohortGate } from './paragraph-gate.js';

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
  readonly slug: string;
  readonly status?: 'draft' | 'published' | 'archived';
  readonly publishedAt?: string | number;
  readonly markdown?: string;
}

export interface ParagraphProviderClient {
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
  const raw = (await response.text()).slice(0, 500).replace(/[\r\n\t]+/g, ' ');
  let diagnostic = raw;
  try {
    const parsed = JSON.parse(raw) as { readonly code?: unknown; readonly message?: unknown; readonly error?: unknown };
    diagnostic = [parsed.code, parsed.message, parsed.error].find((value) => typeof value === 'string') as string ?? '';
  } catch {
    // Keep the already bounded plain-text diagnostic.
  }
  return new Error(`PARAGRAPH_PROVIDER_HTTP_${response.status}${diagnostic ? `:${diagnostic.slice(0, 300)}` : ''}`);
}

export class ParagraphRestClient implements ParagraphProviderClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly baseUrl = PARAGRAPH_API_BASE_URL,
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

  async findOwnBySlug(slug: string): Promise<readonly { readonly id: string }[]> {
    const response = await this.api('/v1/posts?limit=100');
    const payload = await response.json() as { readonly items?: readonly { readonly id?: unknown; readonly slug?: unknown }[] };
    return (payload.items ?? [])
      .filter((post) => post.slug === slug && typeof post.id === 'string')
      .map((post) => ({ id: post.id as string }));
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
  const requiredLines = sourceMarkdown.split(/\r?\n/)
    .map((line) => line.trim().replace(/^#{1,6}\s+/, ''))
    .filter(Boolean);
  return requiredLines.every((line) => remoteMarkdown.includes(line));
}

function publicEvidenceMatches(input: ParagraphPublicationInput, remoteId: string, evidence: ParagraphPostEvidence | undefined): boolean {
  return !!evidence
    && evidence.id === remoteId
    && evidence.slug === input.postSlug
    && Number(evidence.publishedAt) === publishedAtMilliseconds(input.publishedAt)
    && containsSourceText(evidence.markdown, input.markdown);
}

export class ParagraphProductionService {
  constructor(
    private readonly repository: PublicationRepository,
    private readonly client: ParagraphProviderClient,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

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
    assertParagraphProductionGate(controlledCohortGate(input.publicationSlug, input.postSlug));
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
      if (!remoteId) {
        const matches = await this.client.findOwnBySlug(input.postSlug);
        if (matches.length > 1) throw new Error('PARAGRAPH_REMOTE_SLUG_AMBIGUOUS');
        remoteId = matches[0]?.id ?? (await this.client.createDraft(input)).id;
        await this.repository.putState({
          postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
          status: 'pending', remoteId, remoteUrl, updatedAt: this.now(),
        });
      }
      await this.client.updateDraft(remoteId, input);
      await this.client.publish(remoteId, input);
      const state: PublicationTargetState = {
        postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
        status: 'published', remoteId, remoteUrl, updatedAt: this.now(),
      };
      await this.repository.putState(state);
      return state;
    } catch (error) {
      await this.repository.putState({
        postSlug: input.postSlug, target: 'paragraph', sourceRevision: input.sourceRevision,
        status: 'failed', remoteId, remoteUrl: remoteId ? remoteUrl : undefined,
        lastErrorCode: error instanceof Error ? error.message.slice(0, 160) : 'PARAGRAPH_PROVIDER_FAILED',
        updatedAt: this.now(),
      });
      throw error;
    }
  }

  async verify(input: ParagraphPublicationInput): Promise<PublicationTargetState> {
    const current = await this.existingState(input.postSlug);
    if (!current?.remoteId || current.sourceRevision !== input.sourceRevision) {
      throw new Error('PARAGRAPH_REMOTE_STATE_MISSING');
    }
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
    return state;
  }
}
