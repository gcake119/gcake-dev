import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublishedDate, publicationStatus, taipeiDay } from './publication';

test('publication rolls over at Taipei midnight, rather than UTC midnight', () => {
  const date = new Date('2026-09-28T00:00:00Z');
  assert.equal(taipeiDay(new Date('2026-09-27T16:00:00Z')), '2026-09-28');
  assert.equal(isPublishedDate(date, new Date('2026-09-27T15:59:59Z')), false);
  assert.equal(isPublishedDate(date, new Date('2026-09-27T16:00:00Z')), true);
  assert.equal(isPublishedDate(new Date('invalid')), false);
});

test('completed manuscripts and archived sources do not end an ongoing public schedule', () => {
  const schedule = { status: 'active' as const, endsAt: '2026-10-08' };
  assert.equal(publicationStatus('archived', schedule, new Date('2026-09-27T00:00:00Z')), 'active');
  assert.equal(publicationStatus('completed', schedule, new Date('2026-10-07T15:59:59Z')), 'active');
  assert.equal(publicationStatus('archived', schedule, new Date('2026-10-07T16:00:00Z')), 'completed');
});

test('inactivity never completes an open series and paused series remain paused', () => {
  assert.equal(publicationStatus('active', undefined, new Date('2030-01-01')), 'active');
  assert.equal(publicationStatus('archived', { status: 'paused', endsAt: '2026-10-08' }, new Date('2030-01-01')), 'paused');
});
