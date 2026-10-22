import {createHash,randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import type {PublicationTargetState} from '../../apps/admin-worker/src/publication-operations';
import type {DistributionRuntime} from '../../apps/admin-worker/src/distribution-runtime';
import {SCHEDULE_POLICY,ScheduleRepository,type ScheduleRecord,type ConfirmedSlot,type ScheduleOperation} from '../../apps/admin-worker/src/substack-schedules';
import type {ScheduledSource} from './scheduled-source';
import {renderedArticle} from './substack-browser';
export {SCHEDULE_POLICY};
export interface ScheduleContent {title:string;description?:string;html:string}
export interface ScheduleObservation {id:string;slug:string;state:'draft'|'scheduled'|'published'|'sending';saved:boolean;listEvidence?:{draft:boolean;scheduled:boolean};content:ScheduleContent;scheduledAt?:string;timeZone?:string;email?:boolean;appInbox?:boolean;audience?:string;images?:{src:string;alt:string;loaded:boolean}[];canonical?:string;publishedAt?:string}
export interface ScheduleProvider {
 find(source:ScheduledSource):Promise<{complete:boolean;scanned:string[];items:ScheduleObservation[]}>;
 read(id:string):Promise<ScheduleObservation>;create(source:ScheduledSource):Promise<string>;
 update(id:string,source:ScheduledSource,published:boolean):Promise<void>;arm(id:string,time:string):Promise<void>;remove(id:string):Promise<void>;
}
export interface ScheduleRequest {policyVersion:typeof SCHEDULE_POLICY;scheduleId:string;slug:string;operation:ScheduleOperation;source?:ScheduledSource;slot?:ConfirmedSlot;remoteId?:string;previousSlug?:string;timeZone?:string;approval?:{version:1;approved:true;digest:string}}
export interface ScheduleContext {readSource():Promise<ScheduledSource|undefined>;readSlot():Promise<ConfirmedSlot|undefined>;readPublic(id:string,url:string):Promise<ScheduleObservation>;now():string;readOriginalSite?(source:ScheduledSource):Promise<NonNullable<ScheduleRecord['originalSite']>>;legacyIdentity?():Promise<PublicationTargetState|undefined>}
const hash=(x:unknown)=>'sha256:'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
export function contentFingerprint(content:ScheduleContent):string{
 if(typeof content?.html!=='string'||typeof content.title!=='string')throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');
 const {document}=parseHTML('<html><body>'+content.html+'</body></html>');
 const blocks=new Set(['P','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','HR','TABLE','TR','TH','TD']);
 const semantic=new Set(['P','H1','H2','H3','H4','H5','H6','UL','OL','LI','PRE','CODE','BLOCKQUOTE','HR','BR','TABLE','TR','TH','TD','STRONG','EM','DEL','A','IMG']);
 function visit(node:Node,code=false):unknown[]{if(node.nodeType===3){const t=node.textContent??'';return [code?t:t.replace(/\s+/g,' ')];}if(node.nodeType!==1)return [];const e=node as Element;if(['SCRIPT','STYLE','IFRAME'].includes(e.tagName))throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');const pre=code||e.tagName==='PRE'||e.tagName==='CODE';const children=Array.from(e.childNodes).flatMap(n=>visit(n,pre));
 // Collapse ordinary whitespace, preserving spaces at inline boundaries. Only block edges are insignificant.
 if(!pre&&blocks.has(e.tagName)){if(typeof children[0]==='string')children[0]=(children[0] as string).trimStart();const last=children.length-1;if(typeof children[last]==='string')children[last]=(children[last] as string).trimEnd();}

 // The saved editor wraps each simple list item in one paragraph and may nest code marks.
 // Ignore only those observed wrappers; multiple list paragraphs remain distinct.
 if(e.tagName==='P'&&e.parentElement?.tagName==='LI'&&e.parentElement.childNodes.length===1)return children;
 if(e.tagName==='CODE'&&e.parentElement?.tagName==='CODE')return children;
 // A fence renderer terminates code with one LF; retain extra blank lines and all inner spacing.
 if(e.tagName==='CODE'&&e.parentElement?.tagName==='PRE'&&typeof children[children.length-1]==='string')children[children.length-1]=(children[children.length-1] as string).replace(/\n$/,'');
 if(!semantic.has(e.tagName))return children;
 const attrs:Record<string,string>={};for(const a of ['href','src','alt','start'])if(e.hasAttribute(a))attrs[a]=e.getAttribute(a)!;
 const cleaned=pre?children:children.filter((c,i)=>{if(c==='')return false;if(typeof c==='string'&&!c.trim()){const adjacent=[children[i-1],children[i+1]];if(adjacent.some(n=>Array.isArray(n)&&blocks.has(n[0] as string)))return false;}return true;});return [[e.tagName,attrs,cleaned]];}
 return hash({title:norm(content.title),description:content.description===undefined?undefined:norm(content.description),tree:Array.from(document.body.childNodes).flatMap(n=>visit(n)).filter(x=>typeof x!=='string'||x.trim())});
}

// Attention ignores only observed editor presentation; strict save/readback fingerprints stay unchanged.
function attentionContentFingerprint(content:ScheduleContent):string{
 const {document}=parseHTML('<html><body>'+content.html+'</body></html>');
 for(const code of document.querySelectorAll('pre > code')){
  const last=code.lastElementChild;
  if(last?.tagName==='BR'&&last.classList.contains('ProseMirror-trailingBreak')&&last.previousElementSibling?.tagName==='CODE')last.remove();
  let end:Node|null=code.lastChild;while(end?.nodeType===1&&(end as Element).tagName==='CODE')end=end.lastChild;
  // The anonymous renderer represents one terminal empty editor line as LF + one space.
  if(end?.nodeType===3)end.textContent=(end.textContent??'').replace(/\n $/,'\n');
 }
 return contentFingerprint({...content,description:undefined,html:document.body.innerHTML});
}

export function assertScheduleMedia(e:ScheduleObservation){
 const {document}=parseHTML('<html><body>'+e.content.html+'</body></html>');const images=Array.from(document.querySelectorAll('img')).map(i=>({src:i.getAttribute('src')??'',alt:i.getAttribute('alt')??''}));
 const sorted=(items:{src:string;alt:string}[])=>JSON.stringify(items.map(i=>[i.src,i.alt]).sort());
 if(images.length&&(!e.images||e.images.some(i=>i.loaded!==true)||sorted(images)!==sorted(e.images)))throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');
}
export function compareScheduleContent(actual:ScheduleContent,expected:ScheduleContent){
 const differences:string[]=[];
 if(norm(actual.title)!==norm(expected.title))differences.push('title');
 if(norm(actual.description??'')!==norm(expected.description??''))differences.push('description');
 if(contentFingerprint({title:'',html:actual.html})!==contentFingerprint({title:'',html:expected.html}))differences.push('body-structure-links-images');
 return differences;
}
export const expectedContent=(s:ScheduledSource):ScheduleContent=>({title:s.article.title,description:s.article.description,html:renderedArticle(s.article).html});
export function makeScheduleApproval(r:ScheduleRequest){return {version:1 as const,approved:true as const,digest:hash({policyVersion:r.policyVersion,scheduleId:r.scheduleId,slug:r.slug,operation:r.operation,source:r.source,remoteId:r.remoteId,previousSlug:r.previousSlug,slot:r.slot,timeZone:r.timeZone??'Asia/Taipei',audience:'everyone',email:true,appInbox:true})};}
const publicState=(e:ScheduleObservation)=>e.state==='published'||e.state==='sending';
const minute=(s:string)=>new Date(Math.floor(Date.parse(s)/60000)*60000).toISOString();
const publicUrl=(slug:string)=>'https://gcakedev.substack.com/p/'+slug;
// A legacy publicationMinute is already verified actual evidence, unlike observedTime.
const publicationTimeChanged=(state:ScheduleRecord,actual:string)=>state.publicationEvidence?Date.parse(actual)!==Date.parse(state.publicationEvidence.actualAt):!!state.publicationMinute&&minute(actual)!==minute(state.publicationMinute);
export function validateScheduleTime(slot:ConfirmedSlot|undefined,slug:string,now:string,zone='Asia/Taipei'){
 if(!slot?.confirmed||slot.slug!==slug||!slot.reservationId||!Number.isSafeInteger(slot.queueVersion)||slot.queueVersion<0)throw Error('SUBSTACK_SCHEDULE_SLOT_UNCONFIRMED');
 if(zone!=='Asia/Taipei')throw Error('SUBSTACK_SCHEDULE_TIMEZONE_MISMATCH');
 const when=Date.parse(slot.scheduledAt),current=Date.parse(now),local=new Date(current+28800000);const day=local.getUTCDate();local.setUTCDate(1);local.setUTCMonth(local.getUTCMonth()+3);const last=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,0)).getUTCDate();local.setUTCDate(Math.min(day,last));const horizon=local.getTime()-28800000;
 if(!Number.isFinite(current)||!Number.isFinite(when)||!/(Z|\+08:00)$/.test(slot.scheduledAt)||when<=current||when>horizon||when%60000!==0)throw Error('SUBSTACK_SCHEDULE_TIME_INVALID');
}
export function validateScheduleCommitment(expected:ConfirmedSlot|undefined,current:ConfirmedSlot|undefined,slug:string,now:string,zone='Asia/Taipei'){
 validateScheduleTime(expected,slug,now,zone);if(JSON.stringify(current)!==JSON.stringify(expected))throw Error('SUBSTACK_SCHEDULE_SLOT_UNCONFIRMED');
}
export class ScheduleCoordinator {
 constructor(readonly repo:ScheduleRepository,readonly runtime:DistributionRuntime,readonly provider:ScheduleProvider,readonly context:ScheduleContext){}
 private async latest(r:ScheduleRequest){const s=await this.context.readSource();if(!s||!r.source||s.sourceCommit!==r.source.sourceCommit||s.sourceRevision!==r.source.sourceRevision||s.slug!==r.slug)throw Error('SUBSTACK_SOURCE_CHANGED');return s;}
 private async slot(r:ScheduleRequest){validateScheduleCommitment(r.slot,await this.context.readSlot(),r.slug,this.context.now(),r.timeZone);}
 private readValid(e:ScheduleObservation,id:string,verifyMedia=true){if(!e||e.id!==id||!/^\d+$/.test(e.id)||!['draft','scheduled','published','sending'].includes(e.state)||e.saved!==true)throw Error('SUBSTACK_CONTENT_EVIDENCE_INVALID');contentFingerprint(e.content);if(verifyMedia)assertScheduleMedia(e);return e;}
 async run(r:ScheduleRequest):Promise<ScheduleRecord>{
  if(r.policyVersion!==SCHEDULE_POLICY||!r.scheduleId||!['prepare-draft','arm-schedule','revise-schedule','postpone-schedule','cancel-schedule','reconcile-schedule','sync-content'].includes(r.operation)||!r.approval?.approved||r.approval.version!==1||r.approval.digest!==makeScheduleApproval(r).digest)throw Error('SUBSTACK_SCHEDULE_APPROVAL_REQUIRED');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||r.source&&r.source.slug!==r.slug)throw Error('SUBSTACK_SOURCE_INVALID');
  if(['arm-schedule','revise-schedule','postpone-schedule'].includes(r.operation))await this.slot(r);
  const owner=randomUUID(),locks=[...new Set([r.slug,...(r.previousSlug?[r.previousSlug]:[])])].sort(),acquired:string[]=[];for(const slug of locks){if(!await this.runtime.acquire(slug,'substack',owner,this.context.now())){for(const held of acquired)await this.runtime.release(held,'substack',owner);throw Error('SUBSTACK_SCHEDULE_LOCKED');}acquired.push(slug);}
  let state:ScheduleRecord|undefined;
  try{
   if(await this.runtime.checkpoint(r.slug,'substack'))throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
   state=await this.repo.get(r.scheduleId);
   if(state&&state.slug!==r.slug&&(r.previousSlug!==state.slug||!r.remoteId||r.remoteId!==state.remoteId||!['sync-content','revise-schedule'].includes(r.operation)))throw Error('SUBSTACK_SOURCE_RENAME_MAPPING_REQUIRED');
   if(r.previousSlug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.previousSlug))throw Error('SUBSTACK_SOURCE_INVALID');
   if(!state&&await this.repo.bySlug(r.slug))throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');
   if(state?.remoteId&&r.remoteId!==state.remoteId)throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');
   if(state?.intent&&r.operation!=='reconcile-schedule')throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
   const write=async(patch:Partial<ScheduleRecord>)=>{state=await this.repo.save({...state!,...patch,...(Object.hasOwn(patch,'pendingAction')&&patch.pendingAction===undefined?{lastErrorCode:undefined}:{}),updatedAt:this.context.now()},state!.version);return state;};
   if(!state){const legacy=await this.context.legacyIdentity?.();if(legacy?.remoteId&&r.remoteId&&legacy.remoteId!==r.remoteId)throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');state={remoteId:legacy?.remoteId??r.remoteId,legacyNewsletterSentAt:legacy?.newsletterSentAt,legacyPublished:legacy&&(['verified','published'].includes(legacy.status)||!!legacy.newsletterSentAt||/^https:\/\/gcakedev\.substack\.com\/p\//.test(legacy.remoteUrl??''))||undefined,policyVersion:SCHEDULE_POLICY,scheduleId:r.scheduleId,slug:r.slug,sourcePath:r.source?.sourcePath,sourceCommit:r.source?.sourceCommit,sourceRevision:r.source?.sourceRevision,version:0,observedState:'draft_prepared',delivery:'not_armed',updatedAt:this.context.now()};await write({});}
   const intent=async(action:NonNullable<ScheduleRecord['intent']>['action'])=>write({intent:{id:randomUUID(),action,policyVersion:SCHEDULE_POLICY,expectedGeneration:state!.version+1,audience:'everyone',email:action==='arm',appInbox:action==='arm',sourceRevision:r.source?.sourceRevision,expectedDigest:r.source?contentFingerprint(expectedContent(r.source)):state!.contentDigest,scheduledAt:r.slot?.scheduledAt,slot:r.slot,createdAt:this.context.now()}});
   const valid=(e:ScheduleObservation,id:string)=>this.readValid(e,id,r.operation!=='cancel-schedule'&&!(r.operation==='reconcile-schedule'&&state?.intent?.action==='remove'));
   let observed:ScheduleObservation;
   if(state.remoteId)observed=valid(await this.provider.read(state.remoteId),state.remoteId);
   else{
    const s=await this.latest(r);const found=await this.provider.find(s);
    if(!found.complete||!['draft','published','scheduled'].every(x=>found.scanned.includes(x))||found.items.length>1)throw Error('SUBSTACK_REMOTE_SCAN_INCOMPLETE');
    if(found.items.length){observed=valid(found.items[0],found.items[0].id);if(observed.slug!==r.slug)throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');await write({remoteId:observed.id});}
    else{
     if(state.intent||r.operation!=='prepare-draft')throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
     await this.latest(r);await intent('create');const id=await this.provider.create(s);if(!/^\d+$/.test(id))throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');await write({remoteId:id});observed=valid(await this.provider.read(id),id);await write({intent:undefined});
    }
   }
   const id=state.remoteId!;if(publicState(observed))await write({everPublished:true});if((state.legacyPublished||state.everPublished||state.publicationMinute)&&!publicState(observed))throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
   const read=async()=>valid(await this.provider.read(id),id);
   const checkSlug=()=>{if(observed.slug!==r.slug)throw Error('SUBSTACK_SLUG_CONFLICT');};
   const scheduledMatches=(e:ScheduleObservation,time:string|undefined)=>e.state==='scheduled'&&e.listEvidence?.scheduled===true&&e.listEvidence.draft===false&&!!time&&Date.parse(e.scheduledAt??'')===Date.parse(time)&&e.timeZone==='Asia/Taipei'&&e.email===true&&e.appInbox===true&&e.audience==='everyone';
   const cancelledPatch={desiredState:'cancelled' as const,delivery:'not_armed' as const,emailEnabled:false,appInboxEnabled:false,observedState:'cancelled_draft' as const,intent:undefined,pendingAction:undefined};
   if(r.operation==='reconcile-schedule'){
    const cp=state.intent;
    if(cp&&publicState(observed)&&['arm','update-public'].includes(cp.action)){
     checkSlug();const date=cp.action==='arm'?cp.scheduledAt:state.publicationMinute??observed.publishedAt;
     const e=valid(await this.context.readPublic(id,publicUrl(state.slug)),id);
     if(e.state!=='published'||e.slug!==state.slug||e.canonical!==publicUrl(state.slug)||!date||!Number.isFinite(Date.parse(date))||!e.publishedAt||!Number.isFinite(Date.parse(e.publishedAt))||publicationTimeChanged(state,e.publishedAt)||contentFingerprint(e.content)!==cp.expectedDigest)throw Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');
     const changed=!r.source||r.source.sourceRevision!==cp.sourceRevision,actualAt=new Date(Date.parse(e.publishedAt!)).toISOString(),confirmedAt=cp.action==='arm'?cp.scheduledAt:state.observedTime;
     return await write({publicationEvidence:{title:e.content.title,actualAt,...(confirmedAt?{confirmedAt,differenceSeconds:(Date.parse(actualAt)-Date.parse(confirmedAt))/1000}:{})},verification:{status:'verified',checkedAt:this.context.now()},intent:undefined,observedState:'verified',...(cp.action==='arm'?{armedRevision:cp.sourceRevision,slot:cp.slot,observedTime:cp.scheduledAt}:{}),publicationMinute:minute(actualAt),deliveredRevision:state.deliveredRevision??(cp.action==='arm'?cp.sourceRevision:state.armedRevision),delivery:state.delivery==='not_armed'&&cp.action!=='arm'?'not_armed':'unknown',contentDigest:cp.expectedDigest,contentVerifiedRevision:cp.sourceRevision,sourceRevision:cp.sourceRevision,pendingAction:changed?'sync-content':undefined,lastErrorCode:undefined,verifiedAt:this.context.now()});
    }
    if(cp?.action==='remove'&&publicState(observed)){await write({delivery:state.delivery==='not_armed'?'not_armed':'unknown',deliveredRevision:state.deliveredRevision??state.armedRevision});throw Error('SUBSTACK_SCHEDULE_TOO_LATE');}
    if(cp){const matches=cp.action==='remove'?observed.state==='draft'&&observed.listEvidence?.draft===true&&observed.listEvidence.scheduled===false:cp.action==='arm'?scheduledMatches(observed,cp.scheduledAt):cp.action==='create'?!!id:contentFingerprint(observed.content)===cp.expectedDigest;
     if(cp.action==='arm'&&contentFingerprint(observed.content)!==cp.expectedDigest)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
     if(!matches)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');}
    checkSlug();const wantsCancellation=state.desiredState==='cancelled'&&cp?.action!=='arm';const contentCurrent=!!r.source&&contentFingerprint(observed.content)===contentFingerprint(expectedContent(r.source));
    if(wantsCancellation&&observed.state==='draft'){
     if(observed.listEvidence?.draft!==true||observed.listEvidence.scheduled!==false)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');
     return await write({...cancelledPatch,contentDigest:contentFingerprint(observed.content),pendingAction:r.source&&!contentCurrent?'sync-content':undefined});
    }
    return await write({intent:undefined,...(cp?.action==='remove'?{delivery:'not_armed',emailEnabled:false,appInboxEnabled:false}:{}),observedState:publicState(observed)?'published_unverified':observed.state==='scheduled'?'scheduled':'draft_prepared',observedTime:observed.scheduledAt??state.observedTime,contentDigest:contentFingerprint(observed.content),...(cp?.action==='arm'?{armedRevision:cp.sourceRevision,slot:cp.slot,delivery:'armed',timeZone:'Asia/Taipei',audience:'everyone',emailEnabled:true,appInboxEnabled:true,desiredState:'scheduled',desiredTime:cp.scheduledAt}:{}),pendingAction:wantsCancellation&&observed.state==='scheduled'?'cancel-schedule':contentCurrent?undefined:!r.source&&observed.state==='scheduled'?'cancel-schedule':'sync-content',lastErrorCode:undefined});
   }
   const tooLate=async()=>{if(publicState(observed)){await write({observedState:'published_unverified',delivery:state!.delivery==='not_armed'?'not_armed':'unknown',deliveredRevision:state!.deliveredRevision??state!.armedRevision});throw Error('SUBSTACK_SCHEDULE_TOO_LATE');}};
   const remove=async()=>{await tooLate();if(observed.state==='scheduled'){const oldContent=contentFingerprint(observed.content),oldSlug=observed.slug;await intent('remove');await this.provider.remove(id);observed=await read();if(observed.state!=='draft'||observed.listEvidence?.draft!==true||observed.listEvidence.scheduled!==false)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');// Cancellation clears its intent only together with the final cancelled disposition.
    if(r.operation!=='cancel-schedule')await write({intent:undefined,observedState:'draft_prepared',delivery:'not_armed',emailEnabled:false,appInboxEnabled:false});if(r.operation!=='cancel-schedule'&&(contentFingerprint(observed.content)!==oldContent||observed.slug!==oldSlug))throw Error('SUBSTACK_REMOTE_CONTENT_CHANGED');}};
   if(state.slug!==r.slug){if(await this.repo.bySlug(r.slug))throw Error('SUBSTACK_SCHEDULE_IDENTITY_CONFLICT');await write({slug:r.slug,previousSlugs:[...(state.previousSlugs??[]),state.slug]});}
   if(r.operation==='cancel-schedule'){await write({desiredState:'cancelled'});await remove();if(observed.state!=='draft'||observed.listEvidence?.draft!==true||observed.listEvidence.scheduled!==false)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');return await write(cancelledPatch);}
   if(observed.state==='sending')await tooLate();
   await this.latest(r);
   const expected=contentFingerprint(expectedContent(r.source!)),same=contentFingerprint(observed.content)===expected&&observed.slug===r.slug;
   const rearm=observed.state==='scheduled';
   const comparison={sourceRevision:r.source!.sourceRevision,observedDigest:contentFingerprint(observed.content),expectedDigest:expected,mode:publicState(observed)?'public' as const:rearm?'scheduled' as const:'draft' as const,differences:[...compareScheduleContent(observed.content,expectedContent(r.source!)),...(observed.slug!==r.slug?['slug']:[])],result:same?'verified-no-change' as const:'pending-edit' as const};
   await write({desiredRevision:r.source!.sourceRevision,lastComparison:comparison});
   const saveArmed=()=>write({intent:undefined,slot:r.slot,observedState:'scheduled',desiredState:'scheduled',observedTime:new Date(Date.parse(r.slot!.scheduledAt)).toISOString(),sourceCommit:r.source!.sourceCommit,sourcePath:r.source!.sourcePath,desiredTime:r.slot!.scheduledAt,armedRevision:r.source!.sourceRevision,contentDigest:expected,observedRevision:r.source!.sourceRevision,sourceRevision:r.source!.sourceRevision,contentVerifiedRevision:r.source!.sourceRevision,lastComparison:{...comparison,result:same?'verified-no-change':'verified-edit'},delivery:'armed',timeZone:'Asia/Taipei',audience:'everyone',emailEnabled:true,appInboxEnabled:true,pendingAction:undefined});
   if(['arm-schedule','postpone-schedule'].includes(r.operation)){
    await tooLate();checkSlug();if(!same)throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');
    if(scheduledMatches(observed,r.slot!.scheduledAt)){await this.slot(r);return await saveArmed();}
    await remove();
   }else if(!same){
    // The comparison is checked again before any mutation, never from a cached digest.
    const before=hash(observed),fresh=await read();if(hash(fresh)!==before)throw Error('SUBSTACK_REMOTE_CONTENT_CHANGED');await this.latest(r);observed=fresh;
    if(rearm){await this.slot(r);await remove();}
    if(r.operation==='prepare-draft'&&publicState(observed)){checkSlug();return await write({observedState:'published_unverified',contentDigest:contentFingerprint(observed.content),pendingAction:'sync-content'});}
    await this.latest(r);await intent(publicState(observed)?'update-public':'update-draft');const published=publicState(observed);const oldDate=observed.publishedAt;await this.provider.update(id,r.source!,published);observed=await read();checkSlug();if(contentFingerprint(observed.content)!==expected||published&&(!publicState(observed)||observed.publishedAt!==oldDate))throw Error('SUBSTACK_CONTENT_EVIDENCE_MISMATCH');await this.latest(r);
    await write({intent:undefined,lastComparison:{...comparison,result:'verified-edit'},contentDigest:expected,observedRevision:r.source!.sourceRevision,sourceCommit:r.source!.sourceCommit,sourceRevision:r.source!.sourceRevision,pendingAction:undefined});
   }
   checkSlug();await this.latest(r);
   if(publicState(observed)){
    const result=await this.verifyPublic(state,r.source!,state.publicationMinute??state.observedTime??observed.publishedAt!);return await write({...result,intent:undefined,pendingAction:undefined});
   }
   const shouldArm=['arm-schedule','postpone-schedule','revise-schedule'].includes(r.operation)||rearm&&!same;
   if(shouldArm){await this.slot(r);if(observed.state==='scheduled'){if(scheduledMatches(observed,r.slot!.scheduledAt))return await saveArmed();await remove();}
    if(observed.timeZone!=='Asia/Taipei')throw Error('SUBSTACK_SCHEDULE_TIMEZONE_MISMATCH');await this.latest(r);await intent('arm');await this.provider.arm(id,r.slot!.scheduledAt);observed=await read();checkSlug();if(!scheduledMatches(observed,r.slot!.scheduledAt)||contentFingerprint(observed.content)!==expected)throw Error('SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED');await this.latest(r);await this.slot(r);
    return await saveArmed();
   }
   return await write({...(rearm?{observedTime:observed.scheduledAt,timeZone:observed.timeZone as 'Asia/Taipei',audience:observed.audience as 'everyone',emailEnabled:observed.email,appInboxEnabled:observed.appInbox,delivery:observed.email||observed.appInbox?'armed' as const:'not_armed' as const}:{}),lastComparison:{...comparison,result:same?'verified-no-change':'verified-edit'},contentDigest:expected,contentVerifiedRevision:r.source!.sourceRevision,observedRevision:r.source!.sourceRevision,sourceRevision:r.source!.sourceRevision,observedState:rearm?'scheduled':state.observedState==='cancelled_draft'?'cancelled_draft':'draft_prepared',pendingAction:undefined});
  }catch(error){const code=error instanceof Error&&/^SUBSTACK_[A-Z_]+$/.test(error.message)?error.message:'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED';if(state){state=await this.repo.save({...state,observedState:state.intent?'reconciliation_required':state.observedState,pendingAction:code==='SUBSTACK_SCHEDULE_TOO_LATE'?'reconcile-schedule':'sync-content',lastErrorCode:code,updatedAt:this.context.now()},state.version);}throw Error(code);
  }finally{for(const slug of acquired)await this.runtime.release(slug,'substack',owner);}
 }
 private async verifyPublic(state:ScheduleRecord,source:ScheduledSource,date:string,evidence?:ScheduleObservation):Promise<Partial<ScheduleRecord>>{
  const e=evidence??await this.context.readPublic(state.remoteId!,publicUrl(state.slug));this.readValid(e,state.remoteId!);
  if(e.state!=='published'||e.slug!==state.slug||e.canonical!==publicUrl(state.slug)||!e.publishedAt||!date||!Number.isFinite(Date.parse(date))||!Number.isFinite(Date.parse(e.publishedAt))||publicationTimeChanged(state,e.publishedAt)||contentFingerprint(e.content)!==contentFingerprint(expectedContent(source)))throw Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');
  let originalSite:NonNullable<ScheduleRecord['originalSite']>={status:'not_checked'};try{originalSite=await this.context.readOriginalSite?.(source)??originalSite;}catch{originalSite={status:'unavailable'};}
  const actualAt=new Date(Date.parse(e.publishedAt!)).toISOString(),confirmedAt=state.observedTime;
  return {publicationEvidence:{title:source.article.title,actualAt,...(confirmedAt?{confirmedAt,differenceSeconds:(Date.parse(actualAt)-Date.parse(confirmedAt))/1000}:{})},...(state.draftSync?.status==='foreground-required'&&!state.intent?{draftSync:{...state.draftSync,status:'excluded',code:undefined,desiredRevision:source.sourceRevision,checkedAt:this.context.now()}}:{}),verification:{status:'verified',checkedAt:this.context.now()},originalSite:{...originalSite,dateDiffersFromSubstack:!!source.article.publishedAt&&minute(source.article.publishedAt)!==minute(actualAt)},observedState:'verified',contentVerifiedRevision:source.sourceRevision,sourceRevision:source.sourceRevision,sourceCommit:source.sourceCommit,contentDigest:contentFingerprint(e.content),publicationMinute:minute(actualAt),deliveredRevision:state.deliveredRevision??state.armedRevision,delivery:state.delivery==='not_armed'?'not_armed':'unknown',verifiedAt:this.context.now()};
 }
 private async observePublic(state:ScheduleRecord,source:ScheduledSource,now:string,legacyVerificationHold:boolean):Promise<Partial<ScheduleRecord>>{
  const inconclusive=(code:string):Partial<ScheduleRecord>=>({verification:{status:'inconclusive',checkedAt:now,code}});
  let e:ScheduleObservation;
  try{e=await this.context.readPublic(state.remoteId!,publicUrl(state.slug));}
  catch{return inconclusive('SUBSTACK_PUBLIC_READ_INCOMPLETE');}
  if(e?.id&&e.id!==state.remoteId)return {pendingAction:'sync-content',lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_MISMATCH',verification:{status:'identity_difference',checkedAt:now}};
  try{this.readValid(e,state.remoteId!);}catch{return inconclusive('SUBSTACK_PUBLIC_READ_INCOMPLETE');}
  const date=state.publicationMinute??state.observedTime;
  if(e.state!=='published'||e.slug!==state.slug||e.canonical!==publicUrl(state.slug))return {pendingAction:'sync-content',lastErrorCode:'SUBSTACK_PUBLIC_IDENTITY_MISMATCH',verification:{status:'identity_difference',checkedAt:now}};
  if(!date||!Number.isFinite(Date.parse(date))||!e.publishedAt||!Number.isFinite(Date.parse(e.publishedAt)))return inconclusive('SUBSTACK_PUBLICATION_TIME_UNCONFIRMED');
  if(publicationTimeChanged(state,e.publishedAt))return {pendingAction:'sync-content',lastErrorCode:'SUBSTACK_PUBLICATION_TIME_CHANGED',verification:{status:'time_difference',checkedAt:now}};
  const expected=expectedContent(source);
  try{
   if(attentionContentFingerprint(e.content)!==attentionContentFingerprint(expected))return {pendingAction:'sync-content',lastErrorCode:'SUBSTACK_CONTENT_EVIDENCE_MISMATCH',verification:{status:'content_difference',checkedAt:now}};
  }catch{return inconclusive('SUBSTACK_PUBLIC_READ_INCOMPLETE');}
  const clearFalseHold=legacyVerificationHold?{pendingAction:undefined,lastErrorCode:undefined}:{};
  // A description/presentation-only result does not promote the full verified revision/digest.
  if(contentFingerprint(e.content)!==contentFingerprint(expected))return {...clearFalseHold,verification:{status:'presentation_only',checkedAt:now}};
  return {...await this.verifyPublic(state,source,date,e),...clearFalseHold};
 }
 async observe(id:string,source:ScheduledSource|undefined,slot:ConfirmedSlot|undefined,now:string):Promise<ScheduleRecord>{
  let state=await this.repo.get(id);if(!state)throw Error('SUBSTACK_SCHEDULE_RECORD_MISSING');const owner=randomUUID();if(!await this.runtime.acquire(state.slug,'substack',owner,now))return state;
  try{state=(await this.repo.get(id))!;
   const legacyVerificationHold=['SUBSTACK_PUBLIC_EVIDENCE_MISMATCH','SUBSTACK_PUBLIC_IDENTITY_MISMATCH'].includes(state.lastErrorCode??'')&&state.pendingAction==='sync-content';
   if(state.intent||state.lastErrorCode&&!legacyVerificationHold)return state;
   let patch:Partial<ScheduleRecord>={};
   if(state.observedState==='cancelled_draft'&&!source)patch={};
   else if(!source)patch={pendingAction:state.observedState==='scheduled'?'cancel-schedule':'sync-content',desiredState:state.observedState==='scheduled'?'cancelled':state.desiredState};
   else if(source.slug!==state.slug||source.sourceRevision!==(state.contentVerifiedRevision??state.sourceRevision)&&contentFingerprint(expectedContent(source))!==state.contentDigest)patch={pendingAction:'sync-content',desiredRevision:source.sourceRevision,verification:{status:'content_difference',checkedAt:now},lastErrorCode:undefined};
   else if(state.observedState==='scheduled'&&(!state.observedTime||Date.parse(now)<Date.parse(state.observedTime))){
    // Queue revisions do not change an already armed provider's article or actual instant.
    // Foreground validateScheduleCommitment deliberately keeps its exact version check.
    const sameTime=slot?.confirmed===true&&slot.slug===state.slug&&Number.isFinite(Date.parse(slot.scheduledAt))&&Date.parse(slot.scheduledAt)===Date.parse(state.observedTime??'');
    if(!sameTime)patch={pendingAction:slot?'postpone-schedule':'cancel-schedule',desiredTime:slot?.scheduledAt};
    else if(state.pendingAction==='postpone-schedule')patch={pendingAction:undefined,desiredTime:slot!.scheduledAt};
   }
   else if(state.observedState!=='cancelled_draft'&&state.remoteId&&(state.observedState==='verified'||state.observedState==='published_unverified'||state.observedTime&&Date.parse(now)>=Date.parse(state.observedTime)))patch=await this.observePublic(state,source,now,legacyVerificationHold);
   return await this.repo.save({...state,...patch,updatedAt:now},state.version);
  }finally{await this.runtime.release(state.slug,'substack',owner);}
 }
}
