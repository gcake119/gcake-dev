import fs from 'node:fs/promises';
import path from 'node:path';

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: pnpm paragraph:prepare <post-slug>');
  process.exit(1);
}

const candidates = [
  path.resolve('src/content/posts', `${slug}.md`),
  path.resolve('src/content/posts', `${slug}.mdx`),
];

let source: string | undefined;
let sourcePath: string | undefined;

for (const candidate of candidates) {
  try {
    source = await fs.readFile(candidate, 'utf8');
    sourcePath = candidate;
    break;
  } catch {
    // Try next extension.
  }
}

if (!source || !sourcePath) {
  throw new Error(`Post not found: ${slug}`);
}

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
