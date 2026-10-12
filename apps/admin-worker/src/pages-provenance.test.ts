import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubAppReadClient } from './github';

const publication = 'a'.repeat(40), trigger = 'b'.repeat(40), unrelated = 'c'.repeat(40);
function fixture(options: { outcome?: string; phase?: 'build'|'deploy'; noOp?: boolean; missing?: boolean } = {}) {
  const writes: string[] = [];
  const run = (id:number,sha:string,time:string,conclusion='success') => ({id,head_sha:sha,head_branch:'main',status:'completed',conclusion,event:'schedule',run_started_at:time,updated_at:time,html_url:`https://github.com/gcake119/gcake-dev/actions/runs/${id}`});
  const client = new GitHubAppReadClient({
    installationTokens:{create:async()=> 'synthetic-token'},
    fetch:async(input,init)=> {
      const url=new URL(String(input)), p=url.pathname;
      if(init?.method==='POST') {writes.push(p);return new Response(null,{status:201});}
      if(p==='/repos/gcake119/gcake-dev')return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
      if(p.endsWith('/workflows/deploy-pages.yml/runs'))return Response.json({workflow_runs:[run(90,unrelated,'2026-10-15T02:00:00Z')]});
      if(p.endsWith('/workflows/editorial-release.yml/runs'))return Response.json({workflow_runs:options.missing?[]:[run(110,unrelated,'2026-10-15T03:00:00Z'),run(100,trigger,'2026-10-14T23:00:00Z',options.outcome??'success')]});
      if(p.endsWith('/runs/90/jobs'))return Response.json({jobs:[{name:`Deploy publication ${unrelated}`,status:'completed',conclusion:'success'}]});
      if(p.endsWith('/runs/110/jobs'))return Response.json({jobs:[{name:'release',status:'completed',conclusion:'success'},{name:'build',status:'completed',conclusion:'skipped'},{name:'deploy',status:'completed',conclusion:'skipped'}]});
      if(p.endsWith('/runs/100/jobs'))return Response.json({jobs:[{name:`Build publication ${publication}`,status:'completed',conclusion:options.phase==='build'?'failure':'success'},{name:`Deploy publication ${publication}`,status:'completed',conclusion:options.noOp||options.phase==='build'?'skipped':options.outcome??'success'}]});
      return Response.json({}, {status:404});
    },
  });
  return {client,writes};
}

test('CMS matches editorial artifact SHA despite preceding trigger SHA and newer unrelated/no-op runs',async()=> {
  const {client,writes}=fixture();
  const result=await client.getPagesDeployment(publication);
  assert.equal(result?.commitSha,publication);
  assert.equal(result?.state,'deployed');
  assert.equal(result?.url,'https://github.com/gcake119/gcake-dev/actions/runs/100');
  assert.deepEqual(writes,[]);
});
test('missing or skipped deployment never becomes deployed after scheduler success',async()=> {
  for(const options of [{missing:true},{noOp:true}])assert.equal(await fixture(options).client.getPagesDeployment(publication),undefined);
});
test('CMS reports failed snapshot/build and failed deployment for the actual publication SHA',async()=> {
  for(const phase of ['build','deploy'] as const) assert.equal((await fixture({outcome:'failure',phase}).client.getPagesDeployment(publication))?.state,'failed');
});
test('recovery reruns only failed jobs of the matching editorial run, never unrelated newest run',async()=> {
  const {client,writes}=fixture({outcome:'failure'});
  await client.retryPagesDeployment(publication);
  assert.deepEqual(writes,['/repos/gcake119/gcake-dev/actions/runs/100/rerun-failed-jobs']);
});
test('successful or unproven publication refuses recovery without external writes',async()=> {
  for(const options of [{},{missing:true},{noOp:true}]) {
    const {client,writes}=fixture(options);
    await assert.rejects(client.retryPagesDeployment(publication),/REVERIFY_REQUIRED/);
    assert.deepEqual(writes,[]);
  }
});
