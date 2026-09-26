import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { getCollection } from 'astro:content';
import { isPublishedDate } from './publication';
import { loadIthomeArticles, ithomePublicationState } from './external';
import type { SeriesManifest } from './types';

const SERIES_DIR = path.resolve('src/content/series');

export async function loadSeriesManifests(): Promise<SeriesManifest[]> {
  const names = await fs.readdir(SERIES_DIR).catch(() => []);
  const files = names.filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'));

  const publicLocal = new Set((await getCollection('posts')).filter(p => p.data.status === 'published' && isPublishedDate(p.data.publishedAt)).map(p => p.id));
  const publicExternal = new Set(loadIthomeArticles().map(p => p.slug));
  return Promise.all(
    files.map(async (name) => {
      const raw = await fs.readFile(path.join(SERIES_DIR, name), 'utf8');
      const series = YAML.parse(raw) as SeriesManifest;
      const external = series.slug === 'ithome-2026' && series.source?.type === 'external';
      const visible = external ? publicExternal : publicLocal;
      series.sections = series.sections.map(section => ({ ...section, posts: section.posts.filter(post => post.status !== 'published' || visible.has(post.slug)) }));
      if (external) series.status = ithomePublicationState();
      if (series.editorial?.currentPost && !visible.has(series.editorial.currentPost)) series.editorial.currentPost = undefined;
      return series;
    }),
  );
}

export async function getSeriesManifest(slug: string) {
  const all = await loadSeriesManifests();
  return all.find((series) => series.slug === slug);
}
