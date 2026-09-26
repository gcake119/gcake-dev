import rss from '@astrojs/rss';
import { loadReadingCatalog } from '@/lib/content/catalog';
import { site } from '@/data/site';

export async function GET(context: { site: URL }) {
  const { posts } = await loadReadingCatalog();

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: posts.filter(post => post.date).map((post) => ({
      title: post.title,
      description: post.description ?? '',
      pubDate: post.date!,
      link: post.href,
    })),
  });
}
