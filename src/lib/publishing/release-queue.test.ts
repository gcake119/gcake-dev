import assert from 'node:assert/strict';
import test from 'node:test';
import { planReleaseQueue } from './release-queue';
const at = (date: string) => date + 'T12:00:00+08:00';
test('six ready series posts occupy Monday/Thursday 07:00 slots in order', () => {
  const articles = Array.from({length:6},(_,i)=>({slug:'part-'+(i+1),kind:'series' as const,seriesSlug:'ironman',order:i,readyAt:at('2026-10-11')}));
  const result = planReleaseQueue({articles,startAt:'2026-10-11T20:00:00+08:00'});
  assert.deepEqual(result.map(x=>x.releaseAt),['2026-10-12T07:00:00+08:00','2026-10-15T07:00:00+08:00','2026-10-19T07:00:00+08:00','2026-10-22T07:00:00+08:00','2026-10-26T07:00:00+08:00','2026-10-29T07:00:00+08:00']);
});
test('standalone interrupts active series while preserving internal order',()=>{
  const articles = [{slug:'a',kind:'series' as const,seriesSlug:'s',order:0,readyAt:at('2026-10-11')},{slug:'b',kind:'series' as const,seriesSlug:'s',order:1,readyAt:at('2026-10-11')},{slug:'single',kind:'standalone' as const,readyAt:at('2026-10-13')}];
  assert.deepEqual(planReleaseQueue({articles,startAt:'2026-10-11T20:00:00+08:00'}).map(x=>x.slug),['a','single','b']);
});
test('unready series does not schedule until every provided item becomes ready',()=>{
  const articles=[{slug:'a',kind:'series' as const,seriesSlug:'s',order:0,readyAt:at('2026-10-11')},{slug:'b',kind:'series' as const,seriesSlug:'s',order:1,readyAt:at('2026-10-20')}];
  const result=planReleaseQueue({articles,startAt:'2026-10-11T20:00:00+08:00'});
  assert.equal(result[0].releaseAt,'2026-10-22T07:00:00+08:00');
});
test('reserved slot is skipped',()=>{
  const result=planReleaseQueue({articles:[{slug:'one',kind:'standalone',readyAt:at('2026-10-11')}],startAt:'2026-10-11T20:00:00+08:00',reservedSlots:['2026-10-12T07:00:00+08:00']});
  assert.equal(result[0].releaseAt,'2026-10-15T07:00:00+08:00');
});
test('rejects reserved timestamps that are not an exact policy slot', () => {
  assert.throws(() => planReleaseQueue({articles:[],startAt:at('2026-10-11'),reservedSlots:[at('2026-10-12')]}), /slot/i);
});
test('rejects impossible calendar timestamps instead of normalizing them', () => {
  assert.throws(() => planReleaseQueue({articles:[],startAt:'2026-02-30T07:00:00+08:00'}), /timestamp/i);
});
test('resumes previously active series before an older waiting group', () => {
  const articles = [{slug:'waiting',kind:'series' as const,seriesSlug:'w',order:0,readyAt:at('2026-10-01')},{slug:'resume',kind:'series' as const,seriesSlug:'r',order:1,readyAt:at('2026-10-10')}];
  assert.deepEqual(planReleaseQueue({articles,startAt:at('2026-10-11'),activeSeries:'r'}).map(x=>x.slug),['resume','waiting']);
});
