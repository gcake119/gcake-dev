import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
test('retired Git journal CLI cannot write or invoke Git with any legacy command or activation flag',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'gcake-retired-'));
 try {
  await fs.mkdir(join(root,'src/data'),{recursive:true});
  const pending=JSON.stringify({version:1,pending:{slug:'keep',releaseAt:'2026-10-12T07:00:00+08:00'}});
  await fs.writeFile(join(root,'src/data/editorial-queue.json'),pending);
  await fs.writeFile(join(root,'git'),'#!/bin/sh\ntouch "$GIT_PROBE"\nexit 1\n',{mode:0o700});
  for(const flag of ['true','false'])for(const command of ['plan','prepare','confirm']) {
   const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),fileURLToPath(new URL('./editorial-release.ts',import.meta.url)),command,'--write','--allow-reserve'],{
    cwd:root,encoding:'utf8',env:{PATH:root+':'+process.env.PATH,EDITORIAL_RELEASE_ENABLED:flag,EDITORIAL_GIT_TOKEN:'synthetic-never-print',GIT_PROBE:join(root,'called')},
   });
   assert.notEqual(result.status,0);assert.match(result.stderr,/GIT_JOURNAL_RETIRED/);
   assert.doesNotMatch(result.stdout+result.stderr,/synthetic-never-print/);
  }
  assert.equal(await fs.readFile(join(root,'src/data/editorial-queue.json'),'utf8'),pending);
  await assert.rejects(()=>fs.stat(join(root,'called')),/ENOENT/);
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
