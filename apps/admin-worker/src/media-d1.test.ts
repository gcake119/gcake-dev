import assert from 'node:assert/strict';
import test from 'node:test';
import { D1MediaIndex, type D1DatabaseLike, type D1StatementLike, type MediaRecord } from './media';

test('D1 media index stores operational metadata only, never article alt, caption, or bytes', async () => {
  const statements: { sql: string; values: unknown[] }[] = [];
  const database: D1DatabaseLike = {
    prepare(sql: string): D1StatementLike {
      const entry = { sql, values: [] as unknown[] };
      statements.push(entry);
      return {
        bind(...values) { entry.values = values; return this; },
        async run() { return {}; },
        async first<T>() { return null as T | null; },
        async all<T>() { return { results: [] as T[] }; },
      };
    },
  };
  const record: MediaRecord = {
    id: 'id', key: 'posts/post/2026/09/id-image.png', url: 'https://media/image.png',
    mime: 'image/png', width: 100, height: 50, size: 4, hash: 'hash', createdAt: '2026-09-28T00:00:00Z',
  };
  await new D1MediaIndex(database).save(record);
  const sql = statements[0]?.sql.toLowerCase() ?? '';
  assert.match(sql, /object_key/);
  assert.match(sql, /content_hash/);
  assert.doesNotMatch(sql, /\balt\b|caption|article_body|binary|bytes/);
  assert.equal(statements[0]?.values.includes('文章替代文字'), false);
});
