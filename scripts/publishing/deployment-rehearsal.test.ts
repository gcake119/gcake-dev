import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import YAML from 'yaml';
test('manual Pages deployment preserves disabled editorial writers and never triggers on pushes or schedules',async()=>{
 const workflow=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 assert.equal(workflow.permissions.contents,'read');assert.equal(workflow.concurrency.group,'pages');assert.equal(workflow.concurrency['cancel-in-progress'],false);
 assert.equal(workflow.on.schedule,undefined);
 assert.equal(workflow.on.push,undefined);
 assert.ok(Object.hasOwn(workflow.on,'workflow_dispatch'));
 for(const job of ['prepare','confirm']){
  assert.match(workflow.jobs[job].if,/vars.EDITORIAL_RELEASE_ENABLED == 'true'/);
  assert.match(workflow.jobs[job].if,/refs\/heads\/main/);
  assert.equal(workflow.jobs[job].environment,'editorial-release');assert.equal(workflow.jobs[job].permissions.contents,'read');
 }
 assert.match(workflow.jobs.prepare.steps.at(-1).run,/RELEASE_EVENT.*schedule.*workflow_dispatch/);
 assert.equal(workflow.jobs.confirm.needs,'deploy');
 assert.match(workflow.jobs.deploy.steps[0].run,/test "\$current" = "\$SOURCE_REVISION"/);
 assert.deepEqual(workflow.jobs.build.permissions,{contents:'read',pages:'read'});
});
test('PR CI validates the candidate without deployment credentials or production writes',async()=>{
 const workflow=YAML.parse(await fs.readFile('.github/workflows/validate-editorial.yml','utf8'));
 assert.deepEqual(workflow.on.pull_request.branches,['main']);
 assert.equal(workflow.on.pull_request_target,undefined);
 assert.deepEqual(workflow.permissions,{contents:'read'});
 assert.equal(workflow.env.EDITORIAL_RELEASE_ENABLED,'false');
 assert.equal(workflow.env.HERMES_RSS_NOTIFY_ENABLED,'false');
 assert.deepEqual(Object.keys(workflow.jobs),['validate']);
 assert.equal(workflow.jobs.validate.environment,undefined);
 const checkout=workflow.jobs.validate.steps.find((step:any)=>step.uses?.startsWith('actions/checkout@'));
 assert.equal(checkout.with['persist-credentials'],false);
 const run=workflow.jobs.validate.steps.map((step:any)=>step.run??'').join('\n');
 for(const command of ['pnpm test','pnpm check','pnpm build','pnpm editorial:rehearse'])assert.ok(run.includes(command));
 assert.doesNotMatch(JSON.stringify(workflow),/secrets\.|deploy-pages@|wrangler|git push|--live/);
});

test('unattended App credentials are scoped to release writers after dependency installation',async()=>{
 const workflow=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 for(const name of ['prepare','confirm']){
  const steps=workflow.jobs[name].steps;
  const auth=steps.find((s:any)=>s.id==='editorial-app');
  assert.ok(auth,'Dedicated App authentication required');
  assert.match(auth.uses,/^actions\/create-github-app-token@[a-f0-9]{40}$/);
  assert.deepEqual(auth.with,{
   'client-id': '${{ vars.EDITORIAL_APP_CLIENT_ID }}',
   'private-key': '${{ secrets.EDITORIAL_APP_PRIVATE_KEY }}',
   owner: '${{ github.repository_owner }}',
   repositories: '${{ github.event.repository.name }}',
   'permission-contents':'write'
  });
  assert.ok(steps.indexOf(auth)>steps.findIndex((s:any)=>s.run==='pnpm install --frozen-lockfile'));
  const gate=steps.find((s:any)=>s.run?.includes('pnpm test')&&s.run?.includes('pnpm check'));
  assert.ok(gate,'Full source validation required before App token');
  assert.ok(steps.indexOf(gate)<steps.indexOf(auth));
  assert.equal(gate.env.EDITORIAL_RELEASE_ENABLED,'false');
  assert.equal(gate.env.HERMES_RSS_NOTIFY_ENABLED,'false');
  assert.equal(steps.find((s:any)=>s.uses?.startsWith('actions/checkout@')).with['persist-credentials'],false);
  assert.equal(steps.at(-1).env.EDITORIAL_GIT_TOKEN,'${{ steps.editorial-app.outputs.token }}');
 }
 for(const name of ['build','deploy'])assert.doesNotMatch(JSON.stringify(workflow.jobs[name]),/EDITORIAL_APP_PRIVATE_KEY|EDITORIAL_GIT_TOKEN|create-github-app-token/);
});

