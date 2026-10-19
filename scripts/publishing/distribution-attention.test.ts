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
  await publishAttentionSnapshot(file,{status:'completed',results:[]},[]);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[]);
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

test('omitted source does not clear a durable hold and clear requires a complete durable read',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'substack-attention-'));const file=path.join(root,'status.json');
 const held={slug:'deleted-source',code:'DISTRIBUTION_MANUAL_REQUIRED'};
 try{
  await publishAttentionSnapshot(file,{status:'attention',results:[{...held,target:'substack',operation:'plan',status:'blocked'}]});
  await publishAttentionSnapshot(file,{status:'completed',results:[]});
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[held]);
  await publishAttentionSnapshot(file,{status:'completed',results:[]},[{slug:held.slug}]);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[held]);
  await publishAttentionSnapshot(file,{status:'completed',results:[]},[]);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('series preparation and content holds preserve specific reasons through the Hermes consumer and restart',async()=>{
 const {execFileSync}=await import('node:child_process');const root=await fs.mkdtemp(path.join(os.tmpdir(),'attention-reasons-'));const file=path.join(root,'status.json');
 try{
  const results=[{slug:'new-series-draft',target:'substack',operation:'prepare-draft',status:'manual_required',code:'SUBSTACK_DRAFT_PREPARATION_REQUIRED'},{slug:'existing-public',target:'substack',operation:'sync-content',status:'manual_required',code:'SUBSTACK_CONTENT_SYNC_REQUIRED'}];
  await publishAttentionSnapshot(file,{status:'attention',results},[{slug:'existing-public'}]);
  const issues=JSON.parse(await fs.readFile(file,'utf8')).issues;
  assert.deepEqual(issues,[{slug:'existing-public',code:'SUBSTACK_CONTENT_SYNC_REQUIRED'},{slug:'new-series-draft',code:'SUBSTACK_DRAFT_PREPARATION_REQUIRED'}]);
  const consume=()=>JSON.parse(execFileSync('python3',['-B','-c',`import json,os,sys
from pathlib import Path
sys.path.insert(0,sys.argv[2])
import substack_attention as p
sent=[]
r=Path(sys.argv[1]);result=p.consume(r/'status.json',r/'events.sqlite',r/'receipt.json',os.getuid(),lambda message:(sent.append(message) or {'success':True,'message_id':123}))
print(json.dumps({'result':result,'sent':sent}))`,root,path.resolve('scripts/hermes')],{encoding:'utf8'}));
  const first=consume();assert.equal(first.result.status,'sent');assert.match(first.sent[0],/待備稿/);assert.match(first.sent[0],/內容.*同步/);assert.doesNotMatch(first.sent[0],/身分|已暫停自動重試|發文失敗/);
  await publishAttentionSnapshot(file,{status:'attention',results},[{slug:'existing-public'}]);assert.equal(consume().result.status,'quiet');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('specific durable schedule reasons survive omitted inventory and unknown reasons cannot replace the feed',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'attention-durable-reasons-'));const file=path.join(root,'status.json');
 try{
  await publishAttentionSnapshot(file,{status:'completed',results:[]},[{slug:'cancelled-source',code:'SUBSTACK_SCHEDULE_CANCEL_REQUIRED'},{slug:'postponed-source',code:'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED'},{slug:'unknown-arm',code:'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'}]);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues.map((r:{code:string})=>r.code),['SUBSTACK_SCHEDULE_CANCEL_REQUIRED','SUBSTACK_SCHEDULE_POSTPONE_REQUIRED','SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED']);
  const before=await fs.readFile(file,'utf8');await assert.rejects(publishAttentionSnapshot(file,{status:'completed',results:[]},[{slug:'secret',code:'PRIVATE_ERROR_TEXT'}]),/INVALID/);assert.equal(await fs.readFile(file,'utf8'),before);
  await publishAttentionSnapshot(file,{status:'attention',results:[{slug:'unknown-arm',target:'substack',operation:'sync-content',status:'manual_required',code:'SUBSTACK_CONTENT_SYNC_REQUIRED'}]},[{slug:'unknown-arm',code:'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'}]);
  assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')).issues,[{slug:'unknown-arm',code:'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED'}]);

 }finally{await fs.rm(root,{recursive:true,force:true});}
});
