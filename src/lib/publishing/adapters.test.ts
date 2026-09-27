import assert from 'node:assert/strict';
import test from 'node:test';
import { paragraphDryRunAdapter, substackDryRunAdapter } from './dry-run-adapters';
import type { PortablePublication } from './publication-transform';

const publication: PortablePublication = {
  slug: 'adapter-boundary',
  title: 'Adapter boundary',
  canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/adapter-boundary/',
  distributionMode: 'full',
  body: 'Portable body.',
  assets: [],
  sourceRevision: 'abc123',
};

test('Paragraph dry run validates a create-draft plan without enabling writes or newsletter', async () => {
  const plan = await paragraphDryRunAdapter.prepare({ publication, newsletter: 'skip' });
  assert.equal(plan.target, 'paragraph');
  assert.equal(plan.operation, 'create-draft');
  assert.equal(plan.externalWriteEnabled, false);
  assert.equal(plan.newsletter, 'skip');
  await assert.rejects(() => paragraphDryRunAdapter.publish(plan), /disabled/);
});

test('Paragraph updates and newsletter sends remain separate decisions', async () => {
  const plan = await paragraphDryRunAdapter.prepare({ publication, remoteId: 'remote-1', newsletter: 'send' });
  assert.equal(plan.operation, 'update-draft');
  assert.equal(plan.newsletter, 'send');
  assert.equal(plan.externalWriteEnabled, false);
});

test('Substack dry run stays provider-payload independent and cannot publish', async () => {
  const plan = await substackDryRunAdapter.prepare({ publication, newsletter: 'skip' });
  assert.equal(plan.target, 'substack');
  assert.equal(plan.interfaceStability, 'no-official-publishing-api');
  assert.deepEqual(plan.payload, { portablePublication: publication });
  await assert.rejects(() => substackDryRunAdapter.verify({ remoteId: 'none' }), /disabled/);
});
