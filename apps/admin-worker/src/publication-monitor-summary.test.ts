import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest } from './index.js';
const at='2026-10-15T08:00:00+08:00';
const snapshot=()=>({revision:'revision-a',posts:['new','member','alone'].map(slug=>({slug,title:slug,status:'ready',path:`src/content/posts/${slug}.md`,sha:'blob',source:'PRIVATE_BODY'})),series:[{slug:'new-series',sections:[{posts:[{slug:'new',status:'ready'}]}]},{slug:'existing-series',sections:[{posts:[{slug:'member',status:'ready'}]}]}]});
const runtime=()=>({posts:{},seriesReadyAt:{},seriesOrder:{},paused:[],overrides:{},adopted:[],releases:[{id:'commit-1',slug:'new',slot:'2026-10-15T07:00:00+08:00',state:'committed-slot',sourceRevision:'r',lease:'PRIVATE_LEASE',leaseUntil:at,attempts:3,events:[]}]});
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE release_queue_runtime(id INTEGER PRIMARY KEY, version INTEGER, document TEXT)');
 const data=runtime();db.prepare('INSERT INTO release_queue_runtime VALUES(1,1,?)').run(JSON.stringify(data));let mutation=0;
 const storage={prepare(sql:string){if(!sql.startsWith('SELECT ')){mutation++;throw new Error('mutation forbidden');}return {first:async()=>db.prepare(sql).get(),bind(){throw new Error('bind forbidden')},run(){throw new Error('run forbidden')}}}};
 let rev='revision-a';let fail=false;const catalogue={snapshot:async()=>{if(fail)throw new Error('incomplete source');return snapshot()},revision:async()=>rev};
 const call=(secret='test-reader',method='GET',requestId?:string)=>(handleRequest as Function)(new Request('https://cms.test/api/v1/monitoring/publications',{method,headers:{authorization:'Bearer '+secret,...(requestId===undefined?{}:{'X-Gcake-Observation-Id':requestId})}}),{CMS_DB:storage,MONITOR_READ_SECRET:'test-reader'},async()=>{throw new Error('network forbidden')},catalogue);
 return {db,data,call,catalogue,setRevision(v:string){rev=v},setFailure(){fail=true},save(){db.prepare('UPDATE release_queue_runtime SET document=?,version=version+1').run(JSON.stringify(data))},mutation:()=>mutation};
}
test('authenticated current request identity is echoed without writes and invalid identity is refused',async()=>{
 const f=fixture();try{const response=await f.call('test-reader','GET','a'.repeat(32));assert.equal(response.status,200);assert.equal((await response.json()).requestId,'a'.repeat(32));assert.equal((await f.call('test-reader','GET','bad')).status,400);assert.equal(f.mutation(),0);}finally{f.db.close()}
});
test('complete observation discovers new series, member and standalone with only formal commitments',async()=>{
 const f=fixture();try{const r=await f.call();assert.equal(r.status,200);const body=await r.json();assert.equal(body.complete,true);assert.equal(body.articles.length,3);assert.equal(body.articles[0].kind,'series');assert.equal(body.articles[2].kind,'standalone');assert.equal(body.articles[0].commitment.scheduledAt,'2026-10-15T07:00:00+08:00');assert.equal(body.articles[1].scheduleState,'unscheduled');}finally{f.db.close()}
});
test('read-only entrypoint repeated reads are current, bounded and minimally disclosed',async()=>{
 const f=fixture();try{const before=f.db.prepare('SELECT * FROM release_queue_runtime').get();for(let i=0;i<3;i++){const r=await f.call();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.text();assert(!body.includes('PRIVATE'));assert(!body.includes('attempts'));assert.equal(JSON.parse(body).queueVersion,1);}assert.deepEqual(f.db.prepare('SELECT * FROM release_queue_runtime').get(),before);assert.equal(f.mutation(),0);}finally{f.db.close()}
});
test('summary rejects missing/invalid dedicated credential and non-GET without observations',async()=>{
 const f=fixture();try{for(const secret of ['', 'wrong'])assert.equal((await f.call(secret)).status,403);assert.equal((await f.call('test-reader','POST')).status,405);assert.equal(f.mutation(),0);}finally{f.db.close()}
});
test('estimate, pause and reschedule replace old authority; unlocked record is unknown, never inferred cancelled',async()=>{
 const f=fixture();try{(f.data.overrides as any).alone=at;f.save();let b=await (await f.call()).json();assert.equal(b.articles[2].scheduleState,'estimate-only');assert.equal(b.articles[2].commitment,undefined);
 (f.data.paused as string[]).push('post:new');f.save();b=await(await f.call()).json();assert.equal(b.articles[0].scheduleState,'paused');assert.equal(b.articles[0].commitment,undefined);
 f.data.paused=[];f.data.releases[0].slot='2026-10-19T07:00:00+08:00';f.save();b=await(await f.call()).json();assert.equal(b.articles[0].commitment.scheduledAt,f.data.releases[0].slot);
 (f.data.releases[0] as any).unlockedAt=at;f.save();b=await(await f.call()).json();assert.equal(b.articles[0].scheduleState,'unknown');}finally{f.db.close()}
});
test('unavailable catalogue, malformed authority, duplicate identities and revision/version race fail closed',async()=>{
 for(const mode of ['failure','revision','queue-race','malformed','duplicate']){const f=fixture();try{
 if(mode==='failure')f.setFailure();if(mode==='revision')f.setRevision('revision-b');if(mode==='queue-race'){const original=f.catalogue.revision;f.catalogue.revision=async()=>{f.save();return original()}}if(mode==='malformed')f.db.prepare('UPDATE release_queue_runtime SET document=?').run('{}');if(mode==='duplicate'){f.catalogue.snapshot=async()=>{const s=snapshot();s.posts.push(s.posts[0]);return s}}assert.equal((await f.call()).status,503);assert.equal(f.mutation(),0);
 }finally{f.db.close()}}
});
