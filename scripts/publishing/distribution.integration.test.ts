import assert from 'node:assert/strict';
import test from 'node:test';
import { DistributionCoordinator } from '../../apps/admin-worker/src/distribution-coordinator';
import { InMemoryPublicationRepository } from '../../apps/admin-worker/src/publication-operations';
import { ParagraphProductionService } from '../../apps/admin-worker/src/paragraph-provider';

const publication = { slug: 'demo', title: 'Demo', body: 'Hello', canonicalUrl: 'https://gcake119.github.io/gcake-dev/posts/demo/', publishedAt: '2026-09-28T00:00:00Z', sourceRevision: 'revision-1', assets: [], distributionMode: 'full' as const };
test('shared workflow denies missing/stale approval before calling either provider', async () => {
  const repository = new InMemoryPublicationRepository();
  let writes = 0;
  const substack = { preflight: async () => {}, readDraft: async () => {}, checkPublish: async () => {}, find: async () => [], create: async () => { writes++; return { id: 's', url: 'https://gcakedev.substack.com/p/demo' }; }, update: async () => { writes++; }, publish: async () => { writes++; }, verify: async () => {} };
  const paragraph = new ParagraphProductionService(repository, {} as never);
  const coordinator = new DistributionCoordinator(repository, paragraph, substack, 'gcake');
  await assert.rejects(() => coordinator.run(publication, 'substack', 'publish'), /APPROVAL/);
  await assert.rejects(() => coordinator.run(publication, 'substack', 'publish', { target: 'substack', slug: 'demo', sourceRevision: 'old', newsletter: 'skip', approved: true }), /APPROVAL/);
  assert.equal(writes, 0);
});

test('shared workflow preserves uncertain publish and retry only verifies with platform isolation', async () => {
  const repository = new InMemoryPublicationRepository();
  await repository.putState({ postSlug: 'demo', target: 'paragraph', sourceRevision: 'revision-1', status: 'verified', remoteId: 'p', updatedAt: 'now' });
  let creates = 0, publishes = 0, verificationWorks = false;
  const browser = { preflight: async () => {}, readDraft: async () => {}, checkPublish: async () => {}, find: async () => [], create: async () => { creates++; return { id: 's', url: 'https://gcakedev.substack.com/p/demo' }; }, update: async () => {}, publish: async () => { publishes++; }, verify: async () => { if (!verificationWorks) throw new Error('SUBSTACK_PUBLIC_MISMATCH'); } };
  const coordinator = new DistributionCoordinator(repository, new ParagraphProductionService(repository, {} as never), browser, 'gcake');
  const approval = { target: 'substack' as const, slug: 'demo', sourceRevision: 'revision-1', newsletter: 'skip' as const, approved: true as const };
  const first = await coordinator.run(publication, 'substack', 'publish', approval);
  assert.equal(first.status, 'uncertain');
  verificationWorks = true;
  const recovered = await coordinator.run(publication, 'substack', 'retry', approval);
  assert.equal(recovered.status, 'verified');
  await coordinator.run(publication, 'substack', 'publish', approval);
  assert.equal(creates, 1); assert.equal(publishes, 1);
  assert.equal(repository.states.find(s => s.target === 'paragraph')?.status, 'verified');
});

test('full-mirror requires explicit policy approval before remote writes', async () => {
  const repository = new InMemoryPublicationRepository(); let calls = 0;
  const browser = { publicationPolicy: 'full-mirror' as const, preflight: async () => { calls++; }, readDraft: async () => {}, checkPublish: async () => {}, find: async () => [], create: async () => ({ id: 's', url: 'https://gcakedev.substack.com/p/demo' }), update: async () => {}, publish: async () => {}, finalizePublishedDate: async () => {}, verify: async () => {} };
  const coordinator = new DistributionCoordinator(repository, new ParagraphProductionService(repository, {} as never), browser, 'gcake');
  await assert.rejects(() => coordinator.run(publication, 'substack', 'publish', { target: 'substack', slug: 'demo', sourceRevision: 'revision-1', newsletter: 'skip', approved: true }), /POLICY_APPROVAL/);
  assert.equal(calls, 0);
});

