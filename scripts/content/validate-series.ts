import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

type PostStatus = 'planned' | 'draft' | 'ready' | 'published';

interface ManifestPost {
  slug: string;
  status: PostStatus;
  workingTitle?: string;
}

interface ManifestSection {
  id: string;
  title: string;
  posts?: ManifestPost[];
}

interface Manifest {
  slug: string;
  title: string;
  status: string;
  source?: { type?: 'local' | 'external' };
  sections?: ManifestSection[];
  editorial?: { currentPost?: string; nextPost?: string };
}

const seriesDir = path.resolve('src/content/series');
const postsDir = path.resolve('src/content/posts');

const seriesFiles = (await fs.readdir(seriesDir)).filter((name) => /\.ya?ml$/.test(name));
const markdownFiles = (await fs.readdir(postsDir).catch(() => []))
  .filter((name) => /\.mdx?$/.test(name))
  .map((name) => name.replace(/\.mdx?$/, ''));

let errors = 0;
let warnings = 0;

for (const filename of seriesFiles) {
  const raw = await fs.readFile(path.join(seriesDir, filename), 'utf8');
  const manifest = YAML.parse(raw) as Manifest;
  const seenSections = new Set<string>();
  const seenPosts = new Set<string>();

  if (!manifest.slug || !manifest.title || !manifest.status) {
    console.error(`ERROR ${filename}: slug/title/status are required`);
    errors++;
    continue;
  }

  for (const section of manifest.sections ?? []) {
    if (seenSections.has(section.id)) {
      console.error(`ERROR ${filename}: duplicate section id "${section.id}"`);
      errors++;
    }
    seenSections.add(section.id);

    for (const post of section.posts ?? []) {
      if (seenPosts.has(post.slug)) {
        console.error(`ERROR ${filename}: post "${post.slug}" appears more than once`);
        errors++;
      }
      seenPosts.add(post.slug);

      if (manifest.source?.type !== 'external' && post.status !== 'planned' && !markdownFiles.includes(post.slug)) {
        console.error(`ERROR ${filename}: ${post.status} post "${post.slug}" has no Markdown file`);
        errors++;
      }
    }
  }

  for (const pointer of [manifest.editorial?.currentPost, manifest.editorial?.nextPost].filter(Boolean) as string[]) {
    if (!seenPosts.has(pointer)) {
      console.warn(`WARN  ${filename}: editorial pointer "${pointer}" is not in the series outline`);
      warnings++;
    }
  }

  if (manifest.status === 'completed') {
    const unfinished = [...seenPosts].filter((slug) => {
      for (const section of manifest.sections ?? []) {
        const post = section.posts?.find((item) => item.slug === slug);
        if (post && post.status !== 'published') return true;
      }
      return false;
    });
    if (unfinished.length) {
      console.error(`ERROR ${filename}: completed series has unfinished posts: ${unfinished.join(', ')}`);
      errors++;
    }
  }
}

console.log(`Series validation finished: ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exit(1);
