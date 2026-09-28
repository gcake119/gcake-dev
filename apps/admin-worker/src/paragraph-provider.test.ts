import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryPublicationRepository } from './publication-operations';
import {
  PARAGRAPH_OPENAPI_COMMIT,
  ParagraphProductionService,
  ParagraphRestClient,
  type ParagraphPostEvidence,
  type ParagraphProviderClient,
  type ParagraphPublicationInput,
} from './paragraph-provider';

const firstRevision: ParagraphPublicationInput = {
  postSlug: 'gcake-cms-production-gate-20260928',
  sourceRevision: 'revision-1',
  title: 'CMS production gate',
  subtitle: 'Controlled Paragraph provider verification',
  markdown: '# Production gate\n\nInitial controlled body.',
  canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/gcake-cms-production-gate-20260928/',
  publishedAt: '2026-09-28T17:30:00+08:00',
  publicationSlug: 'gcake',
};

class FakeParagraphClient implements ParagraphProviderClient {
  readonly calls: Array<{ readonly method: string; readonly remoteId?: string; readonly sendNewsletter?: boolean }> = [];
  remoteId: string | undefined;
  privateEvidence: ParagraphPostEvidence | undefined;
  publicEvidence: ParagraphPostEvidence | undefined;
  publicHtml = '';

  async findOwnBySlug() { this.calls.push({ method: 'find' }); return this.remoteId ? [{ id: this.remoteId }] : []; }
  async createDraft(input: ParagraphPublicationInput) {
    this.calls.push({ method: 'create', sendNewsletter: false });
    this.remoteId = 'remote-1';
    assert.equal(input.postSlug, firstRevision.postSlug);
    return { id: 'remote-1' };
  }
  async updateDraft(remoteId: string) { this.calls.push({ method: 'update', remoteId, sendNewsletter: false }); }
  async publish(remoteId: string) { this.calls.push({ method: 'publish', remoteId, sendNewsletter: false }); }
  async readPrivate() { this.calls.push({ method: 'read-private' }); return this.privateEvidence; }
  async readPublic() { this.calls.push({ method: 'read-public' }); return this.publicEvidence; }
  async readPublicHtml() { this.calls.push({ method: 'read-public-html' }); return this.publicHtml; }
}

test('pinned REST contract creates a draft, updates canonical/date, and publishes online without newsletter', async () => {
  assert.equal(PARAGRAPH_OPENAPI_COMMIT, '56c2fd279cfad810dab400236773406e41080d65');
  const requests: Array<{ readonly url: string; readonly init: RequestInit; readonly body?: Record<string, unknown> }> = [];
  const responses = [
    Response.json({ id: 'remote-1' }),
    Response.json({ id: 'remote-1' }),
    Response.json({ id: 'remote-1' }),
  ];
  const client = new ParagraphRestClient('secret-not-logged', async (url, init = {}) => {
    requests.push({
      url: String(url), init,
      body: typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : undefined,
    });
    return responses.shift() ?? Response.json({}, { status: 500 });
  });

  const created = await client.createDraft(firstRevision);
  await client.updateDraft(created.id, firstRevision);
  await client.publish(created.id, firstRevision);

  assert.deepEqual(requests.map((request) => [request.init.method, new URL(request.url).pathname]), [
    ['POST', '/api/v1/posts'],
    ['PUT', '/api/v1/posts/remote-1'],
    ['PUT', '/api/v1/posts/remote-1'],
  ]);
  assert.deepEqual(requests[0]?.body, {
    title: firstRevision.title, subtitle: firstRevision.subtitle, slug: firstRevision.postSlug,
    markdown: firstRevision.markdown, status: 'draft', sendNewsletter: false,
  });
  assert.equal(requests[1]?.body?.canonicalUrl, firstRevision.canonicalUrl);
  assert.equal(requests[1]?.body?.publishedAt, 1790587800000);
  assert.deepEqual(requests[2]?.body, {
    status: 'published', publishOnline: true, canonicalUrl: firstRevision.canonicalUrl,
    publishedAt: 1790587800000, sendNewsletter: false,
  });
  assert.equal(requests.some((request) => request.body?.sendNewsletter === true), false);
});

