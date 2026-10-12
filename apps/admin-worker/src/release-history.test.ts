import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubAppReadClient } from './github';
test('first readiness uses pinned Git commit history, not the latest edit or ingestion clock', async () => {
  const seen: string[] = [];
  const client = new GitHubAppReadClient({
    installationTokens: { create: async () => 'test' },
    fetch: async (input) => {
      const url = new URL(String(input));
      seen.push(url.pathname + url.search);
      if (url.pathname.includes('/commits/')) {
        const chain=['pinned-head','ready','draft']; const sha=url.pathname.split('/').pop()!;const i=chain.indexOf(sha);
        return Response.json({sha,parents:i<2?[{sha:chain[i+1]}]:[],commit:{committer:{date:['2026-10-11T01:00:00Z','2026-10-10T01:00:00Z','2026-10-09T01:00:00Z'][i]}}});
      }
      if (url.pathname.endsWith('/commits'))
        return Response.json([
          { sha: 'edited', commit: { committer: { date: '2026-10-11T01:00:00Z' } } },
          { sha: 'ready', commit: { committer: { date: '2026-10-10T01:00:00Z' } } },
          { sha: 'draft', commit: { committer: { date: '2026-10-09T01:00:00Z' } } },
        ]);
      const status = url.searchParams.get('ref') === 'draft' ? 'draft' : 'ready';
      return Response.json({
        encoding: 'base64',
        content: Buffer.from(`---\ntitle: Post\nstatus: ${status}\n---\nBody`).toString('base64'),
      });
    },
  });
  assert.equal(await client.firstReadyAt('src/content/posts/p.md', 'pinned-head'), '2026-10-10T01:00:00Z');
  assert.match(seen[0], /commits\/pinned-head/);
  assert.equal(
    seen.some((u) => u.includes('ref=pinned-head')),
    true,
  );
});

test('readiness history chooses latest continuous period, retaining edits but excluding earlier draft cycles',async()=>{
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
    const url=new URL(String(input));
    const rows=[['edited','2026-10-11T01:00:00Z'],['renewed','2026-10-10T01:00:00Z'],['draft','2026-10-09T01:00:00Z'],['old','2026-10-01T01:00:00Z']];
    if(url.pathname.includes('/commits/')) {const sha=url.pathname.split('/').pop()!;const i=sha==='pinned-head'?0:rows.findIndex(r=>r[0]===sha);return Response.json({sha,parents:i<rows.length-1?[{sha:rows[i+1][0]}]:[],commit:{committer:{date:rows[i][1]}}});}
    if(url.pathname.endsWith('/commits'))return Response.json(rows.map(([sha,date])=>({sha,commit:{committer:{date}}})));
    return Response.json({encoding:'base64',content:Buffer.from(`---\ntitle: Post\nstatus: ${url.searchParams.get('ref')==='draft'?'draft':'ready'}\n---\nBody`).toString('base64')});
  }});
  assert.equal(await client.firstReadyAt('src/content/posts/p.md','pinned-head'),'2026-10-10T01:00:00Z');
});

test('whole-series history retains only current complete ordered membership after pause or membership change',async()=>{
  for(const interruption of ['paused','membership']){
    const seen:string[]=[];
    const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
      const url=new URL(String(input));seen.push(url.pathname+url.search);
      if(url.pathname.includes('/commits/')) {const sha=url.pathname.split('/').pop()!;const chain=['pinned','complete','break','old'];const i=chain.indexOf(sha);return Response.json({sha,parents:i<3?[{sha:chain[i+1]}]:[],commit:{committer:{date:['2026-10-11T01:00:00Z','2026-10-10T01:00:00Z','2026-10-09T01:00:00Z','2026-10-01T01:00:00Z'][i]}}});}
      if(url.pathname.endsWith('/commits'))return Response.json([
        {sha:'edit',commit:{committer:{date:'2026-10-11T01:00:00Z'}}},
        {sha:'complete',commit:{committer:{date:'2026-10-10T01:00:00Z'}}},
        {sha:'break',commit:{committer:{date:'2026-10-09T01:00:00Z'}}},
        {sha:'old',commit:{committer:{date:'2026-10-01T01:00:00Z'}}},
      ]);
      const broken=url.searchParams.get('ref')==='break';
      const source=`slug: s\npublication: {status: ${broken&&interruption==='paused'?'paused':'active'}}\nsections:\n  - posts:\n      - {slug: a, status: ready}\n      - {slug: ${broken&&interruption==='membership'?'old-b':'b'}, status: ready}\n`;
      return Response.json({encoding:'base64',content:Buffer.from(source).toString('base64')});
    }});
    assert.equal(await (client as any).firstSeriesReadyAt('src/content/series/s.yaml','pinned',['a','b']),'2026-10-10T01:00:00Z');
    assert.equal(seen.some(x=>x.includes('ref=old')),false);
  }
});

