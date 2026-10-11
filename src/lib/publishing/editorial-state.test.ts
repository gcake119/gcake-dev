import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestQueue, reserveRelease, emptyQueue, confirmRelease, type QueuePost } from './editorial-state';
const now='2026-10-11T20:00:00+08:00';
const posts = (slugs=['a','b']): QueuePost[] => slugs.map(slug=>({slug,status:'ready',revision:slug}));
const manifest = (slugs=['a','b']) => [{slug:'s',posts:slugs.map(slug=>({slug,status:'ready'}))}];
test('full manifest holds missing/planned/draft/inconsistent series',()=>{
 for(const refs of [[{slug:'a',status:'ready'},{slug:'b',status:'planned'}],[{slug:'a',status:'ready'},{slug:'b',status:'ready'}],[{slug:'a',status:'published'}]]) {
 const state=ingestQueue(emptyQueue(),posts(['a']),[{slug:'s',posts:refs}],now);
 assert.equal(reserveRelease(state,posts(['a']),[{slug:'s',posts:refs}],'2026-10-12T07:37:00+08:00').pending,undefined);
 }
});
test('idempotent ingestion keeps FIFO across edits and resets incomplete membership',()=>{
 const s=ingestQueue(emptyQueue(),posts(),manifest(),now);
 const edited=ingestQueue(s,posts().map(p=>({...p,revision:'new'})),manifest(),'2026-10-12T06:00:00+08:00');
 assert.deepEqual(s,edited);
 const incomplete=ingestQueue(s,posts(['a']),manifest(),'2026-10-12T06:00:00+08:00');
 const restored=ingestQueue(incomplete,posts(),manifest(),'2026-10-13T06:00:00+08:00');
 assert.equal(restored.groups['series:s'].readyAt,'2026-10-13T06:00:00+08:00');
});
test('standalone interrupts, FIFO and active series resume survive journal round trip',()=>{
 let ps=posts();let ms=manifest();
 let s=reserveRelease(ingestQueue(emptyQueue(),ps,ms,now),ps,ms,'2026-10-12T07:37:00+08:00');
 assert.equal(s.pending?.slug,'a');
 s=confirmRelease(s,'a','2026-10-12T07:40:00+08:00');
 ps=[{...ps[0],status:'published' as any,publishedAt:'2026-10-12T07:00:00+08:00'},ps[1],...posts(['x','y','z'])];
 ms=[{slug:'s',posts:[{slug:'a',status:'published'},{slug:'b',status:'ready'}]}, {slug:'waiting',posts:[{slug:'z',status:'ready'}]}];
 s=ingestQueue(s,ps.filter(p=>p.slug!=='y'),ms,'2026-10-13T10:00:00+08:00');
 s=ingestQueue(s,ps,ms,'2026-10-14T10:00:00+08:00');
 for(const [slug,date] of [['x','2026-10-15'],['y','2026-10-19'],['b','2026-10-22'],['z','2026-10-26']]) {
 s=reserveRelease(JSON.parse(JSON.stringify(s)),ps,ms,date+'T07:37:00+08:00');assert.equal(s.pending?.slug,slug);
 s=confirmRelease(s,slug,date+'T07:40:00+08:00');
 ps=ps.map(p=>p.slug===slug?{...p,status:'published' as any,publishedAt:date+'T07:00:00+08:00'}:p);
 ms=ms.map(m=>({...m,posts:m.posts.map(p=>p.slug===slug?{...p,status:'published'}:p)}));
 }
});
test('pending retries block new articles and missing pending stops safely',()=>{
 const s=reserveRelease(ingestQueue(emptyQueue(),posts(['a']),[],now),posts(['a']),[],'2026-10-12T07:37:00+08:00');
 assert.deepEqual(reserveRelease(s,posts(['a','late']),[],'2026-10-15T07:37:00+08:00'),s);
 assert.throws(()=>reserveRelease(s,[],[],'2026-10-15T07:37:00+08:00'),/pending/i);
});
test('late standalone and missed windows never backfill old slots',()=>{
 const s=ingestQueue(emptyQueue(),posts(['x']),[],'2026-10-12T08:00:00+08:00');
 assert.equal(reserveRelease(s,posts(['x']),[],'2026-10-12T09:00:00+08:00').pending,undefined);
 assert.equal(reserveRelease(s,posts(['x']),[],'2026-10-22T08:00:00+08:00').pending?.releaseAt,'2026-10-22T07:00:00+08:00');
});
test('manual publication consumes current slot and no premature confirmation',()=>{
 const ps=[...posts(['x']),{slug:'manual',status:'published',revision:'m',publishedAt:'2026-10-12T07:15:00+08:00'}];
 const s=ingestQueue(emptyQueue(),ps,[],now);
 assert.equal(reserveRelease(s,ps,[],'2026-10-12T08:00:00+08:00').pending,undefined);
 assert.throws(()=>confirmRelease(s,'x','2026-10-12T08:00:00+08:00'),/pending/i);
});
test('deleted active series requires explicit operator repair',()=>{
 const ps=posts(['a']);const ms=manifest(['a']);
 const s={...ingestQueue(emptyQueue(),ps,ms,now),activeSeries:'deleted'};
 assert.throws(()=>reserveRelease(s,ps,ms,'2026-10-12T08:00:00+08:00'),/active series.*repair/i);
});
test('initial activation never backfills a slot before the queue started',()=>{
 const ps=posts(['a']).map(p=>({...p,eligibleSince:'2026-10-01T08:00:00+08:00'}));
 const s=ingestQueue(emptyQueue(),ps,[],'2026-10-11T20:00:00+08:00');
 assert.equal(reserveRelease(s,ps,[],'2026-10-11T20:01:00+08:00').pending,undefined);
 assert.equal(reserveRelease(s,ps,[],'2026-10-12T07:00:00+08:00').pending?.slug,'a');
});
test('a manually scheduled future chapter cannot be treated as already public',()=>{
 const ps=[{slug:'a',status:'published',revision:'a',publishedAt:'2026-10-19T07:00:00+08:00'},...posts(['b'])];
 const ms=[{slug:'s',posts:[{slug:'a',status:'published'},{slug:'b',status:'ready'}]}];
 const s=ingestQueue(emptyQueue(),ps,ms,now);
 assert.equal(reserveRelease(s,ps,ms,'2026-10-12T07:37:00+08:00').pending,undefined);
});
test('active series with future manual publications stays ahead of waiting series',()=>{
 const ps=[{slug:'a',status:'published',revision:'a',publishedAt:'2026-10-19T07:00:00+08:00'},...posts(['b'])];
 const ms=[{slug:'s',posts:[{slug:'a',status:'published'}]},{slug:'waiting',posts:[{slug:'b',status:'ready'}]}];
 const s=ingestQueue({...emptyQueue(),activeSeries:'s'},ps,ms,now);
 assert.equal(reserveRelease(s,ps,ms,'2026-10-12T07:37:00+08:00').pending,undefined);
});
