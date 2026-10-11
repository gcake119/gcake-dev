import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspectConfiguration, type Configuration} from './unattended-check';
function configured():Configuration{return {
 environment:{protection_rules:[],deployment_branch_policy:{custom_branch_policies:true},branches:[{name:'main',type:'branch'}]},
 variables:{variables:[{name:'EDITORIAL_APP_CLIENT_ID',value:'Iv1.synthetic'},{name:'EDITORIAL_APP_SLUG',value:'editorial-test'}]},
 secrets:{secrets:[{name:'EDITORIAL_APP_PRIVATE_KEY'}]},
 app:{id:123,client_id:'Iv1.synthetic',permissions:{contents:'write',metadata:'read'}},
 rulesets:[
 {target:'branch',enforcement:'active',conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},bypass_actors:[],rules:[{type:'non_fast_forward'},{type:'deletion'}]},
 {target:'branch',enforcement:'active',conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},bypass_actors:[{actor_type:'Integration',actor_id:123,bypass_mode:'always'}],rules:[{type:'pull_request'},{type:'required_status_checks',parameters:{required_status_checks:[{context:'validate'}]}}]}
 ]};}
test('configured unattended policy is reported separately from production acceptance',()=>{
 const report=inspectConfiguration(configured());assert.equal(report.configurationReady,true);assert.equal(report.activationReady,false);
});
test('missing environment, credentials or main protection cannot be called ready',()=>{
 const report=inspectConfiguration({environment:null,variables:{variables:[]},secrets:null,rulesets:[],app:null});
 assert.equal(report.configurationReady,false);assert.equal(report.activationReady,false);assert.ok(report.checks.some(c=>!c.passed));
});
test('reviewer wait, tag-only branch policy and broad App privilege block unattended configuration',()=>{
 for(const change of [
  (c:Configuration)=>c.environment.protection_rules=[{type:'required_reviewers'}],
  (c:Configuration)=>c.environment.branches=[{name:'main',type:'tag'}],
  (c:Configuration)=>c.app.permissions.administration='write',
  (c:Configuration)=>c.app.client_id='other',
  (c:Configuration)=>c.rulesets[0].bypass_actors=[{actor_type:'Integration',actor_id:123,bypass_mode:'always'}],
  (c:Configuration)=>c.rulesets[1].bypass_actors.push({actor_type:'RepositoryRole',actor_id:5,bypass_mode:'always'}),
  (c:Configuration)=>c.rulesets[1].conditions.ref_name.exclude=['refs/heads/main']
 ]){const c=configured();change(c);assert.equal(inspectConfiguration(c).configurationReady,false);}
});
test('configuration audit CLI only makes read requests and reports missing setup',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'unattended-audit-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const gh=path.join(root,'gh'), calls=path.join(root,'calls');
 await fs.writeFile(gh,`#!/usr/bin/env python3\nimport json,sys\nwith open(${JSON.stringify(calls)},'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\na=sys.argv[2]\nif '/environments/' in a: print('HTTP 404',file=sys.stderr); sys.exit(1)\ndata={'variables':[]} if a.endswith('/variables') else []
print(json.dumps([data] if '--slurp' in sys.argv else data))\n`);await fs.chmod(gh,0o700);
 const result=spawnSync(process.execPath,['--import','tsx','scripts/publishing/unattended-check.ts'],{encoding:'utf8',env:{...process.env,PATH:root+path.delimiter+process.env.PATH}});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).configurationReady,false);
 for(const raw of (await fs.readFile(calls,'utf8')).trim().split('\n')){const args=JSON.parse(raw);assert.equal(args[0],'api');assert.ok(args.slice(2).every((arg:string)=>['--paginate','--slurp'].includes(arg)));}
});

test('audit reads production flag from later API pages',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'unattended-pages-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const gh=path.join(root,'gh');
 await fs.writeFile(gh,`#!/usr/bin/env python3
import json,sys
a=sys.argv[2]
if '/environments/' in a: print('HTTP 404',file=sys.stderr); sys.exit(1)
if a.endswith('/variables'):
 pages=[{'variables':[]},{'variables':[{'name':'EDITORIAL_RELEASE_ENABLED','value':'true'}]}]
 print(json.dumps(pages if '--paginate' in sys.argv else pages[0]))
else: print(json.dumps([[]] if '--slurp' in sys.argv else []))
`);await fs.chmod(gh,0o700);
 const result=spawnSync(process.execPath,['--import','tsx','scripts/publishing/unattended-check.ts'],{encoding:'utf8',env:{...process.env,PATH:root+path.delimiter+process.env.PATH}});
 assert.equal(JSON.parse(result.stdout).checks.find((c:any)=>c.name==='production remains disabled').passed,false);
});
