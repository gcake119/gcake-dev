import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveLocalPostFile } from '../../src/lib/content/local-posts';

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: pnpm paragraph:prepare <post-slug>');
  process.exit(1);
}

const postsDir = path.resolve('src/content/posts');
const sourcePath = await resolveLocalPostFile(postsDir, slug);

if (!sourcePath) {
  throw new Error(`Post not found: ${slug}`);
}

const source = await fs.readFile(sourcePath, 'utf8');
const canonicalUrl = `https://gcake119.github.io/gcake-dev/posts/${slug}/`;

console.log(
  JSON.stringify(
    {
      slug,
      sourcePath,
      canonicalUrl,
      markdown: source,
      note: 'Paragraph is a publication target only. Do not write changes back from Paragraph.',
    },
    null,
    2,
  ),
);