test('manual Secret acceptance isolates environment credentials and excludes every publication job',async()=>{
 const w=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 assert.equal(w.on.workflow_dispatch.inputs.mode.default,'deploy');
 assert.deepEqual(w.on.workflow_dispatch.inputs.mode.options,['deploy','secret-check']);
 const pre=w.jobs['secret-check-preflight'], probe=w.jobs['secret-check'];
 assert.ok(pre&&probe,'Independent Secret acceptance jobs required');
 assert.equal(pre.environment,undefined);
 assert.match(pre.if,/workflow_dispatch/);assert.match(pre.if,/inputs.mode == 'secret-check'/);
 assert.match(pre.if,/refs\/heads\/feat\/editorial-release-queue/);
 assert.equal(probe.needs,'secret-check-preflight');assert.equal(probe.environment,'editorial-release');
 assert.deepEqual(probe.permissions,{contents:'read'});
 const auth=probe.steps.find((x:any)=>x.id==='acceptance-app');
 assert.equal(auth.with['permission-contents'],'read');assert.equal(auth.with['skip-token-revoke'],undefined);
 assert.deepEqual(Object.entries(auth.with).filter(([name])=>name.startsWith('permission-')),[['permission-contents','read']]);
 assert.equal(auth.with['private-key'],'${{ secrets.EDITORIAL_APP_PRIVATE_KEY }}');
 assert.equal(auth.with.repositories,'${{ github.event.repository.name }}');
 assert.match(auth.uses,/create-github-app-token@[a-f0-9]{40}$/);
 assert.doesNotMatch(JSON.stringify(probe),/checkout@|pnpm|editorial:release|release-orchestrate|deploy-pages@|wrangler|sendMessage|git push/);
 for(const name of ['prepare','build','deploy','confirm'])assert.match(w.jobs[name].if,/inputs.mode != 'secret-check'/,name);
});
test('Secret acceptance preflight rejects SHA drift and enabled gates before Secret access',async()=>{
 const w=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 const step=w.jobs['secret-check-preflight']?.steps[0];assert.ok(step,'Pre-secret gate required');
 const sha='a'.repeat(40);
 const run=(override:Record<string,string>)=>spawnSync('/bin/bash',['-e','-c',step.run],{encoding:'utf8',env:{PATH:process.env.PATH,EXPECTED_SHA:sha,ACTUAL_SHA:sha,QUEUE_ENABLED:'false',CMS_ENABLED:'false',...override}});
 assert.equal(run({}).status,0);
 for(const config of [{EXPECTED_SHA:'bad'},{ACTUAL_SHA:'b'.repeat(40)},{QUEUE_ENABLED:'true'},{CMS_ENABLED:'true'}] as Record<string,string>[])assert.notEqual(run(config).status,0);
});

test('Secret identity acceptance accepts installation schema and rejects scope drift without printing token',async()=>{
 const w=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 const step=w.jobs['secret-check'].steps.at(-1);
 const dir=await fs.mkdtemp(join(tmpdir(),'gcake-secret-shell-'));
 try {
  const fixture=dir+'/fixture.json';
  await fs.writeFile(dir+'/gh', '#!/bin/sh\n[ "$1" = api ] && [ "$2" = --hostname ] && [ "$3" = github.com ] || exit 2\ncase "$4" in\n/installation/repositories) cat "$FIXTURE";;\n/repos/gcake119/gcake-dev/contents/package.json) [ "$FAIL_CONTENTS" != 1 ] || exit 1; printf "{\\"type\\":\\"file\\",\\"path\\":\\"package.json\\"}";;\n*) exit 2;;\nesac\n',{mode:0o700});
  const run=async(repo:any,env:Record<string,string>={})=>{
   await fs.writeFile(fixture,JSON.stringify({total_count:1,repositories:[repo]}));
   return spawnSync('/bin/bash',['-e','-c',step.run],{encoding:'utf8',env:{PATH:dir+':'+process.env.PATH,RUNNER_TEMP:dir,FIXTURE:fixture,APP_SLUG:'gcake-editorial-release',INSTALLATION:'170331414',GH_TOKEN:'synthetic-never-print',...env}});
  };
  const repo={full_name:'gcake119/gcake-dev',permissions:{pull:true,push:false,admin:false,maintain:false}};
  assert.equal((await run(repo)).status,0);
  // Installation repository responses legitimately omit user permission booleans.
  assert.equal((await run({full_name:'gcake119/gcake-dev'})).status,0);
  assert.equal((await run({...repo,permissions:{contents:'read',metadata:'read'}})).status,0);
  assert.notEqual((await run({...repo,permissions:{contents:'write',metadata:'read'}})).status,0);
  for(const [value,env] of [[{...repo,full_name:'other/repo'},{}],[{...repo,permissions:{pull:true,push:true}},{}],[repo,{APP_SLUG:'other-app'}],[repo,{INSTALLATION:'1'}]] as [any,Record<string,string>][]) {
   const result=await run(value,env); assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout+result.stderr,/synthetic-never-print/);
  }
  assert.notEqual((await run(repo,{FAIL_CONTENTS:'1'})).status,0,'Content read failure must stop acceptance');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
