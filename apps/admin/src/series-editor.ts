import YAML from 'yaml';

export interface AdminSeriesPost { slug: string; status: string; workingTitle?: string }
export interface AdminSeriesSection { id: string; title: string; status: string; posts: AdminSeriesPost[]; [key: string]: unknown }
export interface AdminSeriesManifest { slug: string; title: string; status: string; sections: AdminSeriesSection[]; [key: string]: unknown }

export function parseSeriesManifest(source: string): AdminSeriesManifest {
  const manifest = YAML.parse(source) as AdminSeriesManifest;
  if (!manifest || typeof manifest.slug !== 'string' || !Array.isArray(manifest.sections)) throw new Error('INVALID_SERIES');
  return manifest;
}

export function serializeSeriesManifest(manifest: AdminSeriesManifest): string {
  return YAML.stringify(manifest, { lineWidth: 0 });
}

export function addSeriesSection(manifest: AdminSeriesManifest): AdminSeriesManifest {
  const existingIds = new Set(manifest.sections.map((section) => section.id));
  let chapterNumber = 1;
  while (existingIds.has(`chapter-${chapterNumber}`)) chapterNumber += 1;
  return {
    ...manifest,
    sections: [
      ...manifest.sections,
      { id: `chapter-${chapterNumber}`, title: '新章節', status: 'planned', posts: [] },
    ],
  };
}

export function updateSeriesSection(
  manifest: AdminSeriesManifest,
  sectionId: string,
  patch: Partial<Pick<AdminSeriesSection, 'id' | 'title' | 'status'>>,
): AdminSeriesManifest {
  return {
    ...manifest,
    sections: manifest.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
  };
}

export function moveSeriesSection(manifest: AdminSeriesManifest, index: number, delta: -1 | 1): AdminSeriesManifest {
  const target = index + delta;
  if (target < 0 || target >= manifest.sections.length) return manifest;
  const sections = manifest.sections.map((section) => ({ ...section, posts: section.posts.map((post) => ({ ...post })) }));
  const [section] = sections.splice(index, 1);
  if (section) sections.splice(target, 0, section);
  return { ...manifest, sections };
}

export function removeEmptySeriesSection(manifest: AdminSeriesManifest, sectionId: string): AdminSeriesManifest {
  const section = manifest.sections.find((item) => item.id === sectionId);
  if (!section || section.posts.length > 0) return manifest;
  return { ...manifest, sections: manifest.sections.filter((item) => item.id !== sectionId) };
}

export function moveSeriesPost(manifest: AdminSeriesManifest, sectionId: string, index: number, delta: -1 | 1): AdminSeriesManifest {
  return {
    ...manifest,
    sections: manifest.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const target = index + delta;
      if (target < 0 || target >= section.posts.length) return section;
      const posts = section.posts.map((post) => ({ ...post }));
      const [post] = posts.splice(index, 1);
      if (post) posts.splice(target, 0, post);
      return { ...section, posts };
    }),
  };
}

export function addSeriesPost(
  manifest: AdminSeriesManifest,
  sectionId: string,
  post: AdminSeriesPost,
): AdminSeriesManifest {
  if (manifest.sections.some((section) => section.posts.some((item) => item.slug === post.slug))) return manifest;
  return {
    ...manifest,
    sections: manifest.sections.map((section) => section.id === sectionId
      ? { ...section, posts: [...section.posts, { ...post }] }
      : section),
  };
}
