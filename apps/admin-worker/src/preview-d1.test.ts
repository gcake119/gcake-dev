import assert from 'node:assert/strict';
import test from 'node:test';
import type { D1DatabaseLike, D1StatementLike } from './media';
import { D1PreviewStore } from './preview';

test('D1 preview lifecycle stores source identity and operational state without draft body', async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  let current: { sql: string; values: unknown[] };
  const statement: D1StatementLike = {
    bind(...values) { current.values = values; return this; },
    async run() { calls.push(current); return {}; }, async first() { return null; }, async all() { return { results: [] }; },
  };
  const database: D1DatabaseLike = { prepare(sql) { current = { sql, values: [] }; return statement; } };
  await new D1PreviewStore(database).put({
    id: 'job', repository: 'repo', postSlug: 'post', baseRevision: 'base', draftHash: 'hash', status: 'queued',
    createdAt: 'created', updatedAt: 'updated', expiresAt: 'expires',
  });
  assert.match(calls[0]!.sql, /INSERT INTO preview_jobs/);
  assert.deepEqual(calls[0]!.values.slice(0, 6), ['job', 'repo', 'post', 'base', 'hash', 'queued']);
  assert.equal(JSON.stringify(calls).includes('draft body'), false);
});
