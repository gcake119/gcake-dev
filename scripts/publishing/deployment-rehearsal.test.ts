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
