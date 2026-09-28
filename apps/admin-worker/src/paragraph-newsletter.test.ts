import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  InMemoryNewsletterIntentStore,
  ParagraphNewsletterBoundary,
  paragraphMutationPayload,
} from './paragraph-newsletter';

test('D1 persists one newsletter intent per post and idempotency key', async () => {
  const sql = await readFile(new URL('../migrations/0004_paragraph_newsletter_idempotency.sql', import.meta.url), 'utf8');
  assert.match(sql, /PRIMARY KEY \(post_slug, intent_key\)/);
  assert.match(sql, /CHECK \(state IN \('reserved', 'sent', 'uncertain'\)\)/);
});

test('ordinary create, update, and retry payloads can never send a newsletter', () => {
  for (const operation of ['create', 'update', 'retry'] as const) {
    assert.deepEqual(paragraphMutationPayload(operation), { sendNewsletter: false });
  }
});

test('newsletter delivery requires a separate explicit irreversible intent', async () => {
  const boundary = new ParagraphNewsletterBoundary(new InMemoryNewsletterIntentStore(), {
    async sendNewsletter() { throw new Error('provider must not be called'); },
  }, () => '2026-09-28T10:00:00.000Z');

  await assert.rejects(() => boundary.send({
    postSlug: 'demo', sourceRevision: 'rev-1', remoteId: 'remote-1',
    intentKey: 'newsletter-demo-rev-1', explicitIrreversibleIntent: false,
  }), /NEWSLETTER_EXPLICIT_INTENT_REQUIRED/);
});

test('repeating an already-sent intent never calls the provider twice', async () => {
  const store = new InMemoryNewsletterIntentStore();
  let sends = 0;
  const boundary = new ParagraphNewsletterBoundary(store, {
    async sendNewsletter(input) {
      sends += 1;
      assert.deepEqual(input, { remoteId: 'remote-1', sendNewsletter: true });
    },
  }, () => '2026-09-28T10:00:00.000Z');
  const input = {
    postSlug: 'demo', sourceRevision: 'rev-1', remoteId: 'remote-1',
    intentKey: 'newsletter-demo-rev-1', explicitIrreversibleIntent: true,
  } as const;

  assert.deepEqual(await boundary.send(input), { status: 'sent', sentAt: '2026-09-28T10:00:00.000Z' });
  assert.deepEqual(await boundary.send(input), { status: 'already_sent', sentAt: '2026-09-28T10:00:00.000Z' });
  assert.equal(sends, 1);
});

test('an uncertain provider result fails closed and ordinary retry cannot resend', async () => {
  const store = new InMemoryNewsletterIntentStore();
  let sends = 0;
  const boundary = new ParagraphNewsletterBoundary(store, {
    async sendNewsletter() { sends += 1; throw new Error('connection lost after request'); },
  }, () => '2026-09-28T10:00:00.000Z');
  const input = {
    postSlug: 'demo', sourceRevision: 'rev-1', remoteId: 'remote-1',
    intentKey: 'newsletter-demo-rev-1', explicitIrreversibleIntent: true,
  } as const;

  await assert.rejects(() => boundary.send(input), /NEWSLETTER_DELIVERY_UNCERTAIN/);
  assert.deepEqual(await boundary.send(input), { status: 'manual_review_required' });
  assert.equal(sends, 1);
});
