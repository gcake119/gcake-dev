import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { restoreCompletedSnapshot } from './ithome-sync';

const savedSnapshot = 'https://gcake119.github.io/gcake-dev/ithome-snapshot.json';
export async function restoreCompletedSnapshotFile(options: {
  output: string;
  manifest: unknown;
  fetchText: (url: string) => Promise<string>;
}) {
  const snapshot = await restoreCompletedSnapshot(JSON.parse(await options.fetchText(savedSnapshot)), options.manifest);
  await fs.mkdir(path.dirname(options.output), {recursive:true});
  const temporary = `${options.output}.tmp-${randomUUID()}`;
  try {
    await fs.writeFile(temporary, JSON.stringify(snapshot,null,2)+'\n', {flag:'wx'});
    await fs.rename(temporary,options.output);
  } finally {
    await fs.rm(temporary,{force:true});
  }
  return snapshot;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const snapshot = await restoreCompletedSnapshotFile({
    output:path.resolve('src/data/external/ithome-2026.generated.json'),
    manifest:JSON.parse(await fs.readFile('src/data/external/ithome-2026.completed-manifest.json','utf8')),
    fetchText:async url=> {
      const response=await fetch(url,{signal:AbortSignal.timeout(30_000),cache:'no-store',redirect:'error'});
      if(!response.ok)throw new Error(`Saved snapshot HTTP ${response.status}`);
      return response.text();
    },
  });
  console.log(`Restored ${snapshot.posts.length} completed articles at ${snapshot.revision}`);
}
