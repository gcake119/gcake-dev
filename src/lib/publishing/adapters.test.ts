import assert from 'node:assert/strict';
import test from 'node:test';
import { substackDryRunAdapter } from './dry-run-adapters';
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

test('Substack dry run stays provider-payload independent and cannot publish', async () => {
  const plan = await substackDryRunAdapter.prepare({ publication, newsletter: 'skip' });
  assert.equal(plan.target, 'substack');
  assert.equal(plan.interfaceStability, 'no-official-publishing-api');
  assert.deepEqual(plan.payload, { portablePublication: publication });
  await assert.rejects(() => substackDryRunAdapter.verify({ remoteId: 'none' }), /disabled/);
});
