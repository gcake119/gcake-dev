import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { SeriesManifest } from './types';

const SERIES_DIR = path.resolve('src/content/series');

export async function loadSeriesManifests(): Promise<SeriesManifest[]> {
  const names = await fs.readdir(SERIES_DIR).catch(() => []);
  const files = names.filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'));

  return Promise.all(
    files.map(async (name) => {
      const raw = await fs.readFile(path.join(SERIES_DIR, name), 'utf8');
      return YAML.parse(raw) as SeriesManifest;
    }),
  );
}

export async function getSeriesManifest(slug: string) {
  const all = await loadSeriesManifests();
  return all.find((series) => series.slug === slug);
}
