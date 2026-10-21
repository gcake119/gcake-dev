import test from 'node:test';
import assert from 'node:assert/strict';
import { embedCloudBatch } from '../../scripts/discovery/cloud-embedding';
test('Free indexing budget rejects overlong or unreserved work before any provider call',async()=>{
 let calls=0,reserved=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({success:true,result:{data:[Array(1024).fill(1)]}});};
 await assert.rejects(()=>embedCloudBatch(['x'.repeat(4097)],'fixture',async()=>{reserved++;return true;},fetcher));
 await assert.rejects(()=>embedCloudBatch(['public article'],'fixture',async()=>false,fetcher));assert.equal(calls,0);assert.equal(reserved,0);
});
test('Uncertain provider failure keeps reservation and is not retried; valid BGE output is normalized',async()=>{
 let reservations=0,calls=0;const reserve=async(tokens:number,units:number)=>{assert.ok(tokens>0&&units>0);reservations++;return true;};
 await assert.rejects(()=>embedCloudBatch(['public article'],'fixture',reserve,async()=>{calls++;throw Error('unknown');}));assert.equal(calls,1);assert.equal(reservations,1);
 const vectors=await embedCloudBatch(['public article'],'fixture',reserve,async(input,options)=>{assert.equal(String(input),'https://api.cloudflare.com/client/v4/accounts/979a3735f8dfa269e7474135f348cfdf/ai/run/@cf/baai/bge-m3');assert.deepEqual(JSON.parse(String(options?.body)),{text:['public article']});return Response.json({success:true,result:{data:[Array(1024).fill(1)]}});});assert.equal(vectors[0].length,1024);assert.ok(Math.abs(Math.hypot(...vectors[0])-1)<1e-8);
});
