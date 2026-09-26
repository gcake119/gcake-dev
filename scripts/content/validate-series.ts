import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { listLocalPostFiles } from '../../src/lib/content/local-posts';

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
  publication?: { status: string; endsAt?: string };
  source?: { type?: 'local' | 'external' };
  sections?: ManifestSection[];
  editorial?: { currentPost?: string; nextPost?: string };
}

const seriesDir = path.resolve('src/content/series');
const postsDir = path.resolve('src/content/posts');

const seriesFiles = (await fs.readdir(seriesDir)).filter((name) => /\.ya?ml$/.test(name));
const localPosts = await listLocalPostFiles(postsDir);
const markdownFiles = new Set(localPosts.map((post) => post.slug));

let errors = 0;
let warnings = 0;

const pathsBySlug = new Map<string, string[]>();
for (const post of localPosts) {
  const paths = pathsBySlug.get(post.slug) ?? [];
  paths.push(post.path);
  pathsBySlug.set(post.slug, paths);
}
for (const [slug, paths] of pathsBySlug) {
  if (paths.length > 1) {
    console.error(`ERROR duplicate local post slug "${slug}": ${paths.join(', ')}`);
    errors++;
  }
}

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

  if (manifest.publication) {
    const { status, endsAt } = manifest.publication;
    if (!['active', 'completed', 'paused'].includes(status)) {
      console.error(`ERROR ${filename}: invalid publication.status`);
      errors++;
    }
    if (endsAt && (!/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || !Number.isFinite(Date.parse(endsAt)) || new Date(endsAt).toISOString().slice(0, 10) !== endsAt)) {
      console.error(`ERROR ${filename}: publication.endsAt must be a valid YYYY-MM-DD date`);
      errors++;
    }
    if (endsAt && (manifest.sections ?? []).some(s => (s.posts ?? []).some(p => p.status !== 'published'))) {
      console.error(`ERROR ${filename}: a scheduled series end requires all installments to be ready for publication`);
      errors++;
    }
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

      if (manifest.source?.type !== 'external' && post.status !== 'planned' && !markdownFiles.has(post.slug)) {
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
