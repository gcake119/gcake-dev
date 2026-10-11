import assert from 'node:assert/strict';
import test from 'node:test';
import { collectReleaseEligibility } from './release-eligibility';

const time = '2026-10-11T20:00:00+08:00';

test('complete series follows manifest order, independent of file order', () => {
  const r = collectReleaseEligibility(
    [{ slug: 'second', status: 'ready', readyAt: time }, { slug: 'first', status: 'ready', readyAt: time }],
    [{ slug: 's', sections: [{ posts: [{ slug: 'first', status: 'ready' }, { slug: 'second', status: 'ready' }] }] }],
  );
  assert.deepEqual(r.articles.map(x => x.slug), ['first', 'second']);
  assert.deepEqual(r.blockedSeries, []);
});
test('partially written series fails closed', () => {
  const r = collectReleaseEligibility(
    [{ slug: 'first', status: 'ready', readyAt: time }],
    [{ slug: 's', sections: [{ posts: [{ slug: 'first', status: 'ready' }, { slug: 'second', status: 'planned' }] }] }],
  );
  assert.equal(r.articles.length, 0);
  assert.equal(r.blockedSeries.length, 1);
});
test('status mismatch and missing durable timestamp block series', () => {
  const r = collectReleaseEligibility(
    [{ slug: 'a', status: 'ready' }, { slug: 'b', status: 'draft' }],
    [{ slug: 's', sections: [{ posts: [{ slug: 'a', status: 'ready' }, { slug: 'b', status: 'ready' }] }] }],
  );
  assert.equal(r.articles.length, 0);
  assert.equal(r.blockedSeries[0]?.reasons.length, 2);
});
test('published parts do not re-enter the queue', () => {
  const r = collectReleaseEligibility(
    [{ slug: 'a', status: 'published' }, { slug: 'b', status: 'ready', readyAt: time }],
    [{ slug: 's', sections: [{ posts: [{ slug: 'a', status: 'published' }, { slug: 'b', status: 'ready' }] }] }],
  );
  assert.deepEqual(r.articles.map(x=>x.slug), ['b']);
  assert.equal(r.articles[0]?.order, 1);
});
test('standalone ready post enters as standalone', () => {
  const r = collectReleaseEligibility([{ slug:'a',status:'ready',readyAt:time }], []);
  assert.equal(r.articles[0]?.kind, 'standalone');
});
test('duplicate cross-series reference fails closed', () => {
  const r = collectReleaseEligibility(
    [{ slug:'a',status:'ready',readyAt:time }],
    [{ slug:'first',sections:[{posts:[{slug:'a',status:'ready'}]}]},{slug:'second',sections:[{posts:[{slug:'a',status:'ready'}]}]}],
  );
  assert.equal(r.blockedSeries.length,2);
  assert.deepEqual(r.articles, []);
});
