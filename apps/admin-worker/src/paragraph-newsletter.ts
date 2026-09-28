import type { D1DatabaseLike } from './media.js';

export type NewsletterIntentState = 'reserved' | 'sent' | 'uncertain';

export interface NewsletterIntentRecord {
  readonly postSlug: string;
  readonly sourceRevision: string;
  readonly remoteId: string;
  readonly intentKey: string;
  readonly state: NewsletterIntentState;
  readonly claimToken: string;
  readonly sentAt?: string;
  readonly updatedAt: string;
}

export interface NewsletterIntentStore {
  claim(record: NewsletterIntentRecord): Promise<{ readonly record: NewsletterIntentRecord; readonly claimed: boolean }>;
  setState(postSlug: string, intentKey: string, state: 'sent' | 'uncertain', updatedAt: string): Promise<void>;
}

export class InMemoryNewsletterIntentStore implements NewsletterIntentStore {
  readonly records = new Map<string, NewsletterIntentRecord>();

  async claim(record: NewsletterIntentRecord) {
    const key = `${record.postSlug}:${record.intentKey}`;
    const existing = this.records.get(key);
    if (existing) return { record: existing, claimed: false };
    this.records.set(key, record);
    return { record, claimed: true };
  }

  async setState(postSlug: string, intentKey: string, state: 'sent' | 'uncertain', updatedAt: string) {
    const key = `${postSlug}:${intentKey}`;
    const existing = this.records.get(key);
    if (!existing) throw new Error('NEWSLETTER_INTENT_NOT_FOUND');
    this.records.set(key, {
      ...existing,
      state,
      sentAt: state === 'sent' ? updatedAt : undefined,
      updatedAt,
    });
  }
}

type NewsletterIntentRow = {
  post_slug: string;
  source_revision: string;
  remote_id: string;
  intent_key: string;
  state: NewsletterIntentState;
  claim_token: string;
  sent_at: string | null;
  updated_at: string;
};

function rowToRecord(row: NewsletterIntentRow): NewsletterIntentRecord {
  return {
    postSlug: row.post_slug,
    sourceRevision: row.source_revision,
    remoteId: row.remote_id,
    intentKey: row.intent_key,
    state: row.state,
    claimToken: row.claim_token,
    sentAt: row.sent_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

export class D1NewsletterIntentStore implements NewsletterIntentStore {
  constructor(private readonly database: D1DatabaseLike) {}

  async claim(record: NewsletterIntentRecord) {
    await this.database.prepare(`INSERT OR IGNORE INTO paragraph_newsletter_intents (
      post_slug, intent_key, source_revision, remote_id, state, claim_token, sent_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      record.postSlug, record.intentKey, record.sourceRevision, record.remoteId,
      record.state, record.claimToken, record.sentAt ?? null, record.updatedAt,
    ).run();
    const row = await this.database.prepare(`SELECT post_slug, intent_key, source_revision, remote_id,
      state, claim_token, sent_at, updated_at FROM paragraph_newsletter_intents
      WHERE post_slug = ? AND intent_key = ?`).bind(record.postSlug, record.intentKey).first<NewsletterIntentRow>();
    if (!row) throw new Error('NEWSLETTER_INTENT_CLAIM_FAILED');
    const persisted = rowToRecord(row);
    if (persisted.remoteId !== record.remoteId || persisted.sourceRevision !== record.sourceRevision) {
      throw new Error('NEWSLETTER_INTENT_KEY_COLLISION');
    }
    return { record: persisted, claimed: persisted.claimToken === record.claimToken };
  }

  async setState(postSlug: string, intentKey: string, state: 'sent' | 'uncertain', updatedAt: string) {
    await this.database.prepare(`UPDATE paragraph_newsletter_intents
      SET state = ?, sent_at = ?, updated_at = ? WHERE post_slug = ? AND intent_key = ?`).bind(
      state, state === 'sent' ? updatedAt : null, updatedAt, postSlug, intentKey,
    ).run();
  }
}

export interface ParagraphNewsletterProvider {
  sendNewsletter(input: { readonly remoteId: string; readonly sendNewsletter: true }): Promise<void>;
}

export function paragraphMutationPayload(_operation: 'create' | 'update' | 'retry') {
  return { sendNewsletter: false } as const;
}

export class ParagraphNewsletterBoundary {
  constructor(
    private readonly store: NewsletterIntentStore,
    private readonly provider: ParagraphNewsletterProvider,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly createClaimToken: () => string = () => crypto.randomUUID(),
  ) {}

  async send(input: {
    readonly postSlug: string;
    readonly sourceRevision: string;
    readonly remoteId: string;
    readonly intentKey: string;
    readonly explicitIrreversibleIntent: boolean;
  }): Promise<{ readonly status: 'sent' | 'already_sent'; readonly sentAt: string } | { readonly status: 'manual_review_required' }> {
    if (!input.explicitIrreversibleIntent) throw new Error('NEWSLETTER_EXPLICIT_INTENT_REQUIRED');
    if (!input.intentKey.trim()) throw new Error('NEWSLETTER_INTENT_KEY_REQUIRED');
    const timestamp = this.now();
    const claim = await this.store.claim({
      ...input,
      state: 'reserved',
      claimToken: this.createClaimToken(),
      updatedAt: timestamp,
    });
    if (!claim.claimed) {
      if (claim.record.state === 'sent' && claim.record.sentAt) {
        return { status: 'already_sent', sentAt: claim.record.sentAt };
      }
      return { status: 'manual_review_required' };
    }
    try {
      await this.provider.sendNewsletter({ remoteId: input.remoteId, sendNewsletter: true });
      await this.store.setState(input.postSlug, input.intentKey, 'sent', timestamp);
      return { status: 'sent', sentAt: timestamp };
    } catch {
      await this.store.setState(input.postSlug, input.intentKey, 'uncertain', timestamp);
      throw new Error('NEWSLETTER_DELIVERY_UNCERTAIN');
    }
  }
}
