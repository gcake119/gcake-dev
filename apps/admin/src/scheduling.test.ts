import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTaipeiSchedule, schedulePresentation, serializeTaipeiSchedule } from './scheduling';

test('new CMS schedules are serialized with an explicit Taipei offset', () => {
  assert.equal(serializeTaipeiSchedule('2026-10-15', '09:00'), '2026-10-15T09:00:00+08:00');
  assert.throws(() => serializeTaipeiSchedule('2026-02-30', '09:00'), /INVALID_PUBLICATION_TIME/);
});

test('schedule editor changes only the canonical publishedAt frontmatter value', () => {
  const source = '---\ntitle: Example\npublishedAt: 2026-10-15\nstatus: published\n---\nBody\n';
  assert.equal(
    applyTaipeiSchedule(source, '2026-10-15', '09:00'),
    '---\ntitle: Example\npublishedAt: 2026-10-15T09:00:00+08:00\nstatus: published\n---\nBody\n',
  );
});

test('presentation separates scheduled, due-awaiting-build, and post-instant deployment', () => {
  const publishedAt = '2026-10-15T09:00:00+08:00';
  assert.equal(schedulePresentation(publishedAt, undefined, new Date('2026-10-15T00:59:59Z')).state, 'scheduled');
  assert.equal(schedulePresentation(publishedAt, { state: 'building', completedAt: undefined }, new Date('2026-10-15T01:00:00Z')).state, 'due-awaiting-build');
  assert.equal(schedulePresentation(publishedAt, { state: 'deployed', completedAt: '2026-10-15T00:59:59Z' }, new Date('2026-10-15T01:05:00Z')).state, 'due-awaiting-build');
  assert.equal(schedulePresentation(publishedAt, { state: 'deployed', completedAt: '2026-10-15T01:02:00Z' }, new Date('2026-10-15T01:05:00Z')).state, 'deployed-visible');
});