test('full-mirror date failure survives read-only retry and requires approved same-ID finalize', async () => {
  const repository = new InMemoryPublicationRepository(); let creates = 0, publishes = 0, dates = 0, dateReady = false;
  const browser = { publicationPolicy: 'full-mirror' as const, preflight: async () => {}, readDraft: async () => {}, checkPublish: async () => {}, find: async () => [], create: async () => { creates++; return { id: 's', url: 'https://gcakedev.substack.com/p/demo' }; }, update: async () => {}, publish: async () => { publishes++; }, finalizePublishedDate: async (remote: { id: string }) => { assert.equal(remote.id, 's'); dates++; if (dates === 1) throw new Error('SUBSTACK_DATE_SAVE_FAILED'); dateReady = true; }, verify: async () => { if (!dateReady) throw new Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH'); } };
  const coordinator = new DistributionCoordinator(repository, new ParagraphProductionService(repository, {} as never), browser, 'gcake');
  const approval = { target: 'substack' as const, slug: 'demo', sourceRevision: 'revision-1', newsletter: 'skip' as const, approved: true as const, substackPolicy: 'full-mirror' as const };
  const first = await coordinator.run(publication, 'substack', 'publish', approval);
  assert.equal(first.status, 'uncertain'); assert.equal(first.remoteId, 's');
  assert.equal((await repository.runtime.checkpoint('demo', 'substack'))?.operation, 'metadata');
  assert.equal(dates, 1);
  await coordinator.run(publication, 'substack', 'retry');
  assert.equal(dates, 1); assert.equal(publishes, 1);
  await assert.rejects(() => coordinator.run(publication, 'substack', 'finalize'), /APPROVAL/);
  const final = await coordinator.run(publication, 'substack', 'finalize', approval);
  assert.equal(final.status, 'verified'); assert.equal(dates, 2); assert.equal(creates, 1); assert.equal(publishes, 1);
  await coordinator.run(publication, 'substack', 'publish', approval);
  assert.equal(dates, 2); assert.equal(publishes, 1);
});

test('finalize never creates a missing article or changes an uncertain source revision', async () => {
  const repository = new InMemoryPublicationRepository(); let writes = 0;
  const browser = { publicationPolicy: 'full-mirror' as const, preflight: async () => {}, readDraft: async () => {}, checkPublish: async () => {}, find: async () => [], create: async () => { writes++; return { id: 's', url: 'https://gcakedev.substack.com/p/demo' }; }, update: async () => { writes++; }, publish: async () => { writes++; }, finalizePublishedDate: async () => { writes++; }, verify: async () => {} };
  const coordinator = new DistributionCoordinator(repository, new ParagraphProductionService(repository, {} as never), browser, 'gcake');
  const approval = { target: 'substack' as const, slug: 'demo', sourceRevision: 'revision-1', newsletter: 'skip' as const, approved: true as const, substackPolicy: 'full-mirror' as const };
  assert.equal((await coordinator.run(publication, 'substack', 'finalize', approval)).status, 'manual_required');
  await repository.putState({ postSlug: 'demo', target: 'substack', sourceRevision: 'revision-1', status: 'uncertain', remoteId: 's', remoteUrl: 'https://gcakedev.substack.com/p/demo', updatedAt: 'now' });
  await repository.runtime.record({ postSlug: 'demo', target: 'substack', sourceRevision: 'revision-1', operation: 'metadata', substackPolicy: 'full-mirror', createdAt: 'now' });
  const changed = { ...publication, sourceRevision: 'revision-2' };
  const state = await coordinator.run(changed, 'substack', 'finalize', { ...approval, sourceRevision: changed.sourceRevision });
  assert.equal(state.status, 'uncertain'); assert.equal(state.sourceRevision, 'revision-1'); assert.equal(writes, 0);
});

test('publishing the reviewed prepared revision rereads the saved draft without another content update', async () => {
  const repository = new InMemoryPublicationRepository(); let updates = 0, reads = 0;
  const browser = { preflight: async () => {}, readDraft: async () => { reads++; }, checkPublish: async () => {}, find: async () => [], create: async () => ({ id: 's', url: 'https://gcakedev.substack.com/p/demo' }), update: async () => { updates++; }, publish: async () => {}, verify: async () => {} };
  const coordinator = new DistributionCoordinator(repository, new ParagraphProductionService(repository, {} as never), browser, 'gcake');
  const approval = { target: 'substack' as const, slug: 'demo', sourceRevision: 'revision-1', newsletter: 'skip' as const, approved: true as const };
  await coordinator.run(publication, 'substack', 'prepare', approval);
  assert.equal((await coordinator.run(publication, 'substack', 'publish', approval)).status, 'verified');
  assert.equal(updates, 1); assert.equal(reads, 1);
});

test('published Substack revision updates same ID and verifies without another publish',async()=>{
 const repository=new InMemoryPublicationRepository();
 await repository.putState({postSlug:'demo',target:'substack',sourceRevision:'revision-1',status:'verified',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/demo',updatedAt:'now'});
 let updates=0,publishes=0,creates=0,verifies=0;
 const browser={preflight:async()=>{},readDraft:async()=>{},checkPublish:async()=>{},find:async()=>[],create:async()=>{creates++;return {id:'456',url:'https://gcakedev.substack.com/p/duplicate'};},update:async(remote:{id:string})=>{assert.equal(remote.id,'123');updates++;},publish:async()=>{publishes++;},verify:async()=>{verifies++;}};
 const coordinator=new DistributionCoordinator(repository,new ParagraphProductionService(repository,{} as never),browser,'gcake');
 const changed={...publication,sourceRevision:'revision-2',body:'New complete version'};
 const approval={target:'substack' as const,slug:'demo',sourceRevision:changed.sourceRevision,newsletter:'skip' as const,approved:true as const};
 const state=await coordinator.run(changed,'substack','prepare',approval);
 assert.equal(state.status,'verified');assert.equal(state.remoteId,'123');assert.equal(updates,1);assert.equal(verifies,1);assert.equal(publishes,0);assert.equal(creates,0);
 await coordinator.run(changed,'substack','prepare',approval);assert.equal(updates,1);
});
test('unknown published update retries anonymous same-ID verification only',async()=>{
 const repository=new InMemoryPublicationRepository();
 await repository.putState({postSlug:'demo',target:'substack',sourceRevision:'revision-1',status:'verified',remoteId:'123',remoteUrl:'https://gcakedev.substack.com/p/demo',updatedAt:'now'});
 let updates=0,ready=false;
 const browser={preflight:async()=>{},readDraft:async()=>{throw Error('must not use draft for public recovery');},checkPublish:async()=>{},find:async()=>[],create:async()=>{throw Error('must not create');},update:async()=>{updates++;throw Error('SUBSTACK_UPDATE_UNKNOWN');},publish:async()=>{throw Error('must not publish');},verify:async()=>{if(!ready)throw Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');}};
 const coordinator=new DistributionCoordinator(repository,new ParagraphProductionService(repository,{} as never),browser,'gcake');
 const changed={...publication,sourceRevision:'revision-2'};
 const approval={target:'substack' as const,slug:'demo',sourceRevision:changed.sourceRevision,newsletter:'skip' as const,approved:true as const};
 assert.equal((await coordinator.run(changed,'substack','prepare',approval)).status,'uncertain');ready=true;
 assert.equal((await coordinator.run(changed,'substack','retry')).status,'verified');assert.equal(updates,1);
});
test('historical published Substack match is publicly verified and adopted without writes',async()=>{
 const repository=new InMemoryPublicationRepository();let writes=0;
 const browser={preflight:async()=>{},readDraft:async()=>{throw Error('published is not a draft');},checkPublish:async()=>{},find:async()=>[{id:'123',url:'https://gcakedev.substack.com/p/demo'}],create:async()=>{writes++;return {id:'456',url:'https://gcakedev.substack.com/p/duplicate'};},update:async()=>{writes++;},publish:async()=>{writes++;},verify:async()=>{}};
 const coordinator=new DistributionCoordinator(repository,new ParagraphProductionService(repository,{} as never),browser,'gcake');
 const state=await coordinator.run(publication,'substack','prepare',{target:'substack',slug:'demo',sourceRevision:publication.sourceRevision,newsletter:'skip',approved:true});
 assert.equal(state.status,'verified');assert.equal(state.remoteId,'123');assert.equal(writes,0);
});

test('historical public conflict remains read-only on repeated prepare rather than overwriting an unadopted article',async()=>{
 const repository=new InMemoryPublicationRepository();let writes=0;
 const browser={preflight:async()=>{},readDraft:async()=>{},checkPublish:async()=>{},find:async()=>[{id:'123',url:'https://gcakedev.substack.com/p/demo'}],create:async()=>{writes++;return {id:'456',url:'https://gcakedev.substack.com/p/duplicate'};},update:async()=>{writes++;},publish:async()=>{writes++;},verify:async()=>{throw Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');}};
 const coordinator=new DistributionCoordinator(repository,new ParagraphProductionService(repository,{} as never),browser,'gcake');const approval={target:'substack' as const,slug:'demo',sourceRevision:publication.sourceRevision,newsletter:'skip' as const,approved:true as const};
 assert.equal((await coordinator.run(publication,'substack','prepare',approval)).status,'manual_required');
 assert.equal((await coordinator.run(publication,'substack','prepare',approval)).status,'manual_required');assert.equal(writes,0);
});
