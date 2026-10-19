import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsSession, InMemorySessionStore } from './auth';
import { createPhase1Handler, type OAuthClient } from './router';

const oauth: OAuthClient = { authorizationUrl: () => '', exchangeCode: async () => '', fetchIdentity: async () => ({ githubUserId: '119', login: 'owner' }) };

test('saving content never invokes publication operations and explicit operation names one target', async () => {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, { now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf' });
  const operations: unknown[] = [];
  const handle = createPhase1Handler({
    oauth, sessions, allowedGitHubUserIds: new Set(['119']), oauthStateSecret: 'secret', now: () => 1_001,
    githubWrites: { save: async () => ({ commitSha: 'new', paths: [] }), deletePost: async () => ({ kind: 'confirmation-required' }) },
    publications: {
      states: async () => [],
      operate: async (input) => { operations.push(input); return { ...input, status: 'prepare_ready', updatedAt: 'now' }; },
    },
  });
  await handle(new Request('https://admin.test/api/v1/posts/demo', { method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' }, body: JSON.stringify({ expectedBaseCommitSha: 'base', message: 'save', files: [] }) }));
  assert.equal(operations.length, 0);
  const response = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', { method: 'POST', headers: { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' }, body: JSON.stringify({ sourceRevision: 'base', target: 'substack', operation: 'prepare' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(operations, [{ postSlug: 'demo', sourceRevision: 'base', target: 'substack', operation: 'prepare' }]);
});

test('newsletter route requires a separate irreversible intent key before reaching operations', async () => {
  const sessions = new InMemorySessionStore();
  await createCmsSession({ githubUserId: '119', login: 'owner' }, sessions, { now: () => 1_000, randomToken: () => 'session', randomCsrfToken: () => 'csrf' });
  const operations: unknown[] = [];
  const handle = createPhase1Handler({
    oauth, sessions, allowedGitHubUserIds: new Set(['119']), oauthStateSecret: 'secret', now: () => 1_001,
    publications: {
      states: async () => [],
      operate: async (input) => { operations.push(input); return { ...input, status: 'failed', updatedAt: 'now' }; },
    },
  });
  const headers = { cookie: 'gcake_session=session', 'x-csrf-token': 'csrf', 'content-type': 'application/json' };
  const missingIntent = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', {
    method: 'POST', headers,
    body: JSON.stringify({ sourceRevision: 'base', target: 'substack', operation: 'newsletter' }),
  }));
  assert.equal(missingIntent.status, 400);
  assert.equal(operations.length, 0);

  const explicitIntent = await handle(new Request('https://admin.test/api/v1/publications/demo/operations', {
    method: 'POST', headers,
    body: JSON.stringify({
      sourceRevision: 'base', target: 'substack', operation: 'newsletter',
      newsletterIntentKey: 'newsletter-demo-base', explicitIrreversibleIntent: true,
    }),
  }));
  assert.equal(explicitIntent.status, 200);
  assert.deepEqual(operations, [{
    postSlug: 'demo', sourceRevision: 'base', target: 'substack', operation: 'newsletter',
    newsletterIntentKey: 'newsletter-demo-base', explicitIrreversibleIntent: true,
  }]);
});


// Exercise the actual production composition root, not an injected fake reader.
import { handleRequest } from './index';
const storedHistory = { post_slug:'demo',target:'github_pages',source_revision:'old',status:'verified',remote_id:'original',remote_url:'https://example.test/demo',verified_at:'2026-10-19T00:00:00Z',newsletter_sent_at:null,last_error_code:null,updated_at:'2026-10-19T00:00:00Z' };
function productionHistoryFixture(options:{unauthorized?:boolean;failure?:boolean;empty?:boolean;releases?:any[];queueFailure?:boolean}={}) {
 const queries:string[]=[];let writes=0,external=0;
 const db={prepare(sql:string){queries.push(sql);return {bind(..._values:unknown[]){return this;},async first<T>(){if(sql.includes('release_queue_runtime')){if(options.queueFailure)throw Error('private queue diagnostic');return {version:9,document:JSON.stringify({releases:options.releases??[]})} as T;}return options.unauthorized?null:{id:'session',github_user_id:'119',github_login:'owner',token_hash:'hash',csrf_token:'csrf',expires_at:Date.now()+60000} as T;},async all<T>(){if(options.failure)throw Error('private database diagnostic');return {results:(options.empty?[]:[storedHistory]) as T[]};},async run(){writes++;throw Error('Unexpected write');}};}};
 const env={CMS_DB:db,GITHUB_OWNER_USER_IDS:'119',SUBSTACK_WRITE_ENABLED:'false'};
 return {queries,get writes(){return writes;},get external(){return external;},request:(path='?sourceRevision=current',method='GET')=>handleRequest(new Request('https://admin.test/api/v1/publications/demo'+path,{method,headers:{cookie:'gcake_session=session','x-csrf-token':'csrf'}}),env,async()=>{external++;throw Error('Unexpected provider access');})};
}
test('production publication history GET is wired, preserves stale identity and never writes',async()=>{
 const f=productionHistoryFixture();const response=await f.request();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const data=await response.json() as any;assert.equal(data.states.length,1);assert.equal(data.states[0].status,'stale');assert.equal(data.states[0].remoteId,'original');assert.equal(data.states[0].sourceRevision,'old');assert.equal(f.writes,0);assert.equal(f.external,0);assert.ok(f.queries.some(q=>q.includes('publication_target_states')));
 const empty=productionHistoryFixture({empty:true});assert.deepEqual((await (await empty.request()).json() as any).states,[]);
});
test('production history rejects unauthorized or mutating reads and reports storage unavailable without leakage',async()=>{
 const absent=productionHistoryFixture({unauthorized:true});const denied=await absent.request();assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'no-store');assert.ok(!absent.queries.some(q=>q.includes('publication_target_states')));
 const bad=productionHistoryFixture({failure:true});const failed=await bad.request();assert.equal(failed.status,503);assert.equal(failed.headers.get('cache-control'),'no-store');assert.doesNotMatch(await failed.text(),/private database diagnostic/);
 const f=productionHistoryFixture();for(const method of ['POST','PUT','PATCH','DELETE']){const reply=await f.request('/operations',method);assert.equal(reply.status,405);assert.equal(reply.headers.get('cache-control'),'no-store');}assert.equal(f.writes,0);assert.equal(f.external,0);assert.ok(!f.queries.some(q=>q.includes('publication_target_states')));
});


const currentRelease={id:'release-demo',slug:'demo',slot:'2026-10-19T07:00:00+08:00',state:'verified-public',sourceRevision:'original-source',commitSha:'published-commit',publicationDigest:'a'.repeat(64),pageVerifiedAt:'2026-10-19T00:46:59Z',rssGuid:'https://gcake119.github.io/gcake-dev/posts/demo/',verifiedAt:'2026-10-19T00:46:59Z',deployment:{state:'deployed',commitSha:'published-commit',url:'https://github.com/gcake119/gcake-dev/actions/runs/1'},events:[]};
test('production Pages reads current verified publication despite empty legacy table or unrelated main SHA, without external access or write',async()=>{
 const f=productionHistoryFixture({empty:true,releases:[currentRelease]});const reply=await f.request('?sourceRevision=unrelated-main');assert.equal(reply.status,200);const v=await reply.json() as any;assert.deepEqual(v.states,[]);assert.equal(v.pages.source,'release-queue');assert.equal(v.pages.state,'verified-public');assert.equal(v.pages.deployment.state,'deployed');assert.equal(v.pages.verification.state,'verified');assert.equal(v.pages.verification.verifiedAt,currentRelease.verifiedAt);assert.equal(v.pages.verification.publicUrl,currentRelease.rssGuid);assert.equal(v.pages.sourceRevision,'original-source');assert.equal(f.writes,0);assert.equal(f.external,0);
});
test('Pages never promotes deployment alone, wrong commit, incomplete proof or unlocked history into current public success',async()=>{
 for(const change of [{state:'awaiting-verification',verifiedAt:undefined,rssGuid:undefined,pageVerifiedAt:undefined},{rssGuid:undefined},{deployment:{state:'deployed',commitSha:'other'}},{unlockedAt:'2026-10-19T01:00:00Z'}]){
  const f=productionHistoryFixture({empty:true,releases:[{...currentRelease,...change}]});const data=await (await f.request()).json() as any;assert.ok(data.pages);if('unlockedAt' in change){assert.equal(data.pages.state,'not-recorded');assert.equal(data.pages.historyCount,1);}else if('deployment' in change)assert.equal(data.pages.deployment.state,'unknown');else assert.notEqual(data.pages.verification.state,'verified');assert.equal(f.writes,0);assert.equal(f.external,0);
 }
 const none=await (await productionHistoryFixture({empty:true}).request()).json() as any;assert.equal(none.pages.state,'not-recorded');assert.equal(none.pages.historyCount,0);
 for(const options of [{empty:true,releases:[currentRelease,{...currentRelease,id:'second'}]},{empty:true,queueFailure:true}]){const reply=await productionHistoryFixture(options).request();assert.equal(reply.status,503);assert.doesNotMatch(await reply.text(),/private queue diagnostic/);}
});
