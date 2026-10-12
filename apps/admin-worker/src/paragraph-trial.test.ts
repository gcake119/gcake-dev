import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryPublicationRepository } from './publication-operations';
import { ParagraphProductionService, ParagraphRestClient, type ParagraphPublicationInput } from './paragraph-provider';
import { currentParagraphProductionGate } from './paragraph-gate';
const input: ParagraphPublicationInput = { postSlug: 'trial', sourceRevision: 'sha256:revision', publicationSlug: 'gcake', title: 'Trial', markdown: '# Same source\n\n[Original](https://example.com/original)', canonicalUrl: 'https://example.com/original', publishedAt: '2026-10-11T16:00:00Z' };
const scope = { kind: 'controlled-trial' as const, approved: true as const, newsletter: 'skip' as const, postSlug: input.postSlug, sourceRevision: input.sourceRevision, publicationSlug: input.publicationSlug, operation: 'prepare' as const };
function fixture() {
  const repository = new InMemoryPublicationRepository(), calls: string[] = [];
  let publicationSlug = 'gcake', title = input.title, status = 'draft';
  const client = new ParagraphRestClient('local-fixture-only', async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    calls.push((init.method ?? 'GET') + ' ' + path);
    if (path.endsWith('/me')) return Response.json({ slug: publicationSlug });
    if (path.endsWith('/posts') && init.method === 'POST') return Response.json({ id: 'draft-1' });
    if (path.endsWith('/posts')) return Response.json({ items: [], pagination: { hasMore: false } });
    if (init.method === 'PUT') { if (JSON.parse(String(init.body)).status === 'published') status = 'published'; return Response.json({ success: true }); }
    if (String(url).startsWith('https://paragraph.com/@')) return new Response(`<link rel="canonical" href="${input.canonicalUrl}">`);
    return Response.json({ id: 'draft-1', slug: input.postSlug, title, markdown: input.markdown, status, canonicalUrl: input.canonicalUrl, publishedAt: Date.parse(input.publishedAt) });
  });
  const service = (authorization = scope) => new ParagraphProductionService(repository, client, undefined, currentParagraphProductionGate, repository.runtime, authorization);
  return { repository, client, calls, service, setPublication: (v:string)=>{publicationSlug=v;}, setTitle: (v:string)=>{title=v;}, setStatus:(v:string)=>{status=v;} };
}
test('controlled prepare reads the complete saved draft while general production remains blocked', async () => {
  const f=fixture(), service=f.service();
  const state=await service.prepareDraft(input, await service.dryRun(input));
  assert.equal(state.status,'prepare_ready'); assert.equal(state.remoteId,'draft-1');
  assert.equal(f.calls.filter(call=>call.startsWith('POST')).length,1);
  assert.equal(f.calls.at(-1),'GET /api/v1/posts/draft-1');
  assert.equal(await f.repository.runtime.checkpoint(input.postSlug,'paragraph'),undefined);
  assert.equal(currentParagraphProductionGate.createVerified,false);
  await assert.rejects(service.publish(input,await service.dryRun(input)),/TRIAL_SCOPE/);
});
test('trial publish rechecks the saved draft and never updates or republishes a public article', async()=>{
  const f=fixture(), prepare=f.service();
  await prepare.prepareDraft(input,await prepare.dryRun(input));
  const publish=new ParagraphProductionService(f.repository,f.client,undefined,currentParagraphProductionGate,f.repository.runtime,{...scope,operation:'publish'});
  f.setTitle('human edited');const writes=f.calls.filter(c=>/^(POST|PUT)/.test(c)).length;
  await assert.rejects(publish.publish(input,await publish.dryRun(input)),/DRAFT_EVIDENCE/);
  assert.equal(f.calls.filter(c=>/^(POST|PUT)/.test(c)).length,writes);
});
test('externally published prepared draft is reconciled by reads without sending a second publish', async()=>{
  const f=fixture(), prepare=f.service();await prepare.prepareDraft(input,await prepare.dryRun(input));f.setStatus('published');
  const publish=new ParagraphProductionService(f.repository,f.client,undefined,currentParagraphProductionGate,f.repository.runtime,{...scope,operation:'publish'});
  const writes=f.calls.filter(c=>/^(POST|PUT)/.test(c)).length;
  assert.equal((await publish.publish(input,await publish.dryRun(input))).status,'verified');
  assert.equal(f.calls.filter(c=>/^(POST|PUT)/.test(c)).length,writes);
  assert.equal((await publish.publish(input,await publish.dryRun(input))).status,'verified');
  assert.equal(f.calls.filter(c=>/^(POST|PUT)/.test(c)).length,writes);
});
test('trial publishes the prepared draft once without updating content or sending newsletter',async()=>{
  const f=fixture(),prepare=f.service();await prepare.prepareDraft(input,await prepare.dryRun(input));
  const publish=new ParagraphProductionService(f.repository,f.client,undefined,currentParagraphProductionGate,f.repository.runtime,{...scope,operation:'publish'});
  assert.equal((await publish.publish(input,await publish.dryRun(input))).status,'published');
  assert.equal((await publish.verify(input)).status,'verified');
  assert.equal((await publish.publish(input,await publish.dryRun(input))).status,'verified');
  assert.equal(f.calls.filter(c=>c==='PUT /api/v1/posts/draft-1').length,2);
});
test('scheduled prepare recognizes an already public identical version without rewriting it',async()=>{
 const f=fixture(),prepare=f.service();await prepare.prepareDraft(input,await prepare.dryRun(input));f.setStatus('published');
 const writes=f.calls.filter(c=>/^(POST|PUT)/.test(c)).length;
 assert.equal((await prepare.prepareDraft(input,await prepare.dryRun(input))).status,'verified');
 assert.equal(f.calls.filter(c=>/^(POST|PUT)/.test(c)).length,writes);
});
test('trial rejects stale revision, wrong publication identity and publish without a prepared revision', async () => {
  const f=fixture();
  const stale=f.service({...scope, sourceRevision:'other'});
  await assert.rejects(stale.prepareDraft(input,await stale.dryRun(input)),/TRIAL_SCOPE/);
  assert.equal(f.calls.length,0);
  f.setPublication('wrong'); const wrong=f.service();
  await assert.rejects(wrong.prepareDraft(input,await wrong.dryRun(input)),/PUBLICATION_IDENTITY/);
  assert.equal(f.calls.some(call=>/^(POST|PUT)/.test(call)),false);
  f.setPublication('gcake');
  const publish=new ParagraphProductionService(f.repository,f.client,undefined,currentParagraphProductionGate,f.repository.runtime,{...scope,operation:'publish'});
  await assert.rejects(publish.publish(input,await publish.dryRun(input)),/TRIAL_PREPARED/);
  assert.equal(f.calls.some(call=>/^(POST|PUT)/.test(call)),false);
});
test('lost or mismatched draft readback retains the original ID and update intent', async () => {
  const f=fixture(); f.setTitle('stale body'); const service=f.service();
  await assert.rejects(service.prepareDraft(input,await service.dryRun(input)),/DRAFT_EVIDENCE/);
  assert.equal((await f.repository.runtime.checkpoint(input.postSlug,'paragraph'))?.operation,'update');
  assert.equal(f.repository.states.at(-1)?.remoteId,'draft-1');
  await assert.rejects(service.prepareDraft(input,await service.dryRun(input)),/RECONCILIATION/);
  assert.equal(f.calls.filter(call=>call.startsWith('POST')).length,1);
});