test('legacy Git journal evidence blocks D1 snapshot before content ingestion instead of replaying or deleting it',async()=>{
  const methods:string[]=[];
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async(input,init)=>{
    methods.push(init?.method??'GET');const url=new URL(String(input));
    if(url.pathname.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
    if(url.pathname.endsWith('/branches/main'))return Response.json({commit:{sha:'pinned',commit:{tree:{sha:'tree'}}}});
    return Response.json({tree:[{path:'src/data/editorial-queue.json',sha:'journal',type:'blob'}]});
  }});
  await assert.rejects(()=>client.releaseSnapshot(),/LEGACY_JOURNAL_RECONCILIATION_REQUIRED/);
  assert.deepEqual(methods,['GET','GET','GET']);
});

test('D1 readiness uses first-parent main visibility, not the earlier feature-branch ready commit',async()=>{
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith('/commits'))return Response.json([
      {sha:'merge',commit:{committer:{date:'2026-10-11T01:00:00Z'}}},
      {sha:'feature-ready',commit:{committer:{date:'2026-10-01T01:00:00Z'}}},
      {sha:'base-draft',commit:{committer:{date:'2026-09-30T01:00:00Z'}}},
    ]);
    if(url.pathname.includes('/commits/'))return Response.json(url.pathname.endsWith('/merge')?
      {sha:'merge',parents:[{sha:'base-draft'},{sha:'feature-ready'}],commit:{committer:{date:'2026-10-11T01:00:00Z'}}}:
      {sha:'base-draft',parents:[],commit:{committer:{date:'2026-09-30T01:00:00Z'}}});
    return Response.json({encoding:'base64',content:Buffer.from(`---\ntitle: Post\nstatus: ${url.searchParams.get('ref')==='base-draft'?'draft':'ready'}\n---\nBody`).toString('base64')});
  }});
  assert.equal(await client.firstReadyAt('src/content/posts/p.md','merge'),'2026-10-11T01:00:00Z');
});

test('first-parent history handles a newly created file but rejects incomplete or cyclic ancestry',async()=>{
 for(const mode of ['created','unavailable','cycle']) {
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
   const url=new URL(String(input));
   if(url.pathname.includes('/commits/')) {
    const sha=url.pathname.split('/').pop()!;
    return Response.json({sha,parents:[{sha:mode==='cycle'?'head':'parent'}],commit:{committer:{date:'2026-10-10T01:00:00Z'}}});
   }
   if(url.searchParams.get('ref')==='parent')return new Response('',{status:mode==='created'?404:503});
   return Response.json({encoding:'base64',content:Buffer.from('---\ntitle: Post\nstatus: ready\n---\nBody').toString('base64')});
  }});
  if(mode==='created')assert.equal(await client.firstReadyAt('src/content/posts/new.md','head'),'2026-10-10T01:00:00Z');
  else await assert.rejects(()=>client.firstReadyAt('src/content/posts/new.md','head'),mode==='cycle'?/INVALID_READY_HISTORY/:/HTTP 503/);
 }
});

test('whole release snapshot resolves long first-parent readiness inside a free Worker request budget',async()=>{
  let requests=0;
  const paths=['src/content/posts/a.md','src/content/posts/b.md','src/content/series/s.yaml'];
  const source=(i:number,p:number)=>p===2?`slug: s\nsections:\n  - posts:\n      - slug: a\n        status: ready\n      - slug: b\n        status: ready\n`:`---\ntitle: Post\nstatus: ${i<59?'ready':'draft'}\n---\nBody`;
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async(input,init)=>{
    assert.ok(++requests<=50,'Too many subrequests');const u=new URL(String(input));
    if(u.pathname==='/graphql') {
      const body=JSON.parse(String(init?.body));const start=Number(body.variables.oid.slice(1));
      const node=(i:number,left:number):any=>left===0?{oid:`c${i}`}:{oid:`c${i}`,committedDate:new Date(Date.UTC(2026,8,1,i)).toISOString(),
        ...Object.fromEntries(paths.map((_p,j)=>[`f${j}`,{object:{__typename:'Blob',text:source(i,j)}}])),
        parents:{nodes:i<59?[node(i+1,left-1)]:[]}};
      return Response.json({data:{repository:{object:node(start,10)}}});
    }
    if(u.pathname.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
    if(u.pathname.endsWith('/branches/main'))return Response.json({commit:{sha:'c0',commit:{tree:{sha:'tree'}}}});
    if(u.pathname.includes('/git/trees/'))return Response.json({tree:paths.map((path,i)=>({path,sha:`blob${i}`,type:'blob'}))});
    if(u.pathname.includes('/git/blobs/'))return Response.json({encoding:'base64',content:Buffer.from(source(0,Number(u.pathname.slice(-1)))).toString('base64')});
    if(u.pathname.includes('/commits/')) {const i=Number(u.pathname.split('/').pop()!.slice(1));return Response.json({sha:`c${i}`,parents:i<59?[{sha:`c${i+1}`}]:[],commit:{committer:{date:new Date(Date.UTC(2026,8,1,i)).toISOString()}}});}
    return Response.json({encoding:'base64',content:Buffer.from(source(Number(u.searchParams.get('ref')!.slice(1)),0)).toString('base64')});
  }});
  const s=await client.releaseSnapshot();
  assert.equal(await s.firstReadyAt!(s.posts[0]),new Date(Date.UTC(2026,8,1,58)).toISOString());
  assert.equal(await s.firstReadyAt!(s.posts[1]),new Date(Date.UTC(2026,8,1,58)).toISOString());
  assert.equal(await s.firstSeriesReadyAt!(s.series[0]),new Date(Date.UTC(2026,8,1,59)).toISOString());
  assert.equal(requests,12);
});

