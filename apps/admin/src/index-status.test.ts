import test from 'node:test';
import assert from 'node:assert/strict';
import {progressPresentation} from './index-status';
test('graphical passage progress is exact, honest at boundaries, and not search acceptance',()=>{assert.deepEqual(progressPresentation(304,2995,true),{kind:'known',completed:304,total:2995,percent:10.1});assert.equal((progressPresentation(2994,2995,true) as any).percent,99.9);assert.equal((progressPresentation(2995,2995,true) as any).percent,100);assert.equal(progressPresentation(0,0,true).kind,'empty');for(const [x,y,aligned] of [[1,null,true],[1,10,false],[-1,10,true],[11,10,true],[NaN,10,true]] as const)assert.equal(progressPresentation(x,y,aligned).kind,'unknown');});

import {createIndexStatusReader} from './index-status';
import {snapshot} from '../../../test/discovery/index-status-fixture';
const tick=()=>new Promise<void>(r=>setImmediate(r));
const admin=()=>({schemaVersion:1,snapshot:snapshot(),source:{corpusId:'a'.repeat(64),total:2995,sourceIdentity:'fixture'},searchAcceptance:'unverified'});
test('reader preserves last-known time after failure, throttles refresh, and clears on 401',async()=>{
 let now=100000,calls=0,fail=0;const timers:{fn:()=>void;ms:number}[]=[];
 const r=createIndexStatusReader(()=>{},{now:()=>now,setTimer:(fn,ms)=>{timers.push({fn,ms});return 1;},clearTimer:()=>{},fetcher:async()=>{calls++;return fail?new Response(null,{status:fail}):Response.json(admin());}});
 r.activate(true);await tick();assert.equal(r.state.lastReadAt,now);assert.equal(timers.at(-1)?.ms,300000);await r.load();assert.equal(calls,1);
 now+=10001;fail=503;await r.load();assert.equal(r.state.lastReadAt,100000);assert.ok(r.state.data);assert.match(r.state.error!,/上次/);
 now+=10001;fail=401;await r.load();assert.equal(r.state.data,null);assert.equal(r.state.loginRequired,true);r.dispose();
});
test('hidden and disposed readers cancel stale replies and perform no background reads',async()=>{
 let complete!:(r:Response)=>void,signal:AbortSignal|undefined,calls=0;
 const r=createIndexStatusReader(()=>{},{setTimer:()=>1,clearTimer:()=>{},fetcher:async(_u,init)=>{calls++;signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{complete=resolve;});}});
 r.activate(true);r.activate(false);assert.equal(signal?.aborted,true);complete(Response.json(admin()));await tick();assert.equal(r.state.data,null);await r.load();assert.equal(calls,1);r.dispose();r.activate(true);assert.equal(calls,1);
});
test('visibility cycles preserve the automatic deadline instead of bypassing polling bounds',async()=>{let now=100000,calls=0;const timers:number[]=[];const r=createIndexStatusReader(()=>{},{now:()=>now,setTimer:(_fn,ms)=>{timers.push(ms);return 1;},clearTimer:()=>{},fetcher:async()=>{calls++;return Response.json(admin());}});r.activate(true);await tick();for(let i=0;i<4;i++){r.activate(false);r.activate(true);await tick();}assert.equal(calls,1);assert.equal(timers.at(-1),300000);now+=100000;r.activate(false);r.activate(true);await tick();assert.equal(calls,1);assert.equal(timers.at(-1),200000);now+=200001;r.activate(false);r.activate(true);await tick();assert.equal(calls,2);r.dispose();});
