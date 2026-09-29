import { getCollection } from 'astro:content';
import { loadReadingCatalog } from '@/lib/content/catalog';
import { isPublicPost } from '@/lib/content/publication';
import { loadTopicTaxonomy } from '@/lib/content/topics';
import { localCanonical } from '@/lib/seo/canonical';

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const { series } = await loadReadingCatalog();
  const localPosts = (await getCollection('posts')).filter((post) => isPublicPost(post.data));
  const taxonomy = await loadTopicTaxonomy();
  const usedTopicIds = new Set(localPosts.flatMap((post) => post.data.topics));
  const topics = taxonomy.filter((topic) => usedTopicIds.has(topic.id));

  const urls: { loc: string; lastmod?: Date }[] = [
    { loc: localCanonical('/') },
    { loc: localCanonical('/about/') },
    { loc: localCanonical('/posts/') },
    { loc: localCanonical('/series/') },
    { loc: localCanonical('/topics/') },
    ...series.map((item) => ({ loc: localCanonical(`/series/${item.slug}/`), lastmod: item.latestDate })),
    ...localPosts.map((post) => ({
      loc: localCanonical(`/posts/${post.id}/`),
      lastmod: post.data.updatedAt ?? post.data.publishedAt,
    })),
    ...topics.map((topic) => ({ loc: localCanonical(`/topics/${topic.id}/`) })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      `    <loc>${xmlEscape(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod.toISOString()}</lastmod>`] : []),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
