import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPublicPost,
  isPublishedDate,
  parsePublicationTime,
  publicationStatus,
  serializeTaipeiSchedule,
  taipeiDay,
} from './publication';

test('publication rolls over at Taipei midnight, rather than UTC midnight', () => {
  const date = parsePublicationTime('2026-09-28').instant;
  assert.equal(taipeiDay(new Date('2026-09-27T16:00:00Z')), '2026-09-28');
  assert.equal(isPublishedDate(date, new Date('2026-09-27T15:59:59Z')), false);
  assert.equal(isPublishedDate(date, new Date('2026-09-27T16:00:00Z')), true);
  assert.equal(isPublishedDate(new Date('invalid')), false);
});

test('legacy date begins at Taipei midnight while offset date-time uses its exact instant', () => {
  const legacy = parsePublicationTime('2026-10-15');
  assert.equal(legacy.representation, 'legacy-date');
  assert.equal(isPublishedDate(legacy.instant, new Date('2026-10-14T15:59:59Z')), false);
  assert.equal(isPublishedDate(legacy.instant, new Date('2026-10-14T16:00:00Z')), true);

  const timed = parsePublicationTime('2026-10-15T09:00:00+08:00');
  assert.equal(timed.representation, 'offset-date-time');
  assert.equal(isPublishedDate(timed.instant, new Date('2026-10-15T00:59:59Z')), false);
  assert.equal(isPublishedDate(timed.instant, new Date('2026-10-15T01:00:00Z')), true);
  assert.equal(serializeTaipeiSchedule('2026-10-15', '09:00'), '2026-10-15T09:00:00+08:00');
});

test('invalid publication input fails closed and undated published posts stay compatible', () => {
  assert.throws(() => parsePublicationTime('2026-10-15T09:00:00'));
  assert.equal(isPublicPost({ status: 'published' }, new Date('2030-01-01')), true);
  assert.equal(isPublicPost({ status: 'draft' }, new Date('2030-01-01')), false);
  assert.equal(isPublicPost({ status: 'published', publishedAt: new Date('invalid') }, new Date('2030-01-01')), false);
});

test('offset-aware visibility is timezone-environment independent', () => {
  const instant = parsePublicationTime('2026-10-15T09:00:00+08:00').instant;
  assert.equal(instant.toISOString(), '2026-10-15T01:00:00.000Z');
  assert.equal(isPublishedDate(instant, new Date('2026-10-15T01:00:00Z')), true);
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
