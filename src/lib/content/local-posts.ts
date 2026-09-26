import fs from 'node:fs/promises';
import path from 'node:path';

const MARKDOWN_EXTENSION = /\.mdx?$/i;

export interface LocalPostFile {
  slug: string;
  path: string;
}

export function localPostSlugFromEntry(entry: string): string {
  const filename = entry.split(/[\\/]/).at(-1) ?? entry;
  return filename.replace(MARKDOWN_EXTENSION, '');
}

export async function listLocalPostFiles(rootDir: string): Promise<LocalPostFile[]> {
  async function walk(dir: string): Promise<LocalPostFile[]> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      if (!entry.isFile() || !MARKDOWN_EXTENSION.test(entry.name)) return [];
      return [{ slug: localPostSlugFromEntry(entry.name), path: fullPath }];
    }));

    return nested.flat();
  }

  return walk(rootDir);
}

export async function resolveLocalPostFile(rootDir: string, slug: string): Promise<string | undefined> {
  const matches = (await listLocalPostFiles(rootDir)).filter((post) => post.slug === slug);
  if (matches.length > 1) {
    throw new Error(`Duplicate local post slug "${slug}": ${matches.map((post) => post.path).join(', ')}`);
  }
  return matches[0]?.path;
}
