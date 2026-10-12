import type { D1DatabaseLike, D1StatementLike } from '../../apps/admin-worker/src/media';

// Production runtime ownership stays in D1. No local-state fallback or automatic request retry.
export class CloudflareD1Database implements D1DatabaseLike {
  constructor(private readonly accountId: string, private readonly databaseId: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {
    if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9-]{36}$/i.test(databaseId) || !token) throw new Error('DISTRIBUTION_D1_CONFIGURATION_REQUIRED');
  }
  prepare(sql: string): D1StatementLike {
    let params: unknown[] = [];
    const query = async () => {
      const response = await this.fetcher(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`, {
        method: 'POST', headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ sql, params }),
      });
      if (!response.ok) throw new Error(`DISTRIBUTION_D1_HTTP_${response.status}`);
      const body = await response.json() as { success?: boolean; result?: { success?: boolean; results?: Record<string, unknown>[] }[] };
      if (body.success !== true || body.result?.length !== 1 || body.result[0].success !== true || !Array.isArray(body.result[0].results)) throw new Error('DISTRIBUTION_D1_QUERY_FAILED');
      return body.result[0];
    };
    const statement: D1StatementLike = {
      bind(...values) { params = values; return statement; },
      async run() { return query(); },
      async first<T>() { return ((await query()).results?.[0] ?? null) as T | null; },
      async all<T>() { return { results: (await query()).results as T[] }; },
    };
    return statement;
  }
}
