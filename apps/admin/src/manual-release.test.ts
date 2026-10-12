import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewManualPublication } from './manual-release';
const post={slug:'first',status:'ready',saved:true,dirty:false,revision:'main-sha'};
test('manual owner UI previews before confirmation and never publishes dirty or denied content',async()=>{
  const calls:{path:string;body:any}[]=[];
  const request=async(path:string,body:any)=>{calls.push({path,body});return {slug:'first',title:'第一篇',version:3,revision:'main-sha'}};
  await assert.rejects(()=>reviewManualPublication({...post,dirty:true},request,async()=>true));assert.equal(calls.length,0);
  assert.equal(await reviewManualPublication(post,request,async()=>false),undefined);assert.equal(calls.length,1);
});
test('manual owner UI posts only the reviewed intent once and preserves unknown outcome without replay',async()=>{
  for(const unknown of [false,true]){
    const calls:{path:string;body:any}[]=[];
    const request=async(path:string,body:any)=>{calls.push({path,body});if(calls.length===1)return {slug:'first',title:'第一篇',version:3,revision:'main-sha'};if(unknown)throw new Error('結果未知');return {id:'one-id',slug:'first',mode:'manual',state:'awaiting-verification'}};
    const work=reviewManualPublication(post,request,async()=>true);
    if(unknown)await assert.rejects(()=>work,/結果未知/);else assert.equal((await work)?.id,'one-id');
    assert.equal(calls.length,2);assert.deepEqual(calls[1],{path:'/api/v1/releases/publish-now',body:{slug:'first',version:3,revision:'main-sha',confirmed:true}});
  }
});

test('manual owner UI refuses a main revision newer than the content actually reviewed',async()=>{
  let requests=0,confirmations=0;
  await assert.rejects(()=>reviewManualPublication({...post,revision:'reviewed-old'} as any,async()=>{requests++;return {slug:'first',title:'Changed',version:3,revision:'newer-main'}},async()=>{confirmations++;return true}),/內容已更新/);
  assert.equal(requests,1);assert.equal(confirmations,0);
});
