import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import YAML from 'yaml';
test('workflow gates all editorial writers and retains recovery without push reservations',async()=>{
 const workflow=YAML.parse(await fs.readFile('.github/workflows/deploy-pages.yml','utf8'));
 assert.equal(workflow.permissions.contents,'read');assert.equal(workflow.concurrency.group,'pages');assert.equal(workflow.concurrency['cancel-in-progress'],false);
 assert.deepEqual(workflow.on.schedule.map((s:any)=>s.cron),['37 * * * *','0 23 * * 0,3']);
 for(const job of ['prepare','confirm']){
  assert.match(workflow.jobs[job].if,/vars.EDITORIAL_RELEASE_ENABLED == 'true'/);
  assert.match(workflow.jobs[job].if,/refs\/heads\/main/);
  assert.equal(workflow.jobs[job].environment,'editorial-release');assert.equal(workflow.jobs[job].permissions.contents,'write');
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
