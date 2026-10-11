import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export interface Configuration {environment:any; variables:any; secrets:any; rulesets:any[]; app:any}
export function inspectConfiguration(c:Configuration){
 const vars=Object.fromEntries((c.variables?.variables??[]).map((v:any)=>[v.name,v.value]));
 const secrets=new Set((c.secrets?.secrets??[]).map((s:any)=>s.name));
 const env=c.environment;
 const rules=c.rulesets.filter(r=>r.target==='branch'&&r.enforcement==='active'
  &&r.conditions?.ref_name?.include?.includes('refs/heads/main')&&r.conditions?.ref_name?.exclude?.length===0);
 const has=(r:any,type:string)=>r.rules?.some((x:any)=>x.type===type);
 const integrity=rules.some(r=>!(r.bypass_actors?.length)&&has(r,'non_fast_forward')&&has(r,'deletion'));
 const review=rules.some(r=>has(r,'pull_request')&&r.rules?.some((x:any)=>x.type==='required_status_checks'
  &&x.parameters?.required_status_checks?.some((check:any)=>check.context==='validate'))
  &&r.bypass_actors?.length===1&&r.bypass_actors[0].actor_type==='Integration'
  &&r.bypass_actors[0].actor_id===c.app?.id&&r.bypass_actors[0].bypass_mode==='always');
 const checks=[
  {name:'production remains disabled',passed:vars.EDITORIAL_RELEASE_ENABLED===undefined||vars.EDITORIAL_RELEASE_ENABLED==='false'},
  {name:'environment does not require human or custom approval',passed:!!env&&Array.isArray(env.protection_rules)&&env.protection_rules.every((r:any)=>r.type==='branch_policy')},
  {name:'environment permits only Branch main',passed:env?.deployment_branch_policy?.custom_branch_policies===true&&env.branches?.length===1&&env.branches[0].name==='main'&&env.branches[0].type==='branch'},
  {name:'dedicated App client ID and private key name configured',passed:!!vars.EDITORIAL_APP_CLIENT_ID&&secrets.has('EDITORIAL_APP_PRIVATE_KEY')},
  {name:'App metadata matches client ID and minimum permissions',passed:!!c.app&&c.app.client_id===vars.EDITORIAL_APP_CLIENT_ID&&c.app.permissions?.contents==='write'&&Object.entries(c.app.permissions).every(([key,value])=>key==='contents'||(key==='metadata'&&value==='read'))},
  {name:'main force push and deletion blocked without bypass',passed:integrity},
  {name:'main PR and validate required with only dedicated App exception',passed:review}
 ];
 return {configurationReady:checks.every(c=>c.passed),activationReady:false,
  evidence:'read-only configuration metadata; installation scope and provider writes unverified',checks,
  remainingAcceptance:['App installation scope and protected-main write','Pages revision and deployment race/stop rehearsal','owner content and visual acceptance','Hermes scheduled dry-run completion','private Telegram receipt and live baseline','separate merge/deployment/activation authorization']};
}
export function readConfiguration():Configuration {
 const repo='repos/gcake119/gcake-dev';
 function get(endpoint:string,missing=false,collection?:string):any {
  try{
   const args=['api',endpoint,...(collection?['--paginate','--slurp']:[])];
   const raw=JSON.parse(execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
   if(!collection)return raw;
   if(!Array.isArray(raw))throw new Error('Invalid GitHub pagination response');
   return raw.flatMap(page=>{const rows=collection==='array'?page:page[collection];if(!Array.isArray(rows))throw new Error('Invalid GitHub collection response');return rows;});
  }
  catch(e){if(missing&&/HTTP 404/.test(String((e as any).stderr)))return null;throw new Error('Unable to read GitHub configuration');}
 }
 const environment=get(repo+'/environments/editorial-release',true);
 if(environment)environment.branches=get(repo+'/environments/editorial-release/deployment-branch-policies',false,'branch_policies');
 const variables={variables:get(repo+'/actions/variables',false,'variables')};
 const secrets=environment?{secrets:get(repo+'/environments/editorial-release/secrets',false,'secrets')}:null;
 const rules=get(repo+'/rulesets?includes_parents=true',false,'array');
 const rulesets=rules.map((r:any)=>get(repo+'/rulesets/'+r.id));
 const slug=variables.variables.find((v:any)=>v.name==='EDITORIAL_APP_SLUG')?.value;
 if(slug&&!/^[a-z0-9-]+$/.test(slug))throw new Error('Invalid editorial App slug');
 const app=slug?get('apps/'+slug):null;
 return {environment,variables,secrets,rulesets,app};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const report=inspectConfiguration(readConfiguration());console.log(JSON.stringify(report,null,2));if(!report.configurationReady)process.exitCode=1;}
 catch{console.error('Configuration inspection failed; check owner read access. No settings changed.');process.exitCode=1;}
}
