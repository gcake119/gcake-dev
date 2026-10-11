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
