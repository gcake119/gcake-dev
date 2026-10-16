import assert from 'node:assert/strict';
import test from 'node:test';
import { seriesMembership } from './series-membership';

test('rename exposes only the new series slug while preserving post membership order', () => {
  const membership = seriesMembership([{
    slug: 'new-series',
    sections: [{ posts: [{ slug: 'one' }, { slug: 'two' }] }],
  }]);
  assert.deepEqual([...membership.entries()], [['one', 'new-series'], ['two', 'new-series']]);
  assert.equal([...membership.values()].includes('old-series'), false);
});

test('deleting a manifest makes its former posts standalone', () => {
  const membership = seriesMembership([]);
  assert.equal(membership.get('one'), undefined);
  assert.equal(membership.get('two'), undefined);
});
