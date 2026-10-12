import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {main} from './run-distribution';
const slug='trial';
async function source(dir:string) {const posts=path.join(dir,'src/content/posts');await fs.mkdir(posts,{recursive:true});await fs.writeFile(path.join(posts,'trial.md'),'---\ntitle: Trial\nstatus: published\npublishedAt: 2026-09-28\n---\nComplete body.\n');}
test('controlled trial dry run binds its execution mode without enabling any write',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-trial-review-'));try {
  await source(dir);
  await main(['dry-run',slug,'substack','--mode','controlled-trial','--out',path.join(dir,'review.json')],undefined,dir);
  const review=JSON.parse(await fs.readFile(path.join(dir,'review.json'),'utf8'));
  assert.equal(review.executionMode,'controlled-trial'); assert.equal(review.approvalTemplate.mode,'controlled-trial');
  assert.equal(review.externalWriteEnabled,false); assert.equal(review.approvalTemplate.approved,false);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('trial write disablement stops before browser or D1 access despite a matching approval',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcake-trial-disabled-'));let browserCalls=0;
 try {
  await source(dir);
  const receipt=path.join(dir,'review.json');
  await main(['dry-run',slug,'substack','--mode','controlled-trial','--out',receipt],undefined,dir);
  const review=JSON.parse(await fs.readFile(receipt,'utf8'));
  const approval=path.join(dir,'approval.json'),config=path.join(dir,'config.json');
  await fs.writeFile(approval,JSON.stringify({...review.approvalTemplate,approved:true,approvedAt:new Date().toISOString()}));
  await fs.writeFile(config,JSON.stringify({substack:{ui:{publicationPolicy:'full-mirror'}},trial:{writeEnabled:false}}));
  await assert.rejects(main(['prepare',slug,'substack','--mode','controlled-trial','--config',config,'--receipt',receipt,'--approval',approval],(async()=>{browserCalls++;throw Error('unexpected');}) as never,dir),/DISTRIBUTION_WRITE_DISABLED/);
  assert.equal(browserCalls,0);
 }finally {await fs.rm(dir,{recursive:true,force:true});}
});
