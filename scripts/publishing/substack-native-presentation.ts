import {parseHTML} from 'linkedom';
import type {ScheduledSource} from './scheduled-source';
import type {ScheduleObservation} from './substack-schedule';
import {contentFingerprint,expectedContent} from './substack-schedule';
import type {ScheduleRecord} from '../../apps/admin-worker/src/substack-schedules';
import {prepareDraftSource,normalizeDraftObservation} from './substack-draft-media';
/** Owner-approved native representation: retain every table cell under its original header. */
export function projectTableRows(html:string){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');
 for(const table of document.querySelectorAll('table')){
  const headers=Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent??'');
  if(headers.length<2||table.querySelector('[colspan],[rowspan]'))throw Error('SUBSTACK_UNSUPPORTED_CONTENT');
  const heading=document.createElement('p'),strong=document.createElement('strong');strong.textContent=headers.join('｜');heading.append(strong);
  const list=document.createElement('ul');
  for(const row of table.querySelectorAll('tbody tr')){
   const cells=Array.from(row.querySelectorAll('td'));if(cells.length!==headers.length)throw Error('SUBSTACK_UNSUPPORTED_CONTENT');
   const li=document.createElement('li'),p=document.createElement('p'),lead=document.createElement('strong');lead.innerHTML=cells[0].innerHTML;p.append(lead);
   for(let i=1;i<cells.length;i++){p.append(document.createElement('br'));const label=document.createElement('strong');label.textContent=headers[i]+'：';p.append(label);const span=document.createElement('span');span.innerHTML=cells[i].innerHTML;p.append(span);}
   li.append(p);list.append(li);
  }
  table.replaceWith(heading,list);
 }
 return document.body.innerHTML;
}
function withoutImageViewer(html:string){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');
 for(const img of document.querySelectorAll('img')){const a=img.closest('a');if(a?.classList.contains('image-link')&&a.querySelectorAll('img').length===1&&!a.textContent?.trim())a.replaceWith(img);const p=img.parentElement;if(p?.tagName==='P'&&Array.from(p.childNodes).every(n=>n===img||n.nodeType===3&&!n.textContent?.trim()))p.replaceWith(img);}
 return document.body.innerHTML;
}
/** This is explicit per-original presentation evidence, never permission to ignore text/media drift. */
export async function verifyApprovedPresentation(approval:ScheduleRecord['approvedPresentation']|undefined,source:ScheduledSource,actual:ScheduleObservation,fetcher:typeof fetch=fetch){
 if(!approval||approval.version!==1||approval.profile!=='table-rows-labelled-lists-original-png-v1'||approval.sourceRevision!==source.sourceRevision||approval.remoteId!==actual.id||actual.slug!==source.slug||!Number.isFinite(Date.parse(approval.approvedAt))||Date.parse(approval.approvedAt)>Date.now()||!Array.isArray(approval.imageDigests)||approval.imageDigests.some(d=>!/^[a-f0-9]{64}$/.test(d)))return false;
 const prepared=await prepareDraftSource(source,fetcher),content={...expectedContent(prepared),html:projectTableRows(expectedContent(prepared).html)};
 const {document}=parseHTML('<html><body>'+content.html+'</body></html>');
 const images=Array.from(document.querySelectorAll('img')).map(i=>({src:i.getAttribute('src')!,alt:i.getAttribute('alt')??'',loaded:true}));
 const media=prepared.media??[];if(JSON.stringify(media.map(i=>i.sha256))!==JSON.stringify(approval.imageDigests))return false;
 const allowed=images.map(i=>i.src),expected=await normalizeDraftObservation({...actual,content,images},fetcher,allowed),observed=await normalizeDraftObservation(actual,fetcher,allowed);
 if(JSON.stringify(observed.images.map(i=>i.sha256))!==JSON.stringify(approval.imageDigests))return false;
 return contentFingerprint({...observed.observation.content,html:withoutImageViewer(observed.observation.content.html)})===contentFingerprint(expected.observation.content);
}
