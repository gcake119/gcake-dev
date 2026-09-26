import { getCollection } from 'astro:content';
import { loadSeriesManifests } from './series';
import { loadIthomeArticles, ithomePublicationState } from './external';
import { isPublishedDate, publicationStatus } from './publication';
import { site } from '../../data/site';

export interface ReadingPost {
  slug: string;
  title: string;
  description?: string;
  date?: Date;
  href: string;
  series?: string;
}

export async function loadReadingCatalog() {
  const manifests = await loadSeriesManifests();
  const local = (await getCollection('posts')).filter(p => p.data.status === 'published' && isPublishedDate(p.data.publishedAt));
  const posts: ReadingPost[] = local.map(p => ({ slug: p.id, title: p.data.title, description: p.data.description, date: p.data.publishedAt, href: `${site.basePath}/posts/${p.id}/`, series: p.data.series }));
  const external = loadIthomeArticles();
  for (const manifest of manifests.filter(s => s.source?.type === 'external' && s.slug === 'ithome-2026')) {
    const refs = new Set(manifest.sections.flatMap(s => s.posts).filter(p => p.status === 'published').map(p => p.slug));
    posts.push(...external.filter(p => refs.has(p.slug)).map(p => ({ slug: p.slug, title: p.title, description: p.description, date: p.publishedAt, href: `${site.basePath}/series/${manifest.slug}/${p.slug}/`, series: manifest.slug })));
  }
  const series = manifests.filter(s => s.status !== 'planned').map(manifest => {
    const map = new Map(posts.filter(p => p.series === manifest.slug).map(p => [p.slug, p]));
    const sections = manifest.sections.map(section => ({ ...section, articles: section.posts.filter(p => p.status === 'published').map(p => map.get(p.slug)).filter((p): p is ReadingPost => !!p) }));
    const articles = sections.flatMap(s => s.articles);
    const dates = articles.flatMap(p => p.date ? [p.date] : []).sort((a,b) => a.getTime() - b.getTime());
    const status = manifest.slug === 'ithome-2026' ? ithomePublicationState() : publicationStatus(manifest.status, manifest.publication);
    return { ...manifest, sections, articles, publicationState: status, firstDate: dates[0], latestDate: dates.at(-1) };
  }).filter(s => s.articles.length > 0).sort((a,b) => Number(b.publicationState === 'active') - Number(a.publicationState === 'active') || (b.latestDate?.getTime() ?? 0) - (a.latestDate?.getTime() ?? 0) || a.slug.localeCompare(b.slug));
  return { series, posts: posts.sort((a,b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)) };
}

export type ReadingSeries = Awaited<ReturnType<typeof loadReadingCatalog>>['series'][number];
