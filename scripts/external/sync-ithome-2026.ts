import fs from 'node:fs/promises';
import path from 'node:path';

const OWNER = 'gcake119';
const REPO = 'ithome-2026';
const BRANCH = 'main';
const OUTPUT = path.resolve('src/data/external/ithome-2026.generated.json');

interface ExternalPost {
  slug: string;
  day: number;
  canonicalUrl: string;
  sourceUrl: string;
  markdown: string;
}

const posts: ExternalPost[] = [];

for (let day = 1; day <= 30; day++) {
  const dayString = String(day).padStart(2, '0');
  const sourceUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/src/content/ironman/day-${dayString}.md`;
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Day ${dayString}: HTTP ${response.status}`);
  }

  posts.push({
    slug: `day-${dayString}`,
    day,
    canonicalUrl: `https://gcake119.github.io/ithome-2026/day/${dayString}/`,
    sourceUrl,
    markdown: await response.text(),
  });
}

await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(
  OUTPUT,
  JSON.stringify(
    {
      generated: true,
      generatedAt: new Date().toISOString(),
      source: `${OWNER}/${REPO}`,
      posts,
    },
    null,
    2,
  ) + '\n',
);

console.log(`Synced ${posts.length} iThome posts to ${OUTPUT}`);