test('published Paragraph revision updates same ID and verifies without publication or newsletter',async()=>{
 const repository=new InMemoryPublicationRepository();const old={...input,sourceRevision:'old',markdown:'Old body'};let body=old.markdown,unknown=false;const writes:Record<string,unknown>[]=[];
 await repository.putState({postSlug:input.postSlug,target:'paragraph',sourceRevision:old.sourceRevision,status:'verified',remoteId:'same-id',remoteUrl:'https://paragraph.com/@gcake/trial',updatedAt:'now'});
 const client={assertPublicationSlug:async()=>{},findOwnBySlug:async()=>[],createDraft:async()=>{throw Error('must not create');},updateDraft:async(id:string,next:ParagraphPublicationInput)=>{assert.equal(id,'same-id');body=next.markdown;writes.push({operation:'update',sendNewsletter:false});if(unknown)throw Error('PARAGRAPH_UPDATE_UNKNOWN');},publish:async()=>{throw Error('must not publish');},readPrivate:async()=>({id:'same-id',slug:input.postSlug,title:input.title,status:'published' as const,canonicalUrl:input.canonicalUrl,publishedAt:input.publishedAt,markdown:body}),readPublic:async()=>({id:'same-id',slug:input.postSlug,title:input.title,status:'published' as const,canonicalUrl:input.canonicalUrl,publishedAt:input.publishedAt,markdown:body}),readPublicHtml:async()=>`<link rel="canonical" href="${input.canonicalUrl}">`};
 const service=new ParagraphProductionService(repository,client,undefined,currentParagraphProductionGate,repository.runtime,scope);
 assert.equal((await service.prepareDraft(input,await service.dryRun(input))).status,'verified');assert.equal(writes.length,1);
 assert.equal((await service.prepareDraft(input,await service.dryRun(input))).status,'verified');assert.equal(writes.length,1);
 const newer={...input,sourceRevision:'newer',markdown:'Latest body'};const update=new ParagraphProductionService(repository,client,undefined,currentParagraphProductionGate,repository.runtime,{...scope,sourceRevision:newer.sourceRevision});unknown=true;
 await assert.rejects(update.prepareDraft(newer,await update.dryRun(newer)),/UPDATE_UNKNOWN/);
 assert.equal((await repository.runtime.checkpoint(input.postSlug,'paragraph'))?.operation,'update');
 assert.equal((await update.reconcile(newer)).status,'verified');assert.equal(writes.length,2);
});

test('official me identifies the publication by top-level slug and rejects nested-only fixture identity',async()=>{
 const actual=new ParagraphRestClient('fixture',async()=>Response.json({id:'publication-id',name:'gcake',slug:'gcake'}));
 await actual.assertPublicationSlug('gcake');await assert.rejects(actual.assertPublicationSlug('different'),/IDENTITY_MISMATCH/);
 const nested=new ParagraphRestClient('fixture',async()=>Response.json({publication:{slug:'gcake'}}));await assert.rejects(nested.assertPublicationSlug('gcake'),/IDENTITY_MISMATCH/);
});
