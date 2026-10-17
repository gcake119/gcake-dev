import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishAttentionSnapshot} from './distribution-attention';
test('attention snapshot exposes existing holds despite quiet markers and retains issues on source failure',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'substack-attention-'));const file=path.join(root,'status.json');
 try{
  const held={status:'attention',notification:'quiet',results:[{slug:'demo',target:'substack',operation:'plan',status:'blocked',code:'DISTRIBUTION_MANUAL_REQUIRED'}]};
  assert.equal((await publishAttentionSnapshot(file,held)).status,'queued');
  const snapshot=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(snapshot.issues[0].slug,'demo');assert.equal(snapshot.issues.length,1);
  const before=await fs.readFile(file,'utf8');assert.equal((await publishAttentionSnapshot(file,{status:'attention',results:[{slug:'',target:'all',operation:'round',status:'blocked',code:'DISTRIBUTION_PROVIDER_FAILED'}]})).status,'retained');
  assert.equal(await fs.readFile(file,'utf8'),before);
  await publishAttentionSnapshot(file,{status:'completed',results:[]});assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('notification payload rejects nonpublic slug input and contains only bounded Substack issue fields',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'substack-attention-'));try{
  await assert.rejects(publishAttentionSnapshot(path.join(root,'status.json'),{status:'attention',results:[{slug:'../private',target:'substack',operation:'plan',status:'blocked',code:'DISTRIBUTION_MANUAL_REQUIRED'}]}),/INVALID/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('a newly failed verification becomes the same manual issue as its following held plan',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'substack-attention-'));const file=path.join(root,'status.json');try{
  await publishAttentionSnapshot(file,{status:'attention',results:[{slug:'demo',target:'substack',operation:'verify',status:'manual_required',code:'SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS'}]});
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[{slug:'demo',code:'DISTRIBUTION_MANUAL_REQUIRED'}]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
