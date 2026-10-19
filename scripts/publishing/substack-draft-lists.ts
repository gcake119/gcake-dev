type Scope = 'draft'|'scheduled'|'published';
/** Verify observed UI list data; no browser access, fixed counts or provider calls. */
export function verifyDraftLists(value:unknown, originalId?:string) {
 const fail=(code:string):never=>{throw Error(code);};
 const scopes:Scope[]=['draft','scheduled','published'];
 const labels:Record<Scope,RegExp>={draft:/^(?:草稿|Drafts?)\s*(\d+)$/i,scheduled:/^(?:已排程|Scheduled)\s*(\d+)$/i,published:/^(?:已發[佈布]|Published)\s*(\d+)$/i};
 const data=value as {schemaVersion?:number;lists?:any[]};
 if(!data||data.schemaVersion!==1||!Array.isArray(data.lists)||data.lists.length!==3)fail('SUBSTACK_DRAFT_LIST_INCOMPLETE');
 const counts={} as Record<Scope,number>,ids={} as Record<Scope,string[]>;const seen=new Set<string>();
 for(const scope of scopes){
  const matches=data.lists!.filter(l=>l?.state===scope);if(matches.length!==1)fail('SUBSTACK_DRAFT_LIST_INCOMPLETE');const l=matches[0];
  const count=typeof l.label==='string'?labels[scope].exec(l.label.trim()):null;
  if(!count||l.selected!==true||l.loading!==false||l.nextEnabled!==false||!Array.isArray(l.rows)||!Number.isSafeInteger(Number(count[1]))||l.rows.length!==Number(count[1]))fail('SUBSTACK_DRAFT_LIST_INCOMPLETE');
  counts[scope]=Number(count![1]);ids[scope]=[];
  for(const row of l.rows){
   if(typeof row?.href!=='string'||typeof row.text!=='string'||!row.text.trim())fail('SUBSTACK_DRAFT_LIST_LINK_INVALID');
   let u:URL;try{u=new URL(row.href,'https://gcakedev.substack.com');}catch{fail('SUBSTACK_DRAFT_LIST_LINK_INVALID');}
   const match=u!.pathname.match(/^\/publish\/(?:post|posts\/detail)\/([1-9]\d*)$/);
   if(u!.origin!=='https://gcakedev.substack.com'||!match)fail('SUBSTACK_DRAFT_LIST_LINK_INVALID');
   const id=match![1];if(seen.has(id))fail('SUBSTACK_DRAFT_IDENTITY_CONFLICT');seen.add(id);ids[scope].push(id);
  }
 }
 if(originalId&&(!ids.draft.includes(originalId)||ids.scheduled.includes(originalId)||ids.published.includes(originalId)))fail('SUBSTACK_DRAFT_IDENTITY_PROTECTED_OR_MISSING');
 return {complete:true,counts,ids};
}
