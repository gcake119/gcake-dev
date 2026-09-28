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
