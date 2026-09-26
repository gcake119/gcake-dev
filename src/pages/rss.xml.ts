import rss from '@astrojs/rss';
import { loadIthomeArticles } from '@/lib/content/external';
import { isPublishedDate } from '@/lib/content/publication';
import { getCollection } from 'astro:content';
import { site } from '@/data/site';

export async function GET(context: { site: URL }) {
  const posts = (await getCollection('posts'))
    .filter((post) => post.data.status === 'published' && isPublishedDate(post.data.publishedAt) && post.data.publishedAt)
    .sort((a, b) => (b.data.publishedAt?.getTime() ?? 0) - (a.data.publishedAt?.getTime() ?? 0));

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: [...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      pubDate: post.data.publishedAt!,
      link: `/gcake-dev/posts/${post.id}/`,
    })), ...loadIthomeArticles().map(post => ({ title: post.title, description: post.description ?? '', pubDate: post.publishedAt!, link: `${site.basePath}/series/ithome-2026/${post.slug}/` }))],
  });
}
