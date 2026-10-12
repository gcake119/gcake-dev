import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { D1PublicationRepository } from '../../apps/admin-worker/src/publication-operations';
import { SqliteD1Database } from './sqlite-d1';
import { CloudflareD1Database } from './d1-api';

test('D1 locks and checkpoints survive restart, serialize one target, and retain another', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql', import.meta.url), 'utf8'));
    db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0006_distribution_checkpoints.sql', import.meta.url), 'utf8'));
    const first = new D1PublicationRepository(new SqliteD1Database(db));
    const next = new D1PublicationRepository(new SqliteD1Database(db));
    assert.equal(await first.runtime.acquire('demo', 'github_pages', 'owner-1', 'now'), true);
    assert.equal(await next.runtime.acquire('demo', 'github_pages', 'owner-2', 'later'), false);
    assert.equal(await next.runtime.acquire('demo', 'substack', 'owner-2', 'later'), true);
    await first.runtime.record({ postSlug: 'demo', target: 'github_pages', sourceRevision: 'r1', operation: 'publish', createdAt: 'now' });
    assert.equal((await next.runtime.checkpoint('demo', 'github_pages'))?.sourceRevision, 'r1');
    await first.runtime.record({ postSlug: 'demo', target: 'substack', sourceRevision: 'r1', operation: 'metadata', substackPolicy: 'full-mirror', createdAt: 'now' });
    assert.equal((await next.runtime.checkpoint('demo', 'substack'))?.operation, 'metadata');
    assert.equal((await next.runtime.checkpoint('demo', 'substack'))?.substackPolicy, 'full-mirror');
    await next.runtime.release('demo', 'github_pages', 'owner-2');
    assert.equal(await next.runtime.acquire('demo', 'github_pages', 'owner-3', 'future'), false);
    await first.runtime.release('demo', 'github_pages', 'owner-1');
    assert.equal(await next.runtime.acquire('demo', 'github_pages', 'owner-3', 'future'), true);
  } finally { db.close(); }
});
test('D1 HTTP failure never retries SQL and does not expose credentials/provider body', async () => {
  let calls = 0;
  const database = new CloudflareD1Database('a'.repeat(32), 'a'.repeat(36), 'secret-token', async () => { calls++; return new Response('secret-body', { status: 500 }); });
  await assert.rejects(() => database.prepare('SELECT 1').all(), error => error instanceof Error && error.message === 'DISTRIBUTION_D1_HTTP_500');
  assert.equal(calls, 1);
});

test('metadata recovery retains original attempt identity across restart and settles it once',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0003_publication_operations.sql',import.meta.url),'utf8'));db.exec(await fs.readFile(new URL('../../apps/admin-worker/migrations/0006_distribution_checkpoints.sql',import.meta.url),'utf8'));
  const first=new D1PublicationRepository(new SqliteD1Database(db)),next=new D1PublicationRepository(new SqliteD1Database(db));
  const cp={postSlug:'demo',target:'substack' as const,sourceRevision:'r1',operation:'publish' as const,substackPolicy:'full-mirror' as const,createdAt:'now'};
  await first.runtime.record(cp);const original=db.prepare('SELECT attempt_id FROM publication_checkpoints').get()!.attempt_id;
  await next.runtime.record({...cp,operation:'metadata',createdAt:'later'});await next.runtime.record({...cp,operation:'metadata',createdAt:'latest'});
  assert.equal(db.prepare('SELECT attempt_id FROM publication_checkpoints').get()!.attempt_id,original);
  assert.equal(db.prepare('SELECT count(*) AS count FROM publication_attempts').get()!.count,1);
  await assert.rejects(next.runtime.record({...cp,sourceRevision:'r2',operation:'metadata'}),/INTENT_MISMATCH/);
  await next.runtime.clear('demo','substack');assert.equal(db.prepare("SELECT count(*) AS count FROM publication_attempts WHERE status = 'intent'").get()!.count,0);
 }finally{db.close();}
});
