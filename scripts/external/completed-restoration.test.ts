import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const snapshot=JSON.parse(await readFile('src/data/external/ithome-2026.generated.json','utf8'));
const pin=JSON.parse(await readFile('src/data/external/ithome-2026.completed-manifest.json','utf8'));

test('the restoration command uses the saved completed snapshot and atomically replaces old 19-post content',async()=> {
  const {restoreCompletedSnapshotFile}=await import('./restore-completed-ithome-2026');
  const dir=await mkdtemp(path.join(tmpdir(),'gcake-completed-'));
  try {
    const output=path.join(dir,'snapshot.json');await writeFile(output,JSON.stringify({...snapshot,publicationState:'active',posts:snapshot.posts.slice(0,19)}));
    const urls:string[]=[];
    await restoreCompletedSnapshotFile({output,manifest:pin,fetchText:async url=>{urls.push(url);return JSON.stringify(snapshot);}});
    const result=JSON.parse(await readFile(output,'utf8'));
    assert.equal(result.posts.length,30);assert.equal(result.publicationState,'completed');assert.equal(result.revision,pin.revision);
    assert.deepEqual(urls,['https://gcake119.github.io/gcake-dev/ithome-snapshot.json']);
    assert.deepEqual(await readdir(dir),['snapshot.json']);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('unavailable, active, incomplete, changed revision and body/hash tampering retain the previous file without source fallback',async()=> {
  const {restoreCompletedSnapshotFile}=await import('./restore-completed-ithome-2026');
  const tampered=structuredClone(snapshot);tampered.posts[0].markdown+='tampered';tampered.posts[0].sha256=createHash('sha256').update(tampered.posts[0].markdown).digest('hex');
  const values=[null,'invalid JSON',{...snapshot,publicationState:'active',posts:snapshot.posts.slice(0,19)},{...snapshot,posts:snapshot.posts.slice(0,29)},{...snapshot,revision:'a'.repeat(40)},tampered,{...snapshot,posts:snapshot.posts.map((p:any,i:number)=>i?p:{...p,markdown:'corrupt'})}];
  const dir=await mkdtemp(path.join(tmpdir(),'gcake-completed-failure-'));
  try {
    const output=path.join(dir,'snapshot.json');const before='previous-known-snapshot';await writeFile(output,before);
    for(const value of values) {
      let requests=0;
      await assert.rejects(restoreCompletedSnapshotFile({output,manifest:pin,fetchText:async url=> {
        requests++;assert.equal(url,'https://gcake119.github.io/gcake-dev/ithome-snapshot.json');
        if(value===null)throw new Error('HTTP 503');return typeof value==='string'?value:JSON.stringify(value);
      }}));
      assert.equal(requests,1);assert.equal(await readFile(output,'utf8'),before);assert.deepEqual(await readdir(dir),['snapshot.json']);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});


test('the actual restoration CLI exits nonzero on bad snapshot before a following build can run',async()=> {
  const dir=await mkdtemp(path.join(tmpdir(),'gcake-completed-cli-'));
  try {
    const output=path.join(dir,'src/data/external/ithome-2026.generated.json');
    await import('node:fs/promises').then(fs=>fs.mkdir(path.dirname(output),{recursive:true}));
    await writeFile(path.join(dir,'src/data/external/ithome-2026.completed-manifest.json'),JSON.stringify(pin));
    await writeFile(output,'previous-local-snapshot');
    const fake=path.join(dir,'fetch.mjs');
    await writeFile(fake, `globalThis.fetch=async url=>{if(url!=='https://gcake119.github.io/gcake-dev/ithome-snapshot.json')throw new Error('source request forbidden');return Response.json(${JSON.stringify({...snapshot,publicationState:'active',posts:snapshot.posts.slice(0,19)})});};`);
    const runner=fileURLToPath(new URL('./restore-completed-ithome-2026.ts',import.meta.url));
    const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),'--import',fake,runner],{cwd:dir,encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,/completed|Invalid input/);
    assert.equal(await readFile(output,'utf8'),'previous-local-snapshot');
  } finally {await rm(dir,{recursive:true,force:true});}
});
