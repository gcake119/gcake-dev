export type AuditCategory = 'auth' | 'git' | 'series' | 'media' | 'preview' | 'conflict' | 'publication';
export interface AuditEvent {
  readonly id: string; readonly actorId?: string; readonly category: AuditCategory; readonly action: string;
  readonly resourceId?: string; readonly outcome: 'succeeded' | 'failed' | 'blocked'; readonly errorCode?: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>; readonly createdAt: string;
}

const forbidden = /token|secret|key|password|cookie|authorization|body|source|markdown|private/i;

export function createAuditEvent(input: Omit<AuditEvent, 'metadata'> & { readonly metadata?: Readonly<Record<string, unknown>> }): AuditEvent {
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (forbidden.test(key)) continue;
    if (typeof value === 'string') metadata[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) metadata[key] = value;
  }
  return { ...input, metadata };
}

export interface AuditSink { write(event: AuditEvent): Promise<void> }

export class D1AuditSink implements AuditSink {
  constructor(private readonly database: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } }) {}
  async write(event: AuditEvent): Promise<void> {
    await this.database.prepare(`INSERT INTO audit_events (
      id, actor_id, category, action, resource_id, outcome, error_code, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      event.id, event.actorId ?? null, event.category, event.action, event.resourceId ?? null,
      event.outcome, event.errorCode ?? null, JSON.stringify(event.metadata), event.createdAt,
    ).run();
  }
}
