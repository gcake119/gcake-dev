import { getCollection } from 'astro:content';
import { loadReadingCatalog } from '@/lib/content/catalog';
import { loadIthomeArticles } from '@/lib/content/external';

export async function GET() {
  const { posts, series } = await loadReadingCatalog();
  const local = await getCollection('posts');
  const external = loadIthomeArticles();
  const index = posts.map(post => {
    const body = post.href.includes('/series/ithome-2026/')
      ? external.find(p => p.slug === post.slug)?.body
      : local.find(p => p.id === post.slug)?.body;
    const text = (body ?? '').replace(/<[^>]*>/g, ' ').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim();
    return { title: post.title, href: post.href, series: series.find(s => s.slug === post.series)?.title ?? '獨立文章', description: post.description || text.slice(0, 100), text };
  });
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
