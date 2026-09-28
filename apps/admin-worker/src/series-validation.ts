import YAML from 'yaml';

type PostStatus = 'planned' | 'draft' | 'ready' | 'published';
type SectionStatus = 'planned' | 'active' | 'completed';

export interface SeriesPost { readonly slug: string; readonly status: PostStatus; readonly workingTitle?: string }
export interface SeriesSection {
  readonly id: string; readonly title: string; readonly status: SectionStatus; readonly posts: readonly SeriesPost[];
}
export interface SeriesManifestInput {
  readonly slug: string; readonly title: string; readonly status: string;
  readonly source?: { readonly type?: 'local' | 'external' };
  readonly sections: readonly SeriesSection[];
  readonly editorial?: { readonly currentPost?: string; readonly nextPost?: string };
  readonly [key: string]: unknown;
}

export class InvalidSeriesError extends Error {
  readonly code = 'INVALID_SERIES' as const;
  constructor(readonly issues: readonly string[]) { super(issues.join('；')); }
}

const POST_STATUSES = new Set(['planned', 'draft', 'ready', 'published']);
const SECTION_STATUSES = new Set(['planned', 'active', 'completed']);

export function validateSeries(
  manifest: SeriesManifestInput,
  options: { readonly existingMarkdownSlugs: ReadonlySet<string>; readonly otherSeriesSlugs?: ReadonlySet<string> },
): void {
  const issues: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.slug)) issues.push('系列 slug 不合法');
  if (options.otherSeriesSlugs?.has(manifest.slug)) issues.push('系列 slug 重複');
  const sections = new Set<string>();
  const posts = new Set<string>();
  for (const section of manifest.sections ?? []) {
    if (!section.id || sections.has(section.id)) issues.push(`段落 ID 重複：${section.id}`);
    sections.add(section.id);
    if (!SECTION_STATUSES.has(section.status)) issues.push(`段落狀態不合法：${section.status}`);
    for (const post of section.posts ?? []) {
      if (posts.has(post.slug)) issues.push(`文章重複：${post.slug}`);
      posts.add(post.slug);
      if (!POST_STATUSES.has(post.status)) issues.push(`文章狀態不合法：${post.status}`);
      if (manifest.source?.type !== 'external' && post.status !== 'planned' && !options.existingMarkdownSlugs.has(post.slug)) {
        issues.push(`找不到 Markdown：${post.slug}`);
      }
    }
  }
  for (const pointer of [manifest.editorial?.currentPost, manifest.editorial?.nextPost]) {
    if (pointer && !posts.has(pointer)) issues.push(`編輯指標無效：${pointer}`);
  }
  if (issues.length) throw new InvalidSeriesError(issues);
}

export function validateAndSerializeSeries(
  manifest: SeriesManifestInput,
  options: { readonly existingMarkdownSlugs: ReadonlySet<string>; readonly otherSeriesSlugs?: ReadonlySet<string> },
): { readonly yaml: string; readonly pathsToWrite: readonly [string] } {
  validateSeries(manifest, options);
  return {
    yaml: YAML.stringify(manifest, { lineWidth: 0 }),
    pathsToWrite: [`src/content/series/${manifest.slug}.yaml`],
  };
}

export function reorderSeriesPosts(
  manifest: SeriesManifestInput,
  sectionId: string,
  orderedSlugs: readonly string[],
): SeriesManifestInput {
  const sections = manifest.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const bySlug = new Map(section.posts.map((post) => [post.slug, post]));
    if (orderedSlugs.length !== section.posts.length || orderedSlugs.some((slug) => !bySlug.has(slug))) {
      throw new InvalidSeriesError(['排序必須包含段落內所有文章且不可重複']);
    }
    return { ...section, posts: orderedSlugs.map((slug) => bySlug.get(slug)!) };
  });
  if (!sections.some((section) => section.id === sectionId)) throw new InvalidSeriesError([`找不到段落：${sectionId}`]);
  return { ...manifest, sections };
}
