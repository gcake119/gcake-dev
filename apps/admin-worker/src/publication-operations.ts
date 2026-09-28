export type PublicationTarget = 'github_pages' | 'paragraph' | 'substack';
export type PublicationOperation = 'prepare' | 'publish' | 'verify' | 'retry' | 'newsletter';
export interface PublicationOperationRequest {
  readonly postSlug: string; readonly sourceRevision: string; readonly target: PublicationTarget;
  readonly operation: PublicationOperation; readonly newsletterIntentKey?: string;
  readonly explicitIrreversibleIntent?: true;
}
export type PublicationTargetStatus = 'not_configured' | 'prepare_ready' | 'pending' | 'published' | 'verified' | 'failed' | 'manual_required' | 'stale';

export interface PublicationTargetState {
  readonly postSlug: string; readonly target: PublicationTarget; readonly sourceRevision: string;
  readonly status: PublicationTargetStatus; readonly remoteId?: string; readonly remoteUrl?: string;
  readonly verifiedAt?: string; readonly newsletterSentAt?: string; readonly lastErrorCode?: string; readonly updatedAt: string;
}

export interface PublicationRepository {
  listStates(postSlug: string): Promise<readonly PublicationTargetState[]>;
  putState(state: PublicationTargetState): Promise<void>;
  hasMigration(key: string): Promise<boolean>;
  markMigration(key: string, importedAt: string, count: number): Promise<void>;
}

export class InMemoryPublicationRepository implements PublicationRepository {
  readonly states: PublicationTargetState[] = [];
  readonly migrations = new Set<string>();
  async listStates(postSlug: string) { return this.states.filter((state) => state.postSlug === postSlug); }
  async putState(state: PublicationTargetState) {
    const index = this.states.findIndex((item) => item.postSlug === state.postSlug && item.target === state.target);
    if (index >= 0) this.states[index] = state; else this.states.push(state);
  }
  async hasMigration(key: string) { return this.migrations.has(key); }
  async markMigration(key: string) { this.migrations.add(key); }
}

type TargetRow = {
  post_slug: string; target: PublicationTarget; source_revision: string; status: PublicationTargetStatus;
  remote_id: string | null; remote_url: string | null; verified_at: string | null;
  newsletter_sent_at: string | null; last_error_code: string | null; updated_at: string;
};

function rowState(row: TargetRow): PublicationTargetState {
  return {
    postSlug: row.post_slug, target: row.target, sourceRevision: row.source_revision, status: row.status,
    remoteId: row.remote_id ?? undefined, remoteUrl: row.remote_url ?? undefined,
    verifiedAt: row.verified_at ?? undefined, newsletterSentAt: row.newsletter_sent_at ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined, updatedAt: row.updated_at,
  };
}

export class D1PublicationRepository implements PublicationRepository {
  constructor(private readonly database: D1DatabaseLike) {}
  async listStates(postSlug: string): Promise<readonly PublicationTargetState[]> {
    const rows = await this.database.prepare('SELECT * FROM publication_target_states WHERE post_slug = ?').bind(postSlug).all<TargetRow>();
    return rows.results.map(rowState);
  }
  async putState(state: PublicationTargetState): Promise<void> {
    await this.database.prepare(`INSERT INTO publication_target_states (
      post_slug, target, source_revision, status, remote_id, remote_url, verified_at, newsletter_sent_at, last_error_code, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_slug, target) DO UPDATE SET source_revision = excluded.source_revision,
      status = excluded.status, remote_id = excluded.remote_id, remote_url = excluded.remote_url,
      verified_at = excluded.verified_at, newsletter_sent_at = excluded.newsletter_sent_at,
      last_error_code = excluded.last_error_code, updated_at = excluded.updated_at`).bind(
      state.postSlug, state.target, state.sourceRevision, state.status, state.remoteId ?? null,
      state.remoteUrl ?? null, state.verifiedAt ?? null, state.newsletterSentAt ?? null,
      state.lastErrorCode ?? null, state.updatedAt,
    ).run();
  }
  async hasMigration(key: string): Promise<boolean> {
    return !!await this.database.prepare('SELECT migration_key FROM publication_migrations WHERE migration_key = ?').bind(key).first();
  }
  async markMigration(key: string, importedAt: string, count: number): Promise<void> {
    await this.database.prepare('INSERT INTO publication_migrations (migration_key, imported_at, imported_count) VALUES (?, ?, ?)').bind(key, importedAt, count).run();
  }
}

interface LegacyState {
  readonly version: 2;
  readonly posts: Readonly<Record<string, {
    readonly sourceRevision: string;
    readonly targets: Readonly<Partial<Record<'paragraph' | 'substack', {
      readonly status: string; readonly remoteId?: string; readonly remoteUrl?: string;
      readonly newsletterSent?: boolean; readonly newsletterSentAt?: string;
    }>>>;
  }>>;
}

export async function importLegacyPublicationState(
  repository: PublicationRepository,
  legacy: LegacyState,
  now: () => string,
): Promise<number> {
  const key = 'publication-state-json-v2';
  if (await repository.hasMigration(key)) return 0;
  let count = 0;
  const importedAt = now();
  for (const [postSlug, post] of Object.entries(legacy.posts)) {
    for (const target of ['paragraph', 'substack'] as const) {
      const state = post.targets[target];
      if (!state) continue;
      await repository.putState({
        postSlug, target, sourceRevision: post.sourceRevision,
        status: state.status === 'published' ? 'published' : state.status.includes('failed') ? 'failed' : 'pending',
        remoteId: state.remoteId, remoteUrl: state.remoteUrl,
        newsletterSentAt: state.newsletterSent ? state.newsletterSentAt ?? importedAt : undefined,
        updatedAt: importedAt,
      });
      count += 1;
    }
  }
  await repository.markMigration(key, importedAt, count);
  return count;
}

export class PublicationOperations {
  constructor(
    private readonly repository: PublicationRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async readStates(postSlug: string, currentRevision: string): Promise<readonly PublicationTargetState[]> {
    return (await this.repository.listStates(postSlug)).map((state) => state.sourceRevision !== currentRevision
      ? { ...state, status: 'stale' as const }
      : state);
  }

  async operate(input: PublicationOperationRequest): Promise<PublicationTargetState> {
    if (input.operation === 'newsletter' && (!input.newsletterIntentKey || input.explicitIrreversibleIntent !== true)) {
      throw new Error('NEWSLETTER_EXPLICIT_INTENT_REQUIRED');
    }
    let status: PublicationTargetStatus;
    let error: string | undefined;
    if (input.target === 'substack') { status = 'manual_required'; error = 'SUBSTACK_NOT_CONFIGURED'; }
    else if (input.target === 'paragraph' && input.operation === 'prepare') status = 'prepare_ready';
    else if (input.target === 'paragraph') { status = 'failed'; error = 'PARAGRAPH_PRODUCTION_GATE_BLOCKED'; }
    else status = input.operation === 'verify' ? 'verified' : 'pending';
    const state = { ...input, status, lastErrorCode: error, updatedAt: this.now() };
    await this.repository.putState(state);
    return state;
  }

  async fail(postSlug: string, target: PublicationTarget, sourceRevision: string, errorCode: string): Promise<void> {
    await this.repository.putState({
      postSlug, target, sourceRevision,
      status: target === 'substack' ? 'manual_required' : 'failed', lastErrorCode: errorCode, updatedAt: this.now(),
    });
  }
}
import type { D1DatabaseLike } from './media.js';
