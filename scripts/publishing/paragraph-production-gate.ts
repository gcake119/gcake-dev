import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ParagraphProductionService,
  ParagraphRestClient,
  PARAGRAPH_OPENAPI_COMMIT,
  type ParagraphPublicationInput,
} from '../../apps/admin-worker/src/paragraph-provider.js';
import type {
  PublicationRepository,
  PublicationTargetState,
} from '../../apps/admin-worker/src/publication-operations.js';

const usage = `Usage:
  pnpm paragraph:production-gate -- dry-run --body-file <path>
  pnpm paragraph:production-gate -- publish --body-file <path> --approved --no-newsletter
  pnpm paragraph:production-gate -- verify --body-file <path>

Optional flags:
  --post-slug <slug>             default: gcake-cms-production-gate-20260928
  --publication-slug <slug>      default: gcake
  --published-at <ISO timestamp> default: 2026-09-28T18:00:00+08:00
  --state-db <path>              default: /private/tmp/gcake-paragraph-production-gate.sqlite
`;

const args = process.argv.slice(2).filter((argument) => argument !== '--');

function flag(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(name: string): boolean { return args.includes(name); }

class SqlitePublicationRepository implements PublicationRepository {
  constructor(private readonly database: DatabaseSync) {}

  async listStates(postSlug: string): Promise<readonly PublicationTargetState[]> {
    const rows = this.database.prepare('SELECT * FROM publication_target_states WHERE post_slug = ?').all(postSlug) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      postSlug: String(row.post_slug), target: row.target as PublicationTargetState['target'],
      sourceRevision: String(row.source_revision), status: row.status as PublicationTargetState['status'],
      remoteId: row.remote_id ? String(row.remote_id) : undefined,
      remoteUrl: row.remote_url ? String(row.remote_url) : undefined,
      verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
      newsletterSentAt: row.newsletter_sent_at ? String(row.newsletter_sent_at) : undefined,
      lastErrorCode: row.last_error_code ? String(row.last_error_code) : undefined,
      updatedAt: String(row.updated_at),
    }));
  }

  async putState(state: PublicationTargetState): Promise<void> {
    this.database.prepare(`INSERT INTO publication_target_states (
      post_slug, target, source_revision, status, remote_id, remote_url, verified_at, newsletter_sent_at, last_error_code, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_slug, target) DO UPDATE SET source_revision = excluded.source_revision,
      status = excluded.status, remote_id = excluded.remote_id, remote_url = excluded.remote_url,
      verified_at = excluded.verified_at, newsletter_sent_at = excluded.newsletter_sent_at,
      last_error_code = excluded.last_error_code, updated_at = excluded.updated_at`).run(
      state.postSlug, state.target, state.sourceRevision, state.status, state.remoteId ?? null,
      state.remoteUrl ?? null, state.verifiedAt ?? null, state.newsletterSentAt ?? null,
      state.lastErrorCode ?? null, state.updatedAt,
    );
  }

  async hasMigration(key: string): Promise<boolean> {
    return !!this.database.prepare('SELECT migration_key FROM publication_migrations WHERE migration_key = ?').get(key);
  }

  async markMigration(key: string, importedAt: string, count: number): Promise<void> {
    this.database.prepare('INSERT INTO publication_migrations (migration_key, imported_at, imported_count) VALUES (?, ?, ?)').run(key, importedAt, count);
  }
}

async function apiKey(): Promise<string> {
  const configPath = path.join(homedir(), '.paragraph', 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8')) as { readonly apiKey?: unknown };
  if (typeof config.apiKey !== 'string' || !config.apiKey) throw new Error('PARAGRAPH_API_KEY_REQUIRED');
  return config.apiKey;
}

const command = args[0];
const bodyFile = flag('--body-file');
if (!command || !bodyFile || !['dry-run', 'publish', 'verify'].includes(command)) {
  console.error(usage);
  process.exit(1);
}
if (command === 'publish' && (!hasFlag('--approved') || !hasFlag('--no-newsletter'))) {
  throw new Error('PARAGRAPH_EXPLICIT_APPROVAL_AND_NO_NEWSLETTER_REQUIRED');
}

const markdown = await readFile(path.resolve(bodyFile), 'utf8');
const sourceRevision = `sha256:${createHash('sha256').update(markdown).digest('hex')}`;
const postSlug = flag('--post-slug') ?? 'gcake-cms-production-gate-20260928';
const publicationSlug = flag('--publication-slug') ?? 'gcake';
const input: ParagraphPublicationInput = {
  postSlug,
  publicationSlug,
  sourceRevision,
  title: 'gcake CMS Paragraph 生產閘門驗證',
  subtitle: '受控建立、更新、公開讀取與 canonical 驗證；不寄送電子報。',
  markdown,
  canonicalUrl: `https://gcake119.github.io/gcake-dev/posts/${postSlug}/`,
  publishedAt: flag('--published-at') ?? '2026-09-28T18:00:00+08:00',
};

const stateDb = flag('--state-db') ?? '/private/tmp/gcake-paragraph-production-gate.sqlite';
const database = new DatabaseSync(stateDb);
database.exec(await readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql', import.meta.url), 'utf8'));
const repository = new SqlitePublicationRepository(database);
const client = command === 'dry-run'
  ? ({}) as ParagraphRestClient
  : new ParagraphRestClient(await apiKey());
const service = new ParagraphProductionService(repository, client);

try {
  if (command === 'dry-run') {
    const receipt = await service.dryRun(input);
    console.log(JSON.stringify({ command, providerInterface: { kind: 'rest', openapiCommit: PARAGRAPH_OPENAPI_COMMIT }, receipt }, null, 2));
  } else if (command === 'publish') {
    const receipt = await service.dryRun(input);
    const state = await service.publish(input, receipt);
    console.log(JSON.stringify({ command, providerInterface: { kind: 'rest', openapiCommit: PARAGRAPH_OPENAPI_COMMIT }, receipt, state }, null, 2));
  } else {
    const state = await service.verify(input);
    console.log(JSON.stringify({ command, providerInterface: { kind: 'rest', openapiCommit: PARAGRAPH_OPENAPI_COMMIT }, state }, null, 2));
  }
} finally {
  database.close();
}
