import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSubstackProfile, assertPublicDomEvidence, displayedDateValue } from './substack-browser';
const article = { slug: 'demo', title: 'Demo', body: 'Hello [link](https://example.com/)\n\n![Photo](https://example.com/photo.png)', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/demo/', publishedAt: '2026-09-28T00:00:00Z', sourceRevision: 'r', assets: [{ source: 'https://example.com/photo.png', alt: 'Photo' }] };
const evidence = { title: 'Demo', text: 'Hello link', links: ['https://example.com/'], images: [{ src: 'https://example.com/photo.png', alt: 'Photo', loaded: true }], canonical: article.canonicalUrl, publishedAt: article.publishedAt };
test('public readback requires content, image, link, canonical, title and date independently', () => {
  assert.doesNotThrow(() => assertPublicDomEvidence(article, evidence));
  for (const change of [{ title: 'wrong' }, { text: 'missing' }, { links: [] }, { images: [] }, { canonical: 'https://gcakedev.substack.com/p/demo' }, { publishedAt: '2026-10-01T00:00:00Z' }]) {
    assert.throws(() => assertPublicDomEvidence(article, { ...evidence, ...change }), /MISMATCH/);
  }
});
test('dedicated profile cannot be inside repo or ordinary Chrome profile', () => {
  assert.throws(() => validateSubstackProfile('/tmp/repo/.sessions', '/tmp/repo'), /PROFILE/);
  assert.throws(() => validateSubstackProfile('/Users/demo/Library/Application Support/Google/Chrome/Default', '/tmp/repo'), /PROFILE/);
  assert.doesNotThrow(() => validateSubstackProfile('/tmp/dedicated-substack', '/tmp/repo'));
});

test('full-mirror verifies exact platform canonical and original link without waiving date', () => {
  const original = article.canonicalUrl, remoteUrl = 'https://gcakedev.substack.com/p/demo';
  const mirror = { ...article, body: article.body + `\n\n[原文](${original})` };
  const mirrorEvidence = { ...evidence, text: evidence.text + ' 原文', links: [...evidence.links, original], canonical: remoteUrl };
  const policy = { policy: 'full-mirror' as const, remoteUrl };
  assert.doesNotThrow(() => assertPublicDomEvidence(mirror, mirrorEvidence, policy));
  for (const change of [{ canonical: 'https://gcakedev.substack.com/p/other' }, { links: evidence.links }, { publishedAt: '2026-10-12T00:00:00Z' }]) assert.throws(() => assertPublicDomEvidence(mirror, { ...mirrorEvidence, ...change }, policy), /MISMATCH/);
  assert.throws(() => assertPublicDomEvidence(article, { ...evidence, canonical: remoteUrl }, policy), /MISMATCH/);
});

test('displayed original date uses reviewed timezone and refuses unsupported precision', () => {
  const ui = { displayedDateFormat: 'datetime-local' as const, displayedDateOffsetMinutes: 480 };
  assert.equal(displayedDateValue('2026-09-27T16:00:00Z', ui), '2026-09-28T00:00');
  assert.equal(displayedDateValue('2026-09-28T00:00:00+08:00', ui), '2026-09-28T00:00');
  assert.throws(() => displayedDateValue('2026-09-28T00:00:01+08:00', ui), /PRECISION/);
  assert.throws(() => displayedDateValue('2026-09-28T00:00:00Z', { displayedDateFormat: 'datetime-local' }), /FORMAT/);
});

test('pre-date readback still requires a real public date and leaves final date verification strict', () => {
  const mirror = { ...article, body: article.body + `\n\n[原文](${article.canonicalUrl})` };
  const remoteUrl = 'https://gcakedev.substack.com/p/demo';
  const publicEvidence = { ...evidence, text: evidence.text + ' 原文', links: [...evidence.links, article.canonicalUrl], canonical: remoteUrl, publishedAt: '2026-10-12T00:00:00Z' };
  const preDate = { policy: 'full-mirror' as const, remoteUrl, ignoreDate: true };
  assert.doesNotThrow(() => assertPublicDomEvidence(mirror, publicEvidence, preDate));
  assert.throws(() => assertPublicDomEvidence(mirror, { ...publicEvidence, publishedAt: '' }, preDate), /MISMATCH/);
  assert.throws(() => assertPublicDomEvidence(mirror, publicEvidence, { ...preDate, ignoreDate: false }), /MISMATCH/);
});

test('approved minute precision is Substack-only and binds approvals while preserving source seconds', async () => {
  const { assertDistributionApproval } = await import('../../apps/admin-worker/src/distribution-coordinator');
  const remoteUrl = 'https://gcakedev.substack.com/p/demo';
  const source = { ...article, publishedAt: '2026-10-12T03:56:38.000Z', body: article.body + `\n\n[原文](${article.canonicalUrl})` };
  const minute = { ...source, substackDatePrecision: 'minute' as const };
  const actual = { ...evidence, canonical: remoteUrl, text: evidence.text + ' 原文', links: [...evidence.links, article.canonicalUrl], publishedAt: '2026-10-12T03:56:00.165Z' };
  const policy = { policy: 'full-mirror' as const, remoteUrl };
  assert.throws(() => assertPublicDomEvidence(source, actual, policy), /MISMATCH/);
  assert.doesNotThrow(() => assertPublicDomEvidence(minute, actual, policy));
  assert.throws(() => assertPublicDomEvidence(minute, {...actual,publishedAt:'2026-10-12T03:57:00.000Z'}, policy), /MISMATCH/);
  assert.equal(source.publishedAt, '2026-10-12T03:56:38.000Z');
  assert.equal(displayedDateValue(source.publishedAt, {displayedDateFormat:'datetime-local',displayedDateOffsetMinutes:480,displayedDatePrecision:'minute'}), '2026-10-12T11:56');
  const approval = {target:'substack' as const,slug:source.slug,sourceRevision:source.sourceRevision,approved:true as const,newsletter:'skip' as const,substackPolicy:'full-mirror' as const};
  assert.throws(() => assertDistributionApproval(minute,'substack',approval), /APPROVAL/);
  assert.doesNotThrow(() => assertDistributionApproval(minute,'substack',{...approval,substackDatePrecision:'minute'}));
});