test('batch histories fail closed on GraphQL errors, partial blobs, cycles and oversized replies',async()=>{
  for(const failure of ['errors','partial','cycle','oversized']) {
    const path='src/content/posts/a.md';
    const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async(input)=>{
      const u=new URL(String(input));
      if(u.pathname==='/graphql') {
        if(failure==='errors')return Response.json({errors:[{message:'synthetic provider failure'}],data:{repository:{object:null}}});
        if(failure==='oversized')return new Response(' '.repeat(2*1024*1024+1));
        const node:any={oid:'head',committedDate:'2026-10-01T00:00:00Z',f0:{object:{__typename:'Blob',text:'---\nstatus: ready\n---'}},parents:{nodes:[]}};
        if(failure==='partial')delete node.f0;
        if(failure==='cycle')node.parents.nodes=[{...node,parents:{nodes:[]}}];
        return Response.json({data:{repository:{object:node}}});
      }
      if(u.pathname.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
      if(u.pathname.endsWith('/branches/main'))return Response.json({commit:{sha:'head',commit:{tree:{sha:'tree'}}}});
      if(u.pathname.includes('/git/trees/'))return Response.json({tree:[{path,sha:'blob',type:'blob'}]});
      return Response.json({encoding:'base64',content:Buffer.from('---\ntitle: Post\nstatus: ready\n---\nBody').toString('base64')});
    }});
    const s=await client.releaseSnapshot();
    await assert.rejects(()=>s.firstReadyAt!(s.posts[0]),/INVALID_READY_HISTORY|READY_HISTORY_RESPONSE_LIMIT/);
  }
});

test('repeated snapshots refresh main while reusing immutable blobs and trees within one request',async()=>{
  let branches=0,blobs=0,trees=0;
  const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
    const u=new URL(String(input));
    if(u.pathname.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
    if(u.pathname.endsWith('/branches/main')) {branches++;const n=branches===1?1:2;return Response.json({commit:{sha:`head${n}`,commit:{tree:{sha:`tree${n}`}}}});}
    if(u.pathname.includes('/git/trees/')) {trees++;const n=u.pathname.endsWith('tree1')?1:2;return Response.json({tree:[{path:'src/content/posts/a.md',sha:`blob${n}`,type:'blob'}]});}
    blobs++;return Response.json({encoding:'base64',content:Buffer.from(`---\ntitle: ${u.pathname.endsWith('blob1')?'First':'Changed'}\nstatus: ready\n---\nBody`).toString('base64')});
  }});
  assert.equal((await client.releaseSnapshot()).posts[0].title,'First');
  assert.equal((await client.releaseSnapshot()).posts[0].title,'Changed');
  assert.equal((await client.releaseSnapshot()).posts[0].title,'Changed');
  assert.equal(branches,3);assert.equal(trees,2);assert.equal(blobs,2);
});

test('a confirmed missing historical file ends readiness while unrelated NOT_FOUND errors fail closed',async()=>{
  for(const unrelated of [false,true]) {
    const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'synthetic'},fetch:async input=>{
      const u=new URL(String(input));
      if(u.pathname==='/graphql')return Response.json({data:{repository:{object:{oid:'head',committedDate:'2026-10-02T00:00:00Z',f0:{object:{__typename:'Blob',text:'---\nstatus: ready\n---'}},parents:{nodes:[{oid:'old',committedDate:'2026-10-01T00:00:00Z',f0:null,parents:{nodes:[]}}]}}}},errors:[{type:'NOT_FOUND',path:unrelated?['repository']:['repository','object','parents','nodes',0,'f0']}]});
      if(u.pathname.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
      if(u.pathname.endsWith('/branches/main'))return Response.json({commit:{sha:'head',commit:{tree:{sha:'tree'}}}});
      if(u.pathname.includes('/git/trees/'))return Response.json({tree:[{path:'src/content/posts/a.md',sha:'blob',type:'blob'}]});
      return Response.json({encoding:'base64',content:Buffer.from('---\ntitle: Post\nstatus: ready\n---\nBody').toString('base64')});
    }});
    const s=await client.releaseSnapshot();
    if(unrelated)await assert.rejects(()=>s.firstReadyAt!(s.posts[0]),/INVALID_READY_HISTORY/);
    else assert.equal(await s.firstReadyAt!(s.posts[0]),'2026-10-02T00:00:00Z');
  }
});
