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
