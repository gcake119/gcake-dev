import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '../../data/site';
import {
  articleStructuredData,
  breadcrumbStructuredData,
  profileStructuredData,
} from './structured-data';

test('article structured data uses canonical page and shared author identity', () => {
  const canonical = `${site.url}/posts/example/`;
  const data = articleStructuredData({
    title: 'Example',
    description: 'Example description',
    canonical,
    publishedAt: new Date('2026-09-30T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    topics: ['系統設計'],
  }) as Record<string, any>;

  assert.equal(data['@type'], 'BlogPosting');
  assert.equal(data.mainEntityOfPage['@id'], canonical);
  assert.equal(data.author['@id'], `${site.url}/about/#author`);
  assert.deepEqual(data.keywords, ['系統設計']);
  assert.equal(data.datePublished, '2026-09-30T00:00:00.000Z');
  assert.equal(data.dateModified, '2026-10-01T00:00:00.000Z');
});

test('profile structured data exposes one stable author entity', () => {
  const data = profileStructuredData() as Record<string, any>;
  assert.equal(data['@type'], 'ProfilePage');
  assert.equal(data.mainEntity['@id'], `${site.url}/about/#author`);
  assert.equal(data.mainEntity.name, site.author.name);
  assert.ok(data.mainEntity.sameAs.includes(site.author.github));
});

test('breadcrumb structured data preserves reading order', () => {
  const data = breadcrumbStructuredData([
    { name: '首頁', url: site.url },
    { name: '文章', url: `${site.url}/posts/` },
  ]) as Record<string, any>;

  assert.deepEqual(data.itemListElement.map((item: any) => item.position), [1, 2]);
  assert.deepEqual(data.itemListElement.map((item: any) => item.name), ['首頁', '文章']);
});
