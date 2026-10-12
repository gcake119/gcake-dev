/** Read-only handover inspection. Credentials are only loaded by Node --env-file. */
import fs from 'node:fs/promises';
import {CloudflareD1Database} from './d1-api';
const database=new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID??'',process.env.DISTRIBUTION_D1_DATABASE_ID??'',process.env.CLOUDFLARE_API_TOKEN??'');
const query=async(sql:string)=>(await database.prepare(sql).all()).results;
const report={checkedAt:new Date().toISOString(),providerWrites:false,locks:await query('SELECT post_slug,target,owner,acquired_at FROM publication_locks'),checkpoints:await query('SELECT post_slug,target,source_revision,operation,created_at,attempt_id FROM publication_checkpoints'),states:await query("SELECT post_slug,target,source_revision,status,remote_id,remote_url,verified_at FROM publication_target_states WHERE target = 'substack'"),unsettledAttempts:await query("SELECT id,run_id,target,status,created_at FROM publication_attempts WHERE status = 'intent'")};
await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output:process.argv[2],locks:report.locks.length,checkpoints:report.checkpoints.length,unsettledAttempts:report.unsettledAttempts.length,states:report.states.length,providerWrites:false}));
