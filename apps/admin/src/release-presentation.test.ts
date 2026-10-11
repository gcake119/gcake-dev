import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseLabel, releaseEstimate, seriesProgress } from './release-presentation.js';
test('release presentation distinguishes estimates, verification and external notification', () => {
  assert.equal(releaseLabel('awaiting-verification'), '待公開確認');
  assert.equal(releaseLabel('verification-unknown'), '驗證異常');
  assert.match(releaseEstimate('2026-10-12T07:00:00+08:00'), /預計.*07:00 起/);
  const progress = seriesProgress({
    sections: [
      {
        posts: [{ status: 'published' }, { status: 'ready' }, { status: 'draft' }],
      },
    ],
  });
  assert.deepEqual(progress, { ready: 2, published: 1, total: 3 });
});
