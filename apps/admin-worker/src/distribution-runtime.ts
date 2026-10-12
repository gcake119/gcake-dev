import type { D1DatabaseLike } from './media.js';
import type { PublicationRepository, PublicationTarget } from './publication-operations.js';

export interface WriteCheckpoint {
  postSlug: string; target: PublicationTarget; sourceRevision: string;
  operation: 'create' | 'update' | 'publish' | 'metadata'; createdAt: string;
  substackPolicy?: 'full-mirror';
}
export interface DistributionRuntime {
  acquire(postSlug: string, target: PublicationTarget, owner: string, now: string): Promise<boolean>;
  release(postSlug: string, target: PublicationTarget, owner: string): Promise<void>;
  checkpoint(postSlug: string, target: PublicationTarget): Promise<WriteCheckpoint | undefined>;
  record(checkpoint: WriteCheckpoint): Promise<void>;
  clear(postSlug: string, target: PublicationTarget): Promise<void>;
}
export class InMemoryDistributionRuntime implements DistributionRuntime {
  readonly locks = new Map<string, string>();
  readonly checkpoints = new Map<string, WriteCheckpoint>();
  private key(slug: string, target: PublicationTarget) { return `${slug}:${target}`; }
  async acquire(slug: string, target: PublicationTarget, owner: string) {
    const key = this.key(slug, target);
    if (this.locks.has(key)) return false;
    this.locks.set(key, owner); return true;
  }
  async release(slug: string, target: PublicationTarget, owner: string) {
    const key = this.key(slug, target);
    if (this.locks.get(key) === owner) this.locks.delete(key);
  }
  async checkpoint(slug: string, target: PublicationTarget) { return this.checkpoints.get(this.key(slug, target)); }
  async record(checkpoint: WriteCheckpoint) {
    const previous = await this.checkpoint(checkpoint.postSlug, checkpoint.target);
    if (previous && (previous.sourceRevision !== checkpoint.sourceRevision || previous.substackPolicy !== checkpoint.substackPolicy || previous.operation !== checkpoint.operation && !(previous.operation === 'publish' && checkpoint.operation === 'metadata'))) throw new Error('DISTRIBUTION_INTENT_MISMATCH');
    this.checkpoints.set(this.key(checkpoint.postSlug, checkpoint.target), previous ? { ...previous, operation: checkpoint.operation } : checkpoint);
  }
  async clear(slug: string, target: PublicationTarget) { this.checkpoints.delete(this.key(slug, target)); }
}
export class D1DistributionRuntime implements DistributionRuntime {
  constructor(private readonly database: D1DatabaseLike) {}
  async acquire(slug: string, target: PublicationTarget, owner: string, now: string) {
    await this.database.prepare('INSERT OR IGNORE INTO publication_locks (post_slug, target, owner, acquired_at) VALUES (?, ?, ?, ?)').bind(slug, target, owner, now).run();
    const row = await this.database.prepare('SELECT owner FROM publication_locks WHERE post_slug = ? AND target = ?').bind(slug, target).first<{ owner: string }>();
    return row?.owner === owner;
  }
  async release(slug: string, target: PublicationTarget, owner: string) {
    await this.database.prepare('DELETE FROM publication_locks WHERE post_slug = ? AND target = ? AND owner = ?').bind(slug, target, owner).run();
  }
  async checkpoint(slug: string, target: PublicationTarget): Promise<WriteCheckpoint | undefined> {
    const row = await this.database.prepare('SELECT * FROM publication_checkpoints WHERE post_slug = ? AND target = ?').bind(slug, target).first<{ post_slug: string; target: PublicationTarget; source_revision: string; operation: WriteCheckpoint['operation']; created_at: string; substack_policy?: 'full-mirror' | null }>();
    return row ? { postSlug: row.post_slug, target: row.target, sourceRevision: row.source_revision, operation: row.operation, createdAt: row.created_at, ...(row.substack_policy ? { substackPolicy: row.substack_policy } : {}) } : undefined;
  }
  async record(cp: WriteCheckpoint) {
    const previous = await this.checkpoint(cp.postSlug, cp.target);
    if (previous) {
      if (previous.sourceRevision !== cp.sourceRevision || previous.substackPolicy !== cp.substackPolicy || previous.operation !== cp.operation && !(previous.operation === 'publish' && cp.operation === 'metadata')) throw new Error('DISTRIBUTION_INTENT_MISMATCH');
      if (previous.operation !== cp.operation) {
        await this.database.prepare('UPDATE publication_attempts SET diagnostic = ? WHERE id = (SELECT attempt_id FROM publication_checkpoints WHERE post_slug = ? AND target = ?)').bind(JSON.stringify({ operation: cp.operation, substackPolicy: cp.substackPolicy ?? 'strict-source' }), cp.postSlug, cp.target).run();
        await this.database.prepare('UPDATE publication_checkpoints SET operation = ? WHERE post_slug = ? AND target = ? AND source_revision = ?').bind(cp.operation, cp.postSlug, cp.target, cp.sourceRevision).run();
      }
      return;
    }
    const runId = crypto.randomUUID(), attemptId = crypto.randomUUID();
    await this.database.prepare('INSERT INTO publication_runs (id, post_slug, source_revision, operation, created_at) VALUES (?, ?, ?, ?, ?)').bind(runId, cp.postSlug, cp.sourceRevision, cp.operation === 'publish' ? 'publish' : 'prepare', cp.createdAt).run();
    await this.database.prepare('INSERT INTO publication_attempts (id, run_id, target, status, created_at, diagnostic) VALUES (?, ?, ?, ?, ?, ?)').bind(attemptId, runId, cp.target, 'intent', cp.createdAt, JSON.stringify({ operation: cp.operation, substackPolicy: cp.substackPolicy ?? 'strict-source' })).run();
    await this.database.prepare('INSERT INTO publication_checkpoints (post_slug, target, source_revision, operation, created_at, attempt_id, substack_policy) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(post_slug, target) DO UPDATE SET source_revision = excluded.source_revision, operation = excluded.operation, created_at = excluded.created_at, attempt_id = excluded.attempt_id, substack_policy = excluded.substack_policy').bind(cp.postSlug, cp.target, cp.sourceRevision, cp.operation, cp.createdAt, attemptId, cp.substackPolicy ?? null).run();
  }
  async clear(slug: string, target: PublicationTarget) {
    await this.database.prepare("UPDATE publication_attempts SET status = 'settled' WHERE id = (SELECT attempt_id FROM publication_checkpoints WHERE post_slug = ? AND target = ?)").bind(slug, target).run();
    await this.database.prepare('DELETE FROM publication_checkpoints WHERE post_slug = ? AND target = ?').bind(slug, target).run();
  }
}
// Direct service callers must supply durable runtime; tests opt into memory explicitly.
export interface RuntimePublicationRepository extends PublicationRepository { runtime: DistributionRuntime }
export function boundedDistributionError(error: unknown): string {
  const code = error instanceof Error ? error.message.split(':', 1)[0] : '';
  if (code === 'UNPUBLISHED_POST_NOT_DISTRIBUTABLE') return 'DISTRIBUTION_SOURCE_NOT_PUBLISHED';
  if (code === 'FUTURE_POST_NOT_DISTRIBUTABLE') return 'DISTRIBUTION_SOURCE_FUTURE';
  if (['UNATTENDED_POLICY_REQUIRED', 'UNATTENDED_OUTPUT_OUTSIDE_GIT'].includes(code)) return code;
  return /^(SUBSTACK|DISTRIBUTION|PAGES_PUBLIC)_[A-Z0-9_]+$/.test(code) ? code : 'DISTRIBUTION_PROVIDER_FAILED';
}
