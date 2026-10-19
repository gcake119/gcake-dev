import {verifyDraftLists} from './substack-draft-lists';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
import type {ScheduledSource} from './scheduled-source';
import type {DraftSyncPolicy} from './substack-draft-sync';
import {assertOutsideAnyGit} from './substack-attended';
import {validateDraftHandoff,validateDraftReply} from './substack-draft-computer-use';
import {contentFingerprint,expectedContent} from './substack-schedule';
import {executeComputerUse} from './substack-draft-qualification';
import {normalizeDraftObservation,expectedDraftContent,DRAFT_MEDIA_PROFILE} from './substack-draft-media';
import {validateScheduleObservation} from './substack-schedule-attended';

export interface DraftExecutorOptions {
 policy:DraftSyncPolicy;source:ScheduledSource;timeoutMs:number;check():Promise<ScheduleRecord>;
 fetcher?:typeof fetch;
 execute?:(request:string,scope:{directory:string;executor:string;timeoutMs:number},evidence:string)=>Promise<void>;
}
/** Publish complete coordination signals atomically, retaining exclusive-create semantics. */
async function writeSignal(file:string,value:unknown){
 const partial=file+'.partial';await fs.writeFile(partial,JSON.stringify(value),{mode:0o600,flag:'wx'});
 try{await fs.link(partial,file);}finally{await fs.unlink(partial);}
}
/** The controller owns envelopes. The browser process supplies only real UI observations. */
export async function replyWithDraftExecutor(file:string,o:DraftExecutorOptions){
 const p=o.policy,hash=(v:string)=>createHash('sha256').update(v).digest('hex');
 if(p.browserName!=='chrome'||!p.executor||!path.isAbsolute(p.executor)||!p.evidenceDirectory||!path.isAbsolute(p.evidenceDirectory))throw Error('SUBSTACK_EXECUTOR_SCOPE_INVALID');
 await fs.mkdir(p.evidenceDirectory,{recursive:true,mode:0o700});assertOutsideAnyGit(await fs.realpath(p.evidenceDirectory));
 const envelope=JSON.parse(await fs.readFile(file,'utf8')),r=envelope.request;
 validateDraftHandoff(envelope,await o.check(),o.source);
 // This qualified ordinary profile supports existing IDs only; flags cannot enable unqualified discovery/creation.
 if(!['draft-read','draft-update'].includes(r.action))throw Error('SUBSTACK_DRAFT_CREATION_DISABLED');
 if(o.source.media?.length&&p.mediaProfile!==DRAFT_MEDIA_PROFILE)throw Error('SUBSTACK_DRAFT_MEDIA_UNQUALIFIED');
 expectedDraftContent(o.source);
 const directory=await fs.mkdtemp(path.join(p.evidenceDirectory,'request-'));await fs.chmod(directory,0o700);
 const request=path.join(directory,'request.json'),evidence=path.join(directory,'observation.json');
 await fs.copyFile(file,request,fs.constants.COPYFILE_EXCL);
 const expected=expectedContent(o.source),payload={...expected,html:expected.html.replace(/\n(?=<\/code><\/pre>)/g,'')};
 if(contentFingerprint(payload)!==contentFingerprint(expected))throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
 await fs.writeFile(path.join(directory,'write-payload.json'),JSON.stringify(payload),{mode:0o600,flag:'wx'});
 const gate=`import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';const base=${JSON.stringify(directory)},requestId=${JSON.stringify(envelope.requestId)},scopeDigest=${JSON.stringify(envelope.scopeDigest)};const raw=await fs.readFile(base+'/before.json','utf8'),beforeHash=createHash('sha256').update(raw).digest('hex');const ready=base+'/before-ready.json';await fs.writeFile(ready+'.partial',JSON.stringify({requestId,scopeDigest,beforeHash}),{mode:0o600,flag:'wx'});try{await fs.link(ready+'.partial',ready);}finally{await fs.unlink(ready+'.partial');}const end=Date.now()+${Math.min(120000,o.timeoutMs)};let passed=false;while(Date.now()<end){let v;try{v=JSON.parse(await fs.readFile(base+'/before-verdict.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}if(v){if(v.requestId!==requestId||v.scopeDigest!==scopeDigest||v.beforeHash!==beforeHash||v.expiresAt<=Date.now())throw Error('SUBSTACK_BEFORE_VERDICT_INVALID');if(v.ok!==true)throw Error(v.code);passed=true;break;}await new Promise(r=>setTimeout(r,100));}if(!passed)throw Error('SUBSTACK_BEFORE_VERDICT_REQUIRED');console.log('SUBSTACK_BEFORE_VERIFIED');`;
 await fs.writeFile(path.join(directory,'verify-before.mts'),gate,{mode:0o600,flag:'wx'});
 const verifyLists=async()=>{let raw;try{raw=JSON.parse(await fs.readFile(path.join(directory,'list-evidence.json'),'utf8'));}catch{throw Error('SUBSTACK_DRAFT_LIST_INCOMPLETE');}return verifyDraftLists(raw,r.remote?.id);};
 const listScript=`import fs from 'node:fs/promises';import {verifyDraftLists} from ${JSON.stringify(new URL('./substack-draft-lists.ts',import.meta.url).href)};const proof=verifyDraftLists(JSON.parse(await fs.readFile('list-evidence.json','utf8')),${JSON.stringify(r.remote?.id)});await fs.writeFile('list-verdict.json',JSON.stringify(proof));console.log('SUBSTACK_DRAFT_LISTS_VERIFIED');`;
 await fs.writeFile(path.join(directory,'verify-lists.mts'),listScript,{mode:0o600,flag:'wx'});
 const scope={directory,executor:p.executor,timeoutMs:o.timeoutMs};
 let done=false,executionError:unknown,gateError:unknown,gatePassed=false,gateHandled=false,capturedBefore:unknown;
 const mediaEvidence:Record<string,unknown>={profile:p.mediaProfile??null};
 const normalize=async(value:any,kind:string)=>{
  validateScheduleObservation(value,r.remote?.id);
  if(value.images?.length&&p.mediaProfile!==DRAFT_MEDIA_PROFILE)throw Error('SUBSTACK_DRAFT_MEDIA_UNQUALIFIED');
  const normalized=await normalizeDraftObservation(value,o.fetcher,o.source.media?.map(m=>m.src));mediaEvidence[kind]=normalized.images;return normalized.observation;
 };
 const execution=(o.execute??executeDraftRequest)(request,scope,evidence).then(()=>{done=true;},e=>{executionError=e;done=true;});
 try{while(!done){
  if(r.action==='draft-update'&&!gateHandled){
   let marker;try{marker=JSON.parse(await fs.readFile(path.join(directory,'before-ready.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(marker){
    gateHandled=true;let beforeHash=marker.beforeHash;
    try{
     const raw=await fs.readFile(path.join(directory,'before.json'),'utf8');beforeHash=hash(raw);
     if(marker.requestId!==envelope.requestId||marker.scopeDigest!==envelope.scopeDigest||marker.beforeHash!==beforeHash)throw Error('SUBSTACK_BEFORE_VERDICT_INVALID');
     validateDraftHandoff(envelope,await o.check(),o.source);
     await verifyLists();
     const actual=JSON.parse(raw);if(actual.sessionExclusive!==true||actual.reloaded!==true)throw Error('SUBSTACK_DRAFT_UI_EVIDENCE_INVALID');
     const normalized=await normalize(actual.observation,'before');
     if(normalized.slug!==o.source.slug||normalized.state!=='draft'||normalized.listEvidence?.draft!==true||normalized.listEvidence?.scheduled!==false||normalized.scheduledAt||contentFingerprint(normalized.content)!==r.precondition?.digest)throw Error('SUBSTACK_REMOTE_EDIT_CONFLICT');
     validateDraftHandoff(envelope,await o.check(),o.source);capturedBefore=actual.observation;
     await writeSignal(path.join(directory,'before-verdict.json'),{ok:true,requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash,expiresAt:envelope.expiresAt,digest:r.precondition.digest});gatePassed=true;
    }catch(e){
     gateError=e;const code=e instanceof Error&&/^SUBSTACK_[A-Z_]+$/.test(e.message)?e.message:'SUBSTACK_DRAFT_READ_INCONCLUSIVE';
     await writeSignal(path.join(directory,'before-verdict.json'),{ok:false,requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash,expiresAt:envelope.expiresAt,code});
    }
   }
  }
  if(!done)await new Promise(resolve=>setTimeout(resolve,50));
 }
 }catch(e){
  try{const raw=await fs.readFile(path.join(directory,'before.json'),'utf8');await writeSignal(path.join(directory,'before-verdict.json'),{ok:false,requestId:envelope.requestId,scopeDigest:envelope.scopeDigest,beforeHash:hash(raw),expiresAt:envelope.expiresAt,code:'SUBSTACK_BEFORE_VERDICT_INVALID'});}catch{}
  await execution;throw e;
 }
 await execution;if(executionError)throw executionError;
 if(r.action==='draft-update'&&!gatePassed)throw gateError??Error('SUBSTACK_BEFORE_VERDICT_REQUIRED');
 const events=(await fs.readFile(path.join(directory,'executor-events.jsonl'),'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));
 const surfaces=events.filter(e=>e.type==='item.completed'&&e.item?.type==='mcp_tool_call').map(e=>e.item.result?._meta?.['codex/toolSurface']).filter(Boolean);
 if(!surfaces.length||surfaces.some(s=>s.browserFamily!=='chrome'))throw Error('SUBSTACK_EXECUTOR_BROWSER_MISMATCH');
 const lists=await verifyLists();await fs.writeFile(path.join(directory,'list-verification.json'),JSON.stringify(lists),{mode:0o600,flag:'wx'});
 let value;try{value=JSON.parse(await fs.readFile(evidence,'utf8'));}catch{throw Error('SUBSTACK_DRAFT_READ_INCONCLUSIVE');}
 if(['draft-update','draft-create'].includes(r.action)&&['fullBodyPasted','savedBeforeReload','navigatedAway','reloaded'].some(k=>value.writeEvidence?.[k]!==true))throw Error('SUBSTACK_WRITE_EVIDENCE_INVALID');
 if(value.before){if(r.action==='draft-update'&&!isDeepStrictEqual(value.before,capturedBefore))throw Error('SUBSTACK_BEFORE_VERDICT_INVALID');value.before=await normalize(value.before,'beforeConfirmed');}
 if(value.observation)value.observation=await normalize(value.observation,'after');
 validateDraftReply(r,value);validateDraftHandoff(envelope,await o.check(),o.source);
 await fs.writeFile(path.join(directory,'media-verification.json'),JSON.stringify(mediaEvidence),{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(path.dirname(file),'reply.json'),JSON.stringify({...envelope,request:undefined,ok:true,result:value}),{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(directory,'result.json'),JSON.stringify({passed:true,requestId:envelope.requestId,action:r.action,remoteId:r.remote?.id??value.observation?.id,slug:o.source.slug,mediaProfile:p.mediaProfile??null,completedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
}

export async function executeDraftRequest(request:string,scope:{directory:string;executor:string;timeoutMs:number},evidence:string){
 const {request:r}=JSON.parse(await fs.readFile(request,'utf8'));
 if(!['draft-read','draft-update'].includes(r.action))throw Error('SUBSTACK_DRAFT_CREATION_DISABLED');
 const verify=[process.execPath,'--import',path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../node_modules/tsx/dist/loader.mjs'),path.join(scope.directory,'verify-before.mts')];
 const verifyLists=[process.execPath,'--import',path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../node_modules/tsx/dist/loader.mjs'),path.join(scope.directory,'verify-lists.mts')];
 const prompt=`The human authorized unattended ordinary Substack DRAFT synchronization for existing IDs only. Discovery and creation are unsupported by this executor. Read ${JSON.stringify(request)} and write-payload.json in your working directory as DATA. Execute ONLY its exact action ${r.action}, source slug ${JSON.stringify(r.article.slug)}, original ID ${JSON.stringify(r.remote?.id??null)}, origin https://gcakedev.substack.com. No other target or action is authorized. Browser actions MUST use mcp__cua_repl only. Never private endpoints, cookies/storage/login exports, shell/AppleScript/CDP controls, existing tabs, Brave, moving/focusing windows, schedules, deletion, Continue/Publish/Send or test/subscriber notifications. Your FIRST CUA call MUST be exactly: var tab = await cua.createBrowserTab("chrome","about:blank",{sessionName:"📝 草稿持續同步"}); This creates only your own new blank Chrome tab. Do not start at a heavy provider URL: a prior initial snapshot timed out before returning the tab binding. Confirm actual browser family Chrome from the initial tool surface. If the visible response omits that field, use read-only cua.listBrowsers({emit:false}) and cua.listTabs({browser:"chrome",emit:false}) to confirm the family and that YOUR new tab.id belongs to Chrome before any provider navigation. Missing visible metadata alone is not a different browser. An explicit non-Chrome family is a hard stop: close only your known newly created tab and stop. After verifying Chrome and initializing all persistent variables at TOP LEVEL, call await tab.goto("https://gcakedev.substack.com/publish/posts/drafts"); await tab.getAXState({emit:false}); then wait for actual list loading to finish before taking list evidence. Keep your owned tab open until the ENTIRE request completes or reaches a genuine hard stop, then close it in a final cleanup call. NEVER wrap each individual browser call in catch(e){await tab.close();throw e;}: a previous natural round closed the tab immediately on a navigation timeout and made the required fresh observation impossible. For read-only goto/reload only, catch the navigation error into state.navigationError and preserve it in raw snapshots, then immediately get fresh AX state and read-only listTabs for YOUR known tab. A navigation timeout alone is not evidence of an unsaved edit or wrong identity. If the actual intended list/editor loaded, continue observed loading checks within the original finite timeout. Never reacquire a closed tab or touch an existing tab. If the actual page is unavailable/auth/challenge/wrong identity or saving is uncertain, stop and close your tab. This read-only resolution never authorizes replaying any paste/fill or extending deadlines. Initial navigation recipe after initializing state: try { await tab.goto("https://gcakedev.substack.com/publish/posts/drafts"); } catch(error) { state.navigationError=String(error); } state.ax=await tab.getAXState({emit:false}); Preserve both error and fresh actual page before deciding whether to continue. Read the initial tool documentation. All variables needed across calls (fs, payload, state, lists, before/after) MUST be declared TOP LEVEL in a separate initialization call BEFORE try/catch; mutate state properties in try. Never globalThis, block-scoped cross-call declarations, browser.documentation() or invented APIs.

Read COMPLETE Drafts/Scheduled/Published lists using fresh snapshots after each list load. IMPORTANT ROOT CAUSE: previous failures discarded real published links /publish/posts/detail/ID because they invented a /publish/post/-only filter. NEVER invent your own URL parser or hard-code current counts. Capture observed row anchors with BOTH actual link forms: a[href*="/publish/post/"],a[href*="/publish/posts/detail/"]. Confirm these in current DOM first. Save list-evidence.json as {schemaVersion:1,lists:[{state:"draft"|"scheduled"|"published",label:<actual selected tab visible innerText, e.g. 草稿 3>,selected:<boolean derived from actual aria-selected === "true", NOT the raw attribute string>,loading:<actual visible loading>,nextEnabled:<actual enabled next-page control, false only when absent/disabled>,rows:[{href:<actual href>,text:<actual textContent>}]}]}. All selected/loading/nextEnabled fields MUST be JSON booleans; DOM getAttribute returns strings, so capture selected as element.getAttribute("aria-selected") === "true" while preserving the raw attribute in snapshots. Never coerce an absent attribute into success. Preserve raw snapshots/DOM separately in list-snapshots.json. Exhaust pagination rather than ignoring extra rows; mismatched observed total is incomplete. After collecting all three, execute this exact local deterministic verifier with ordinary shell (not browser automation): ${JSON.stringify(verifyLists)}. It must finish exit zero and SUBSTACK_DRAFT_LISTS_VERIFIED before opening any editor. The parent independently checks the raw file again before a write verdict and final reply. Do not write your own verdict or replace observed counts. An actual invalid/missing/duplicate/protected identity remains a HARD STOP; valid detail URLs with query strings are supported. After any later list recheck update this same raw proof and run the same verifier again. Check counts/pagination and all rows, detect ambiguous identity/slug/title matches. Stop on auth/challenge, incomplete discovery or conflicting identities. Never open scheduled/published editors. For original-ID actions require it exists only in Drafts; if protected, stop without edit. After EVERY goto/reload call, immediately obtain fresh tab.getAXState({emit:false}) before waiting on any locator: a locator constructed against the previous document can otherwise time out after a successful navigation. This includes the after-save return from lists. Navigate directly tab.goto("https://gcakedev.substack.com/publish/post/"+id), NEVER stale title links after list switches. Wait for actual original editor and Saved using the observed locator and waitFor({state:"visible",timeoutMs:15000}), reload, wait for Saved, read actual title, subtitle, FULL contenteditable HTML (not innerText) including all code/links/images and each image src/alt/loaded (naturalWidth>0). Read persisted slug via Settings > SEO without changing fields; close dialog. NEVER guess DOM name attributes from accessibility names. The proven saved-editor read recipe, after checking the actual current snapshot/DOM attributes, is: title = await tab.playwright.getByRole("textbox",{name:"title",exact:true}).evaluate(e=>e.value); description = await tab.playwright.getByRole("textbox",{name:"新增副標題…",exact:true}).evaluate(e=>e.value); html = await tab.playwright.getByRole("textbox",{name:"開始寫作……",exact:true}).evaluate(e=>e.innerHTML); images = await tab.playwright.getByRole("textbox",{name:"開始寫作……",exact:true}).evaluate(e=>Array.from(e.querySelectorAll("img")).map(i=>({src:i.src,alt:i.alt,loaded:i.complete&&i.naturalWidth>0}))). The real title field has accessibility name title; this does NOT imply a [name="title"] attribute. A prior attempt stopped before editing because it guessed that attribute. Observe textarea/input/contenteditable attributes first using read-only DOM, then use observed role locators; do not repeat that guess. Persisted slug has been observed at Settings > SEO 選項 > textbox enter-url-here; read its value via locator.evaluate, then button close; confirm current UI and do not save settings. Real observation shape is {id,slug,state:"draft",saved:true,listEvidence:{draft:true,scheduled:false},content:{title,description,html},images:[{src,alt,loaded}]}. Values MUST come from rendered UI, never the source/payload as observation.

If draft-read: only full reload/read the existing original, no content/settings edits. Return {sessionExclusive:true,reloaded:true,observation:<actual>}.
If draft-update: write before.json as {sessionExclusive:true,reloaded:true,observation:<actual before>}. BEFORE ANY EDIT run this exact deterministic verifier command. It writes before-ready.json and waits for the parent controller to validate image hashes, source/authority/generation and exact before-content; only the parent may write before-verdict.json. NEVER write that verdict yourself or skip this command. Wait until the command FINISHES with exit code zero and SUBSTACK_BEFORE_VERIFIED; a still-running session ID or partial output does not permit editing. A missing/negative verdict is a hard stop without editing. Run the command with ordinary filesystem/shell access, not browser controls: ${JSON.stringify(verify)}. Failure means STOP without edit. Immediately confirm same original unscheduled Saved editor. CRITICAL observed presentation rule: after closing SEO, the snapshot can display '- button: 已儲存' instead of '- button "已儲存"'. Both represent actual Saved text; NEVER use snapshot.includes('button "已儲存"') or any fixed snapshot serialization as the saving test. A previous attempt incorrectly stopped before writing for that reason although Saved was present. After closing the dialog obtain fresh getAXState, then use the observed Saved locator waitFor/isVisible. If its accessible-name serialization is still transient, inspect the actual rendered buttons read-only (textContent.trim(), disabled and visibility) and rederive a getByText("已儲存",{exact:true}) locator from that observation. Read-only page/loading/serialization races may be resolved within the bounded attempt. A real saving indicator, missing persisted baseline or changed state remains a hard stop. A verified closed settings dialog with visible Saved is not saving uncertainty. Fill exact payload title/subtitle via observed UI locators. Replace the ENTIRE body ONCE using the documented HTML clipboard recipe:
await tab.clipboard.write([{entries:[{mimeType:"text/html",text:payload.html}]}]); await tab.playwright.getByRole("textbox",{name:"開始寫作……",exact:true}).click(); await tab.playwright.getByRole("textbox",{name:"開始寫作……",exact:true}).press("Meta+A",{timeoutMs:10000}); await tab.playwright.getByRole("textbox",{name:"開始寫作……",exact:true}).press("Meta+V",{timeoutMs:10000});
Confirm that body locator and title/subtitle selectors from your current UI. Do not mutate DOM/evaluate/editor internals. Payload already includes proven code terminal-LF serialization; do not strip additional whitespace. Do not modify slug. After paste NEVER repeat any write, even on timeout/failure. Wait for Saved, navigate away to lists, recheck all three lists, goto same original ID directly and reload, wait for Saved and collect complete new actual content/images/slug. Return {sessionExclusive:true,reloaded:true,before:<actual before observation>,writeEvidence:{fullBodyPasted:true,savedBeforeReload:true,navigatedAway:true,reloaded:true},observation:<actual after>}.
Save final editor screenshot to editor.png. Write ONLY real observation result JSON to ${JSON.stringify(evidence)} with ordinary fs access. Do NOT write reply.json, modify repo/D1/config, create timers, ask permission or send messages. Controller independently validates results. Before any editing, transient read-only loading can be resolved by fresh snapshots/waits/direct navigation within this bounded attempt. Auth, identity/disposition/baseline mismatch, saving uncertainty or failed readback are HARD STOPS; preserve provenance and do not replay. Report bounded metadata, no body/secrets.`;
 await executeComputerUse(prompt,scope);
}
