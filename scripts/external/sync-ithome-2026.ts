import fs from 'node:fs/promises';
import path from 'node:path';
import { resumeOrSync } from './ithome-sync';

const output = path.resolve('src/data/external/ithome-2026.generated.json');
async function fetchText(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
}
const previous = JSON.parse(await fetchText('https://gcake119.github.io/gcake-dev/ithome-snapshot.json'));
const snapshot = await resumeOrSync(previous, fetchText);
await fs.mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
try {
  await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
  await fs.rename(temporary, output);
} finally {
  await fs.rm(temporary, { force: true });
}
console.log(`Prepared ${snapshot.posts.length} public posts from ${snapshot.revision}`);
