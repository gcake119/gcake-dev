import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const HERMES_ATTENTION_FILE='/Users/Shared/gcake-substack-hermes/input/status.json';
export interface AttentionRound {status:string;results:{slug:string;target:string;operation:string;status:string;code?:string}[]}
const reasons=new Set(['DISTRIBUTION_MANUAL_REQUIRED','SUBSTACK_BACKGROUND_ATTENDED_REQUIRED']);
const issueCode=(r:AttentionRound['results'][number])=>r.status==='manual_required'?'DISTRIBUTION_MANUAL_REQUIRED':reasons.has(r.code??'')?r.code:undefined;
export async function publishAttentionSnapshot(file:string,round:AttentionRound){
 // Incomplete source/round evidence cannot resolve a previously recorded hold.
 if(round.results.some(r=>!issueCode(r)&&r.status!=='verified')||round.status!=='completed'&&!round.results.length)return {status:'retained'};
 const issues=[...new Map(round.results.filter(r=>r.target==='substack'&&!!issueCode(r)).map(r=>{
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.slug.length>180)throw Error('HERMES_ATTENTION_INPUT_INVALID');
  return [r.slug,{slug:r.slug,code:issueCode(r)!}] as const;
 })).values()].sort((a,b)=>a.slug.localeCompare(b.slug));
 if(issues.length>100)throw Error('HERMES_ATTENTION_INPUT_INVALID');
 const temporary=path.join(path.dirname(file),'.status-'+randomUUID());
 try{await fs.writeFile(temporary,JSON.stringify({schema:1,generatedAt:new Date().toISOString(),issues})+'\n',{flag:'wx',mode:0o600});await fs.rename(temporary,file);}
 finally{await fs.unlink(temporary).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;});}
 return {status:'queued'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,...extra]=process.argv.slice(2);
 if(mode!=='--seed'||!file||extra.length)throw Error('HERMES_ATTENTION_USAGE');
 publishAttentionSnapshot(HERMES_ATTENTION_FILE,JSON.parse(await fs.readFile(file,'utf8'))).then(result=>{console.log(JSON.stringify(result));if(result.status!=='queued')process.exitCode=1;});
}
