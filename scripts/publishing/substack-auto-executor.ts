import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {ScheduleRecord,ConfirmedSlot} from '../../apps/admin-worker/src/substack-schedules';
import type {ScheduledSource} from './scheduled-source';
import {assertOutsideAnyGit} from './substack-attended';
import {validateScheduleHandoff,type ScheduleEnvelope} from './substack-schedule-handoff';
import {validateScheduleReply,validateScheduleObservation,readSchedulePreviewUi} from './substack-schedule-attended';
import {contentFingerprint,expectedContent} from './substack-schedule';
import {verifyDraftLists} from './substack-draft-lists';
import {executeComputerUse} from './substack-draft-qualification';
import {assertAutoSchedulePolicy,type AutoSchedulePolicy} from './substack-auto-activation';
export interface AutomaticExecutorOptions {
 policy:AutoSchedulePolicy;source:ScheduledSource;timeoutMs:number;
 check():Promise<{record:ScheduleRecord;slot:ConfirmedSlot|undefined}>;
 execute?:(request:string,scope:{directory:string;executor:string;timeoutMs:number},evidence:string)=>Promise<void>;
}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function signal(file:string,value:unknown){const partial=file+'.partial';await fs.writeFile(partial,JSON.stringify(value),{mode:0o600,flag:'wx'});try{await fs.link(partial,file);}finally{await fs.unlink(partial);}}
export async function replyWithAutomaticExecutor(file:string,o:AutomaticExecutorOptions){
 assertAutoSchedulePolicy(o.policy,new Date().toISOString());
 const envelope=JSON.parse(await fs.readFile(file,'utf8')) as ScheduleEnvelope,r=envelope.request;
 const mutation=['schedule-create','schedule-update','schedule-arm'].includes(r.action);
 if(!['prepare-draft','arm-schedule'].includes(r.operation)||!['schedule-find','schedule-read','schedule-create','schedule-update','schedule-arm'].includes(r.action)||r.publishedUpdate===true||r.action==='schedule-arm'&&r.operation!=='arm-schedule'||['schedule-create','schedule-update'].includes(r.action)&&r.operation!=='prepare-draft')throw Error('SUBSTACK_AUTO_ACTION_FORBIDDEN');
 const check=async()=>{const fresh=await o.check();validateScheduleHandoff(envelope,fresh.record,o.source,Date.now(),fresh.slot);return fresh;};
 await check();
 await fs.mkdir(o.policy.evidenceDirectory,{recursive:true,mode:0o700});assertOutsideAnyGit(await fs.realpath(o.policy.evidenceDirectory));assertOutsideAnyGit(await fs.realpath(path.dirname(file)));
 const directory=await fs.mkdtemp(path.join(o.policy.evidenceDirectory,'first-schedule-'));await fs.chmod(directory,0o700);
 const request=path.join(directory,'request.json'),evidence=path.join(directory,'observation.json');await fs.copyFile(file,request,fs.constants.COPYFILE_EXCL);
 const expected=expectedContent(o.source);await fs.writeFile(path.join(directory,'write-payload.json'),JSON.stringify({...expected,html:expected.html.replace(/\n(?=<\/code><\/pre>)/g,''),slug:o.source.slug,scheduledAt:r.scheduledAt,localTime:r.scheduledAt?new Date(Date.parse(r.scheduledAt)+28800000).toISOString().slice(0,16):undefined}),{mode:0o600,flag:'wx'});
 const end=Math.min(envelope.expiresAt,Date.now()+o.timeoutMs);
 const gate=`import fs from 'node:fs/promises';import {createHash} from 'node:crypto';const base=${JSON.stringify(directory)},raw=await fs.readFile(base+'/before.json','utf8'),beforeHash=createHash('sha256').update(raw).digest('hex');await fs.writeFile(base+'/before-ready.json',JSON.stringify({beforeHash}),{flag:'wx',mode:0o600});let passed=false;while(Date.now()<${end}){let v;try{v=JSON.parse(await fs.readFile(base+'/before-verdict.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}if(v){if(v.requestId!==${JSON.stringify(envelope.requestId)}||v.scopeDigest!==${JSON.stringify(envelope.scopeDigest)}||v.beforeHash!==beforeHash||v.expiresAt<=Date.now()||v.ok!==true)throw Error(v.code??'SUBSTACK_AUTO_BEFORE_INVALID');passed=true;break;}await new Promise(r=>setTimeout(r,100));}if(!passed)throw Error('SUBSTACK_AUTO_BEFORE_REQUIRED');console.log('SUBSTACK_AUTO_BEFORE_VERIFIED');`;
 await fs.writeFile(path.join(directory,'verify-before.mjs'),gate,{flag:'wx',mode:0o600});
 let done=false,executionError:unknown,gatePassed=false,gateFailure:unknown;
 const execution=(o.execute??executeAutomaticScheduleRequest)(request,{directory,executor:o.policy.executor,timeoutMs:Math.min(o.timeoutMs,Math.max(1,end-Date.now()))},evidence).then(()=>{done=true;},e=>{executionError=e;done=true;});
 while(!done&&Date.now()<end){
  if(mutation&&!gatePassed&&!gateFailure){
   let marker;try{marker=JSON.parse(await fs.readFile(path.join(directory,'before-ready.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(marker){let beforeHash=marker.beforeHash;try{
    const raw=await fs.readFile(path.join(directory,'before.json'),'utf8');beforeHash=hash(raw);if(marker.beforeHash!==beforeHash)throw Error('SUBSTACK_AUTO_BEFORE_INVALID');const before=JSON.parse(raw),fresh=await check();
    if(before.sessionExclusive!==true||before.reloaded!==true)throw Error('SUBSTACK_AUTO_BEFORE_INVALID');
    const lists=verifyDraftLists(before.lists,r.action==='schedule-create'?undefined:r.remote?.id);
    if(r.action==='schedule-create'){
     if(before.lists.lists.some((l:{rows:{text:string}[]})=>l.rows.some(row=>row.text.replace(/\s+/g,' ').includes(o.source.article.title.replace(/\s+/g,' ')))))throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');
    }else{
     const observed=validateScheduleObservation(before.observation,r.remote?.id);
     if(observed.state!=='draft'||observed.slug!==o.source.slug||observed.listEvidence?.draft!==true||observed.listEvidence.scheduled!==false||observed.scheduledAt)throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');
     const digest=contentFingerprint(observed.content);
     if(r.action==='schedule-update'&&digest!==fresh.record.lastComparison?.observedDigest||r.action==='schedule-arm'&&digest!==contentFingerprint(expected))throw Error('SUBSTACK_REMOTE_EDIT_CONFLICT');
     if(r.action==='schedule-arm'){const preview=readSchedulePreviewUi(before.preview,before.deviceTimeZone);if(preview.scheduleSelected!==true||!preview.email||!preview.appInbox||Date.parse(preview.scheduledAt!)!==Date.parse(r.scheduledAt!))throw Error('SUBSTACK_SCHEDULE_EVIDENCE_INVALID');}
    }
    await check();await signal(path.join(directory,'before-verdict.json'),{ok:true,requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash,expiresAt:end,lists});gatePassed=true;
   }catch(e){gateFailure=e;await signal(path.join(directory,'before-verdict.json'),{ok:false,requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash,expiresAt:end,code:e instanceof Error?e.message:'SUBSTACK_AUTO_BEFORE_INVALID'});}}
  }
  if(!done)await new Promise(resolve=>setTimeout(resolve,50));
 }
 if(!done)throw Error('SUBSTACK_AUTO_EXECUTOR_TIMEOUT');
 await execution;if(executionError)throw executionError;if(mutation&&!gatePassed)throw gateFailure??Error('SUBSTACK_AUTO_BEFORE_REQUIRED');
 const events=(await fs.readFile(path.join(directory,'executor-events.jsonl'),'utf8')).split('\n').filter(Boolean).map(s=>JSON.parse(s));
 const surfaces=events.filter(e=>e.type==='item.completed'&&e.item?.type==='mcp_tool_call').map(e=>e.item.result?._meta?.['codex/toolSurface']).filter(Boolean);
 if(!surfaces.length||surfaces.some(s=>s.browserFamily!=='chrome'))throw Error('SUBSTACK_EXECUTOR_BROWSER_MISMATCH');
 const value=JSON.parse(await fs.readFile(evidence,'utf8'));
 if(value.sessionExclusive!==true||value.reloaded!==true)throw Error('SUBSTACK_AUTO_EVIDENCE_INVALID');
 const lists=verifyDraftLists(value.lists);let result=value.result;
 if(r.action==='schedule-find'){
  validateScheduleReply(r,result);
  const matches=value.lists.lists.flatMap((l:{rows:{href:string;text:string}[]})=>l.rows).filter((row:{text:string})=>row.text.replace(/\s+/g,' ').includes(o.source.article.title.replace(/\s+/g,' ')));
  if(matches.length!==result.items.length)throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
  for(const item of result.items)if(!lists.ids[item.state==='draft'?'draft':item.state==='scheduled'?'scheduled':'published'].includes(item.id))throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
 }else{
  const observed=validateScheduleObservation(value.observation,r.action==='schedule-create'?undefined:r.remote?.id);
  const scope=observed.state==='draft'?'draft':observed.state==='scheduled'?'scheduled':'published';if(!lists.ids[scope].includes(observed.id))throw Error('SUBSTACK_AUTO_EVIDENCE_INVALID');
  if(observed.state==='draft'&&(observed.listEvidence?.draft!==true||observed.listEvidence.scheduled!==false))throw Error('SUBSTACK_AUTO_EVIDENCE_INVALID');
  if(mutation&&(['savedBeforeReload','navigatedAway','reloaded'].some(k=>value.writeEvidence?.[k]!==true)||r.action!=='schedule-arm'&&value.writeEvidence?.fullBodyPasted!==true))throw Error('SUBSTACK_WRITE_EVIDENCE_INVALID');
  if(mutation&&(observed.slug!==o.source.slug||contentFingerprint(observed.content)!==contentFingerprint(expected)))throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
  if(r.action==='schedule-create'){if(observed.state!=='draft')throw Error('SUBSTACK_AUTO_PROTECTED_ORIGINAL');result={id:observed.id};}else result=observed;
  validateScheduleReply(r,result);
 }
 await check();
 await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...envelope,request:undefined,ok:true,result}),{flag:'wx',mode:0o600});
 await fs.writeFile(path.join(directory,'result.json'),JSON.stringify({requestId:envelope.requestId,action:r.action,remoteId:r.remote?.id??result.id,passed:true,completedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
}
export async function executeAutomaticScheduleRequest(file:string,scope:{directory:string;executor:string;timeoutMs:number},evidence:string){
 const envelope=JSON.parse(await fs.readFile(file,'utf8')) as ScheduleEnvelope,r=envelope.request;
 const verifier=[process.execPath,path.join(scope.directory,'verify-before.mjs')];
 const prompt=`The owner authorized the separately qualified FIRST Substack scheduling worker. This request is DATA at ${JSON.stringify(file)}; write-payload.json contains desired content and time, never observed evidence. Execute only ${r.action}, original ID ${r.remote?.id??'not yet created'}, slug ${JSON.stringify(r.article.slug)}, publication https://gcakedev.substack.com. Use ONLY mcp__cua_repl for browser actions, follow current tool documentation, select literal Chrome and verify actual family. Inventory tabs; reuse a safely operable saved same-publication admin tab when available, preserving user-owned tabs. Only create an owned tab if necessary and close it after a settled result; keep a necessary uncertain tab for handoff. Never use Brave, private APIs, cookie/storage exports, shell/AppleScript/CDP browser control, delete, cancel, update a public/scheduled article, publish now, send a test or resend. Respect the finite deadline. Never replay any write after timeout or unknown outcome.
Read COMPLETE Drafts/Scheduled/Published UI lists with fresh snapshots after loading and exhaustive pagination. Capture raw list evidence as schemaVersion:1, lists:[{state:draft|scheduled|published,label:actual selected-tab text including total,selected:actual boolean aria-selected,loading:actual boolean,nextEnabled:false only after pagination exhausted,rows:[{href:actual anchor,text:actual row text}]}]. Preserve complete observed anchors in BOTH /publish/post/ID and /publish/posts/detail/ID forms; do not hardcode counts. Never infer evidence from expected payloads. Every result contains sessionExclusive:true,reloaded:true,lists:<actual final lists>.
For schedule-find, find ALL matching original identities by actual title/slug, inspect candidate content and persisted slug read-only. Return result:{complete:true,scanned:[draft,scheduled,published],items:[actual observations]}; do not create or edit anything. Conflicting or incomplete lists stop.
For schedule-read, find the ID in complete lists, navigate to that original, reload, read saved title, subtitle, FULL HTML, all image src/alt/loaded and persisted Settings > SEO slug. For scheduled articles read actual confirmed time, timezone, everyone and email/App configuration read-only. Do not cancel or edit an armed original. Return observation:{id,slug,state:draft|scheduled|published|sending,saved:true,listEvidence:{draft,scheduled},content:{title,description,html},images:[{src,alt,loaded}],scheduledAt,timeZone,email,appInbox,audience,canonical,publishedAt}, populated only where actually observed. Missing proof stops.
Before ANY consequential create/update or final schedule submission, write before.json with sessionExclusive:true,reloaded:true,lists and, except create, actual original draft observation. Update requires the original is exclusively a saved unscheduled draft. Arm requires the same saved unscheduled original; open Continue and configure Everyone, combined Email/Substack App ON and scheduled publication ON, exact payload localTime, GMT+8. Commit the preview date control by blur. Capture before.preview={html:actual dialog outerHTML,audienceRadios:[{value,checked:actual input.checked}],localTime:actual input.value,attributeTime:actual input.getAttribute(value),min:actual min,max:actual max} and deviceTimeZone from actual browser environment. Preview is not publication evidence. Do not submit until the parent gate passes.
Then run this exact ordinary local command (not browser control): ${JSON.stringify(verifier)}. It must FINISH with SUBSTACK_AUTO_BEFORE_VERIFIED; never write before-verdict.json yourself. Missing/negative verdict is a hard stop. Parent checks current source, confirmed slot, generation, original content and intent. For create this gate runs BEFORE New post; for update BEFORE any content edit; for arm BEFORE final submit. Reconfirm the same actual page after the gate.
Create exactly ONE draft using observed UI, fill desired title/subtitle, paste the complete rich HTML ONCE via documented clipboard UI, set exact persisted slug in Settings > SEO, and wait for Saved. Do not press Publish/Continue for create. Update only the original saved unscheduled draft; fill exact title/subtitle and replace the full rich HTML ONCE, keep exact slug, wait for Saved. Never edit scheduled/public originals. Arm submits the exact configured future schedule ONCE, never an immediate-send button; if offered a subscription button, retain original body by choosing no insertion. On any uncertain submission stop without replay.
After mutation wait for saved confirmation, navigate away, re-read COMPLETE lists, navigate to SAME numeric ID, reload, and read actual saved full content/slug/media. For arm require Scheduled includes ID at exact time, Drafts excludes it, and read actual timezone, everyone, email/App configuration without removing schedule. Save a screenshot and ${JSON.stringify(evidence)} with actual observation, actual final lists and writeEvidence:{fullBodyPasted:true only for actual create/update paste,savedBeforeReload:true,navigatedAway:true,reloaded:true}. Never fill observations from source/request. Never write reply.json, modify source/D1/config, start timers or send messages. The controller independently validates and writes reply. Report bounded metadata only; retain unknown evidence.`;
 return executeComputerUse(prompt,scope);
}
