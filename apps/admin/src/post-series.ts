import type { PostSummary, SeriesSource } from '@gcake/admin-contract';
import YAML from 'yaml';

export type SeriesFilter = 'all' | 'standalone' | string;

export function filterPostsBySeries(
  posts: readonly PostSummary[],
  filter: SeriesFilter,
): readonly PostSummary[] {
  if (filter === 'all') return posts;
  if (filter === 'standalone') return posts.filter((post) => post.series.length === 0);
  return posts.filter((post) => post.series.some((membership) => membership.slug === filter));
}

export function standalonePosts(
  posts: readonly PostSummary[],
  series: readonly SeriesSource[],
): readonly PostSummary[] {
  const referenced = new Set<string>();
  for (const item of series) {
    const manifest = YAML.parse(item.source) as { sections?: Array<{ posts?: Array<{ slug?: unknown }> }> };
    for (const section of manifest.sections ?? []) {
      for (const post of section.posts ?? []) {
        if (typeof post.slug === 'string') referenced.add(post.slug);
      }
    }
  }
  return posts.filter((post) => !referenced.has(post.slug));
}

export function createStandaloneSource(title: string): string {
  return YAML.stringify({
    title: title.trim(),
    status: 'draft',
    topics: [],
    distribution: { mode: 'full' },
  }, { lineWidth: 0 })
    .replace(/^/, '---\n')
    .concat('---\n\n');
}

export function updatePostTitle(source: string, title: string): string {
  const closing = source.indexOf('\n---', 4);
  if (!source.startsWith('---\n') || closing < 0) return source;
  const frontmatter = source.slice(4, closing);
  const titleLine = YAML.stringify({ title: title.trim() }, { lineWidth: 0 }).trim();
  const updated = /^title:.*$/m.test(frontmatter)
    ? frontmatter.replace(/^title:.*$/m, titleLine)
    : `${titleLine}\n${frontmatter}`;
  return `---\n${updated}${source.slice(closing)}`;
}