test('dry run is local-only and a changed payload invalidates its receipt before provider calls', async () => {
  const client = new FakeParagraphClient();
  const service = new ParagraphProductionService(new InMemoryPublicationRepository(), client, () => '2026-09-28T09:30:00.000Z');
  const receipt = await service.dryRun(firstRevision);
  assert.equal(receipt.operation, 'create');
  assert.equal(client.calls.length, 0);

  await assert.rejects(
    () => service.publish({ ...firstRevision, markdown: 'changed after dry run' }, receipt),
    /PARAGRAPH_DRY_RUN_MISMATCH/,
  );
  assert.equal(client.calls.length, 0);
});

test('first publish persists remote ID before update and publish, always without newsletter', async () => {
  const repository = new InMemoryPublicationRepository();
  const client = new FakeParagraphClient();
  const service = new ParagraphProductionService(repository, client, () => '2026-09-28T09:30:00.000Z');
  const receipt = await service.dryRun(firstRevision);
  const state = await service.publish(firstRevision, receipt);

  assert.equal(state.remoteId, 'remote-1');
  assert.equal(state.sourceRevision, 'revision-1');
  assert.equal(state.status, 'published');
  assert.deepEqual(client.calls.map((call) => call.method), ['find', 'create', 'update', 'publish']);
  assert.equal(client.calls.some((call) => call.sendNewsletter === true), false);
  assert.equal(repository.states.at(-1)?.remoteId, 'remote-1');
});

test('new source revision updates the persisted remote ID and never creates a duplicate', async () => {
  const repository = new InMemoryPublicationRepository();
  await repository.putState({
    postSlug: firstRevision.postSlug, target: 'paragraph', sourceRevision: 'revision-1',
    status: 'verified', remoteId: 'remote-1', remoteUrl: 'https://paragraph.com/@gcake/gcake-cms-production-gate-20260928',
    updatedAt: '2026-09-28T09:00:00.000Z',
  });
  const client = new FakeParagraphClient();
  const service = new ParagraphProductionService(repository, client, () => '2026-09-28T09:35:00.000Z');
  const next = { ...firstRevision, sourceRevision: 'revision-2', markdown: '# Updated body' };
  const receipt = await service.dryRun(next);
  assert.equal(receipt.operation, 'update');
  await service.publish(next, receipt);

  assert.deepEqual(client.calls.map((call) => call.method), ['update', 'publish']);
  assert.equal(repository.states[0]?.remoteId, 'remote-1');
  assert.equal(repository.states[0]?.sourceRevision, 'revision-2');
});

test('verification requires private, public API, and public HTML canonical evidence before persisting verified', async () => {
  const repository = new InMemoryPublicationRepository();
  await repository.putState({
    postSlug: firstRevision.postSlug, target: 'paragraph', sourceRevision: firstRevision.sourceRevision,
    status: 'published', remoteId: 'remote-1', remoteUrl: 'https://paragraph.com/@gcake/gcake-cms-production-gate-20260928',
    updatedAt: '2026-09-28T09:30:00.000Z',
  });
  const client = new FakeParagraphClient();
  const evidence = {
    id: 'remote-1', slug: firstRevision.postSlug, status: 'published' as const,
    publishedAt: '1790587800000',
    markdown: 'Production gate\n===============\n\nInitial controlled body.',
  };
  client.privateEvidence = evidence;
  client.publicEvidence = { ...evidence, status: undefined as unknown as 'published' };
  client.publicHtml = `<html><head><link rel="canonical" href="${firstRevision.canonicalUrl}"></head></html>`;
  const service = new ParagraphProductionService(repository, client, () => '2026-09-28T09:40:00.000Z');
  const verified = await service.verify(firstRevision);
  assert.equal(verified.status, 'verified');
  assert.equal(verified.verifiedAt, '2026-09-28T09:40:00.000Z');

  client.publicHtml = '<html><head></head></html>';
  await assert.rejects(() => service.verify(firstRevision), /PARAGRAPH_PUBLIC_CANONICAL_MISMATCH/);
});
