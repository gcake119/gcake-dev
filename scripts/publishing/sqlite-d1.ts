import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { D1DatabaseLike, D1StatementLike } from '../../apps/admin-worker/src/media';

// SQLite implements D1's interface for local acceptance fixtures / legacy controlled cohort only.
export class SqliteD1Database implements D1DatabaseLike {
  constructor(readonly database: DatabaseSync) {}
  prepare(sql: string): D1StatementLike {
    const prepared = this.database.prepare(sql); let values: SQLInputValue[] = [];
    const statement: D1StatementLike = {
      bind(...params) { values = params as SQLInputValue[]; return statement; },
      async run() { return prepared.run(...values); },
      async first<T>() { return (prepared.get(...values) ?? null) as T | null; },
      async all<T>() { return { results: prepared.all(...values) as T[] }; },
    };
    return statement;
  }
}
