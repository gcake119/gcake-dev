import type { PreviewJob } from '@gcake/admin-contract';
import type { D1DatabaseLike } from './media.js';

export class PreviewBuildError extends Error {
  readonly code = 'PREVIEW_BUILD_FAILED' as const;
}

export interface PreviewStore {
  put(job: PreviewJob): Promise<void>;
  get(id: string): Promise<PreviewJob | undefined>;
  listExpirable(nowIso: string): Promise<readonly PreviewJob[]>;
}
export interface IsolatedPreviewSource { readonly root: string; cleanup(): Promise<void> }
export interface PreviewSourceResolver { reconstruct(baseRevision: string): Promise<IsolatedPreviewSource | undefined> }
export interface PreviewBuildProvider {
  build(input: { readonly jobId: string; readonly sourceRoot: string; readonly slug: string; readonly draft: string; readonly draftHash: string }): Promise<{ readonly url: string }>;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class PreviewOrchestrator {
  constructor(private readonly dependencies: {
    readonly store: PreviewStore; readonly source: PreviewSourceResolver; readonly provider: PreviewBuildProvider;
    readonly id: () => string; readonly now: () => Date; readonly lifetimeMs: number;
  }) {}

  async create(input: { readonly repository: string; readonly slug: string; readonly baseRevision: string; readonly draft: string }): Promise<PreviewJob> {
    const now = this.dependencies.now();
    const draftHash = await sha256(input.draft);
    let job: PreviewJob = {
      id: this.dependencies.id(), repository: input.repository, postSlug: input.slug,
      baseRevision: input.baseRevision, draftHash, status: 'queued',
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.dependencies.lifetimeMs).toISOString(),
    };
    await this.dependencies.store.put(job);
    const isolated = await this.dependencies.source.reconstruct(input.baseRevision);
    if (!isolated) {
      job = { ...job, status: 'failed', error: '無法從指定的基礎修訂版重建預覽來源。', updatedAt: this.dependencies.now().toISOString() };
      await this.dependencies.store.put(job);
      throw new PreviewBuildError(job.error!);
    }
    try {
      job = { ...job, status: 'running', updatedAt: this.dependencies.now().toISOString() };
      await this.dependencies.store.put(job);
      const built = await this.dependencies.provider.build({ jobId: job.id, sourceRoot: isolated.root, slug: input.slug, draft: input.draft, draftHash });
      job = { ...job, status: 'ready', url: built.url, updatedAt: this.dependencies.now().toISOString() };
      await this.dependencies.store.put(job);
      return job;
    } catch (error) {
      job = { ...job, status: 'failed', error: error instanceof Error ? error.message : 'Astro 預覽建置失敗。', updatedAt: this.dependencies.now().toISOString() };
      await this.dependencies.store.put(job);
      throw new PreviewBuildError(job.error!);
    } finally {
      await isolated.cleanup();
    }
  }
}

export async function expirePreviews(store: PreviewStore, artifacts: { remove(id: string): Promise<void> }, now: Date): Promise<void> {
  for (const job of await store.listExpirable(now.toISOString())) {
    await artifacts.remove(job.id);
    await store.put({ ...job, status: 'expired', url: undefined, updatedAt: now.toISOString() });
  }
}

export class InMemoryPreviewStore implements PreviewStore {
  readonly jobs = new Map<string, PreviewJob>();
  readonly history: PreviewJob[] = [];
  async put(job: PreviewJob): Promise<void> { this.jobs.set(job.id, job); this.history.push({ ...job }); }
  async get(id: string): Promise<PreviewJob | undefined> { return this.jobs.get(id); }
  async listExpirable(nowIso: string): Promise<readonly PreviewJob[]> {
    return [...this.jobs.values()].filter((job) => job.status !== 'expired' && job.expiresAt <= nowIso);
  }
}

type PreviewRow = {
  id: string; repository: string; post_slug: string; base_revision: string; draft_hash: string;
  status: PreviewJob['status']; preview_url: string | null; error_message: string | null;
  created_at: string; updated_at: string; expires_at: string;
};

function fromRow(row: PreviewRow): PreviewJob {
  return {
    id: row.id, repository: row.repository, postSlug: row.post_slug, baseRevision: row.base_revision,
    draftHash: row.draft_hash, status: row.status, url: row.preview_url ?? undefined,
    error: row.error_message ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at,
  };
}

export class D1PreviewStore implements PreviewStore {
  constructor(private readonly database: D1DatabaseLike) {}
  async put(job: PreviewJob): Promise<void> {
    await this.database.prepare(`INSERT INTO preview_jobs (
      id, repository, post_slug, base_revision, draft_hash, status, preview_url, error_code, error_message, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, preview_url = excluded.preview_url,
      error_code = excluded.error_code, error_message = excluded.error_message,
      updated_at = excluded.updated_at, expires_at = excluded.expires_at`).bind(
      job.id, job.repository, job.postSlug, job.baseRevision, job.draftHash, job.status,
      job.url ?? null, job.error ? 'PREVIEW_BUILD_FAILED' : null, job.error ?? null,
      job.createdAt, job.updatedAt, job.expiresAt,
    ).run();
  }
  async get(id: string): Promise<PreviewJob | undefined> {
    const row = await this.database.prepare('SELECT * FROM preview_jobs WHERE id = ?').bind(id).first<PreviewRow>();
    return row ? fromRow(row) : undefined;
  }
  async listExpirable(nowIso: string): Promise<readonly PreviewJob[]> {
    const rows = await this.database.prepare("SELECT * FROM preview_jobs WHERE status != 'expired' AND expires_at <= ?").bind(nowIso).all<PreviewRow>();
    return rows.results.map(fromRow);
  }
}
