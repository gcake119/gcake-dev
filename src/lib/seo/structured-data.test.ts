import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '../../data/site';
import {
  articleStructuredData,
  breadcrumbStructuredData,
  profileStructuredData,
  seriesStructuredData,
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
    image: '/images/example.png',
    series: {
      title: 'Example series',
      url: `${site.url}/series/example-series/`,
    },
  }) as Record<string, any>;

  assert.equal(data['@type'], 'BlogPosting');
  assert.equal(data.url, canonical);
  assert.equal(data.inLanguage, 'zh-Hant');
  assert.equal(data.mainEntityOfPage['@id'], canonical);
  assert.equal(data.author['@id'], `${site.url}/about/#author`);
  assert.equal(data.author.name, site.author.name);
  assert.equal(data.author.url, `${site.url}/about/`);
  assert.deepEqual(data.keywords, ['系統設計']);
  assert.deepEqual(data.about, [{ '@type': 'Thing', name: '系統設計' }]);
  assert.equal(data.articleSection, 'Example series');
  assert.equal(data.isPartOf.url, `${site.url}/series/example-series/`);
  assert.equal(data.image, `${site.url}/images/example.png`);
  assert.equal(data.datePublished, '2026-09-30T00:00:00.000Z');
  assert.equal(data.dateModified, '2026-10-01T00:00:00.000Z');
});

test('profile structured data exposes one stable author entity', () => {
  const data = profileStructuredData() as Record<string, any>;
  assert.equal(data['@type'], 'ProfilePage');
  assert.equal(data.inLanguage, 'zh-Hant');
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


test('series structured data exposes an ordered article collection', () => {
  const canonical = `${site.url}/series/example-series/`;
  const data = seriesStructuredData({
    title: 'Example series',
    description: 'Series description',
    canonical,
    articles: [
      { title: 'First', url: `${canonical}first/` },
      { title: 'Second', url: `${canonical}second/` },
    ],
  }) as Record<string, any>;

  assert.equal(data['@type'], 'CollectionPage');
  assert.equal(data.url, canonical);
  assert.equal(data.inLanguage, 'zh-Hant');
  assert.equal(data.mainEntity['@type'], 'ItemList');
  assert.equal(data.mainEntity.numberOfItems, 2);
  assert.deepEqual(data.mainEntity.itemListElement.map((item: any) => item.position), [1, 2]);
  assert.deepEqual(data.mainEntity.itemListElement.map((item: any) => item.name), ['First', 'Second']);
});
