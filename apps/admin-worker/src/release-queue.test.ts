import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { ReleaseQueue, D1ReleaseStore, type ReleaseSnapshot } from './release-queue.js';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0006_release_queue.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql: string) {
      let values: any[] = [];
      return {
        bind(...v: any[]) {
          values = v;
          return this;
        },
        async first<T>() {
          return (db.prepare(sql).get(...values) as T) ?? null;
        },
        async run() {
          return { meta: { changes: db.prepare(sql).run(...values).changes } };
        },
      };
    },
  };
}
const post = (slug: string, status = 'ready', publishedAt?: string) => ({
  slug,
  title: slug,
  status,
  publishedAt,
  path: `src/content/posts/${slug}.md`,
  sha: slug,
  source: `---\ntitle: ${slug}\nstatus: ${status}\n${publishedAt ? 'publishedAt: ' + publishedAt + '\n' : ''}---\nBODY ${slug}\n`,
});
const snapshot = (n = 3): ReleaseSnapshot => ({
  revision: 'head-1',
  posts: Array.from({ length: n }, (_, i) => post('p' + i)),
  series: [
    {
      slug: 's',
      path: 'src/content/series/s.yaml',
      sha: 'series',
      source: '',
      sections: [
        {
          posts: Array.from({ length: n }, (_, i) => ({
            slug: 'p' + i,
            status: 'ready',
          })),
        },
      ],
    },
  ],
});
function setup() {
  const store = new D1ReleaseStore(database());
  let now = '2026-10-11T10:00:00Z';
  return {
    store,
    queue: new ReleaseQueue(store, () => now),
    time: (v: string) => {
      now = v;
    },
  };
}

test('complete snapshot ingestion preserves firstReadyAt across repeated snapshots and partial series', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  s.posts[2].status = 'draft';
  let view = await queue.ingest(s);
  assert.equal(view.plan.length, 0);
  assert.ok(view.blockedSeries.length);
  time('2026-10-11T12:00:00Z');
  s.posts[2].status = 'ready';
  view = await queue.ingest(s);
  assert.deepEqual(
    view.plan.map((x) => x.slug),
    ['p0', 'p1', 'p2'],
  );
  const first = view.items[0].readyAt;
  time('2026-10-13T10:00:00Z');
  view = await queue.ingest({ ...s, revision: 'head-2' });
  assert.equal(view.items[0].readyAt, first);
  assert.equal(view.seriesReadyAt.s, '2026-10-11T12:00:00Z');
});
test('two concurrent reservations acquire only one Taipei slot and expired writes require verification', async () => {
  const { queue, store, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const second = new ReleaseQueue(store, () => '2026-10-11T23:05:00Z');
  const attempts = await Promise.allSettled([queue.acquire(s, true), second.acquire(s, true)]);
  const releases = attempts.filter((x) => x.status === 'fulfilled' && x.value);
  assert.equal(releases.length, 1);
  const r = (releases[0] as any).value;
  await queue.beginWrite(r.id, r.lease);
  time('2026-10-12T00:00:00Z');
  assert.equal(await queue.acquire(s, true), undefined);
  assert.equal((await queue.view(s)).releases[0].state, 'verification-unknown');
});
test('disabled gate makes no queue reservation or editorial writes', async () => {
  const { queue } = setup();
  await assert.rejects(() => queue.acquire(snapshot(), false), /RELEASE_DISABLED/);
  assert.equal((await queue.view(snapshot())).releases.length, 0);
});
test('future published dates reserve their Taipei date and ready legacy dates need adoption', async () => {
  const { queue } = setup();
  const s = snapshot(0);
  s.posts = [
    post('history', 'published', '2026-10-01'),
    post('future', 'published', '2026-10-12T09:00:00+08:00'),
    post('legacy', 'ready', '2026-10-15'),
    post('single'),
  ];
  const view = await queue.ingest(s);
  assert.deepEqual(view.plan, [{ slug: 'single', releaseAt: '2026-10-15T07:00:00+08:00' }]);
  assert.equal(view.items.find((x) => x.slug === 'legacy')?.reason, 'LEGACY_SCHEDULE_REQUIRES_ADOPTION');
});
test('committed slots resist late standalone insertion and paused series cannot acquire', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  assert.equal(r?.slug, 'p0');
  s.posts.push(post('single'));
  await queue.ingest(s);
  assert.equal((await queue.view(s)).plan[0].slug, 'single');
  await queue.control(s, { action: 'pause', scope: 'series', slug: 's' });
  assert.equal((await queue.view(s)).items.find((x) => x.slug === 'p1')?.state, 'paused');
});
test('override preview rejects conflict and confirmation compares plan version and source', async () => {
  const { queue } = setup();
  const s = snapshot(0);
  s.posts = [post('a'), post('b')];
  await queue.ingest(s);
  const preview = await queue.previewOverride(s, 'b', '2026-10-12T07:00:00+08:00');
  assert.equal(preview.after[0].slug, 'b');
  await queue.control(s, {
    action: 'override',
    slug: 'b',
    releaseAt: preview.releaseAt,
    version: preview.version,
    revision: s.revision,
  });
  await assert.rejects(
    () =>
      queue.control(s, {
        action: 'override',
        slug: 'a',
        releaseAt: preview.releaseAt,
        version: preview.version,
        revision: s.revision,
      }),
    /QUEUE_CONFLICT/,
  );
  assert.ok((await queue.previewOverride(s, 'a', preview.releaseAt)).conflicts.length);
});

test('unverified first installment blocks later slot acquisition instead of skipping it', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  await queue.beginWrite(r!.id, r!.lease);
  time('2026-10-14T23:05:00Z');
  assert.equal(await queue.acquire(s, true), undefined);
});

test('active series resumes third post after standalone, ahead of an older waiting series', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  s.posts.push(post('other'));
  s.series.push({
    slug: 'other-series',
    sha: 's2',
    path: 'src/content/series/other.yaml',
    source: '',
    sections: [{ posts: [{ slug: 'other', status: 'ready' }] }],
  });
  s.posts[0].status = 'published';
  s.posts[1].status = 'published';
  s.series[0].sections[0].posts[0].status = 'published';
  s.series[0].sections[0].posts[1].status = 'published';
  time('2026-10-16T01:00:00Z');
  s.posts.push(post('standalone'));
  const v = await queue.ingest(s);
  assert.deepEqual(
    v.plan.map((p) => p.slug),
    ['standalone', 'p2', 'other'],
  );
});

test('paused or legacy-held predecessor withholds later installments and retains fixed reservations', async () => {
  const { queue } = setup();
  const s = snapshot(2);
  await queue.ingest(s);
  await queue.control(s, { action: 'pause', slug: 'p0' });
  assert.equal((await queue.view(s)).plan.length, 0);
  const singles = snapshot(0);
  singles.posts = [post('a'), post('b')];
  const { queue: q } = setup();
  await q.ingest(singles);
  const p = await q.previewOverride(singles, 'a', '2026-10-12T07:00:00+08:00');
  await q.control(singles, { action: 'override', slug: 'a', releaseAt: p.releaseAt, version: p.version, revision: singles.revision });
  await q.control(singles, { action: 'pause', slug: 'a' });
  assert.equal((await q.view(singles)).plan[0].releaseAt, '2026-10-15T07:00:00+08:00');
});
test('same-day legacy publication consumes the Taipei date even after its midnight instant', async () => {
  const { queue, time } = setup();
  const s = snapshot(0);
  s.posts = [post('old', 'published', '2026-10-12'), post('new')];
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  assert.equal(await queue.acquire(s, true), undefined);
});
test('prestart reorder refreshes baseline; fixed chapter protects predecessors from late insertion', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  s.series[0].sections = [{ posts: [...s.series[0].sections[0].posts].reverse() }];
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  assert.equal(r?.slug, 'p2');
  assert.equal((await queue.view(s)).blockedSeries.length, 0);
  const { queue: q } = setup();
  const ordered = snapshot();
  await q.ingest(ordered);
  const p = await q.previewOverride(ordered, 'p1', '2026-10-15T07:00:00+08:00');
  await q.control(ordered, { action: 'override', slug: 'p1', releaseAt: p.releaseAt, version: p.version, revision: ordered.revision });
  ordered.posts.push(post('single'));
  const view = await q.ingest(ordered);
  assert.ok(view.plan.findIndex((p) => p.slug === 'p0') < view.plan.findIndex((p) => p.slug === 'p1'));
  assert.equal(view.plan.find((p) => p.slug === 'p1')?.releaseAt, '2026-10-15T07:00:00+08:00');
});
test('verified-public is terminal and cannot be downgraded by a stale response', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  await queue.record(r!.id, r!.lease, { state: 'verified-public', rssGuid: 'canonical', verifiedAt: 'verified' }, 'verified');
  await queue.record(r!.id, r!.lease, { state: 'awaiting-verification', rssGuid: undefined, verifiedAt: undefined }, 'stale');
  assert.equal((await queue.view(s)).releases[0].state, 'verified-public');
});

test('fixed current-day commitment remains executable after 07:00 rather than failing estimate refresh', async () => {
  const { queue, time } = setup();
  const s = snapshot(0);
  s.posts = [post('a')];
  await queue.ingest(s);
  const p = await queue.previewOverride(s, 'a', '2026-10-12T07:00:00+08:00');
  await queue.control(s, { action: 'override', slug: 'a', releaseAt: p.releaseAt, version: p.version, revision: s.revision });
  time('2026-10-11T23:05:00Z');
  assert.equal((await queue.acquire(s, true))?.slug, 'a');
});
test('identity changes are refused for commitments and pre-write eligibility failures can recover safely', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  await assert.rejects(() => queue.assertPostIdentityChange(s, r!.slug), /RELEASE_IDENTITY_LOCKED/);
  await queue.record(r!.id, r!.lease, { state: 'failed', error: 'ELIGIBILITY_CHANGED' }, 'paused-before-write');
  const recovered = await queue.retryLease(r!.id);
  assert.equal(recovered.id, r?.id);
  assert.equal(recovered.state, 'committed-slot');
});

test('safe unlock preserves article identity/history and permits recovery after a rename race', async () => {
  const { queue, time } = setup();
  const s = snapshot(0);
  s.posts = [post('single')];
  await queue.ingest(s);
  time('2026-10-11T23:05:00Z');
  const r = await queue.acquire(s, true);
  await queue.record(r!.id, r!.lease, { state: 'failed', error: 'GIT_CONFLICT' }, 'conflict');
  await queue.control(s, { action: 'unlock', slug: 'single', confirmed: true });
  const next = await queue.acquire(s, true);
  assert.equal(next?.id, r?.id);
  assert.ok(next?.events.some((e) => e.type === 'conflict'));
  await queue.record(next!.id, next!.lease, { state: 'failed', error: 'GIT_CONFLICT' }, 'conflict');
  s.posts = [];
  await queue.control(s, { action: 'unlock', slug: 'single', confirmed: true });
  assert.equal((await queue.view(s)).releases[0].id, r?.id);
});
test('delayed ingestion keeps actual first-ready commit chronology immutable', async () => {
  const { queue, time } = setup();
  const s = snapshot(0);
  s.posts = [post('a-second'), post('b-first')];
  s.firstReadyAt = async (p) => (p.slug === 'b-first' ? '2026-10-10T01:00:00Z' : '2026-10-10T02:00:00Z');
  const v = await queue.ingest(s);
  assert.deepEqual(
    v.plan.map((p) => p.slug),
    ['b-first', 'a-second'],
  );
  time('2026-10-12T01:00:00Z');
  s.firstReadyAt = async () => {
    throw new Error('must not resolve again');
  };
  assert.equal((await queue.ingest(s)).items.find((p) => p.slug === 'b-first')?.readyAt, '2026-10-10T01:00:00Z');
});

test('operator pause flags stay separate from release state and pause scope', async () => {
  const { queue, time } = setup();
  const s = snapshot(1);
  await queue.ingest(s);
  time('2026-10-12T00:00:00Z');
  const release = await queue.acquire(s, true);
  assert.ok(release);
  await queue.control(s, { action: 'pause', slug: 'p0' });
  let item = (await queue.view(s)).items[0];
  assert.equal(item.state, 'committed-slot');
  assert.equal(item.postPaused, true);
  assert.equal(item.seriesPaused, false);
  await queue.control(s, { action: 'pause', scope: 'series', slug: 's' });
  await queue.control(s, { action: 'resume', slug: 'p0' });
  item = (await queue.view(s)).items[0];
  assert.equal(item.postPaused, false);
  assert.equal(item.seriesPaused, true);
  await queue.control(s, { action: 'resume', scope: 'series', slug: 's' });
  assert.equal((await queue.view(s)).items[0].seriesPaused, false);
});


test('off-calendar published legacy dates do not consume Monday or Thursday slots', async () => {
  for (const publishedAt of ['2026-10-13', '2026-10-17', '2026-10-12T23:30:00Z']) {
    const { queue } = setup();
    const s = snapshot(0);
    const legacy = post('legacy', 'published', publishedAt);
    s.posts = [legacy, post('a'), post('b')];
    const view = await queue.ingest(s);
    assert.deepEqual(view.plan, [
      { slug: 'a', releaseAt: '2026-10-12T07:00:00+08:00' },
      { slug: 'b', releaseAt: '2026-10-15T07:00:00+08:00' },
    ], publishedAt);
    assert.equal(legacy.publishedAt, publishedAt);
    assert.equal(legacy.source, post('legacy', 'published', publishedAt).source);
  }
});

test('legacy reservations use the Taipei weekday across UTC midnight', async () => {
  const { queue } = setup();
  const s = snapshot(0);
  s.posts = [post('legacy', 'published', '2026-10-14T23:30:00Z'), post('a'), post('b')];
  assert.deepEqual((await queue.ingest(s)).plan, [
    { slug: 'a', releaseAt: '2026-10-12T07:00:00+08:00' },
    { slug: 'b', releaseAt: '2026-10-19T07:00:00+08:00' },
  ]);
});

test('D1 continuous readiness renews FIFO after observed and between-poll draft cycles', async () => {
  for (const observed of [true, false]) {
    const {queue,time}=setup();
    const s=snapshot(0);s.series=[];s.posts=[post('a'),post('b')];
    let ready='2026-10-10T10:00:00Z';
    s.firstReadyAt=async p=>p.slug==='a'?ready:'2026-10-11T09:00:00Z';
    await queue.ingest(s);
    time('2026-10-13T10:00:00Z');
    if(observed){s.posts[0].status='draft';await queue.ingest(s);}
    s.posts[0].status='ready';s.posts[0].sha='renewed';s.revision='renewed-head';ready='2026-10-13T09:00:00Z';
    const v=await queue.ingest(s);
    assert.deepEqual(v.plan.map(p=>p.slug),['b','a']);
    assert.equal(v.items.find(p=>p.slug==='a')?.readyAt,ready);
    s.posts[0].sha='body-edited';s.revision='body-edit-head';
    assert.equal((await queue.ingest(s)).items.find(p=>p.slug==='a')?.readyAt,ready);
  }
});
test('D1 incomplete/restored and changed unstarted membership renew whole-series eligibility', async()=>{
  const {queue,time}=setup();const s=snapshot(2);
  await queue.ingest(s);
  time('2026-10-13T10:00:00Z');s.posts[1].status='draft';s.series[0].sections[0].posts[1].status='draft';
  assert.equal((await queue.ingest(s)).seriesReadyAt.s,undefined);
  time('2026-10-14T10:00:00Z');s.posts[1].status='ready';s.series[0].sections[0].posts[1].status='ready';
  assert.equal((await queue.ingest(s)).seriesReadyAt.s,'2026-10-14T10:00:00Z');
  time('2026-10-16T10:00:00Z');s.posts.push(post('p2'));s.series[0].sections[0].posts=[...s.series[0].sections[0].posts,{slug:'p2',status:'ready'}];
  assert.equal((await queue.ingest(s)).seriesReadyAt.s,'2026-10-16T10:00:00Z');
});
test('D1 whole-series FIFO includes continuous manifest history before first observation',async()=>{
  const {queue}=setup();const s=snapshot(2);
  s.firstReadyAt=async()=> '2026-10-09T10:00:00Z';
  (s as any).firstSeriesReadyAt=async()=> '2026-10-10T10:00:00Z';
  assert.equal((await queue.ingest(s)).seriesReadyAt.s,'2026-10-10T10:00:00Z');
});
test('D1 recovery claims only latest due window on intervening days, never pre-observation or late readiness',async()=>{
  const {queue,time}=setup();const s=snapshot(0);s.series=[];s.posts=[post('a')];
  s.firstReadyAt=async()=> '2026-10-01T10:00:00Z';await queue.ingest(s);
  assert.equal(await queue.acquire(s,true),undefined,'latest Thursday predates initial observation');
  time('2026-10-16T01:00:00Z');
  const r=await queue.acquire(s,true);
  assert.equal(r?.slot,'2026-10-15T07:00:00+08:00');
  assert.equal((await queue.view(s)).releases.length,1);
  const late=setup();await late.queue.ingest({...s,posts:[]});late.time('2026-10-16T01:00:00Z');
  const arriving={...s,firstReadyAt:async()=> '2026-10-15T01:00:00Z'};
  assert.equal(await late.queue.acquire(arriving,true),undefined);
});
test('D1 refuses ambiguous manually started series rather than choosing snapshot order',async()=>{
  const {queue}=setup();const s=snapshot(2);
  s.posts[0].status='published';s.series[0].sections[0].posts[0].status='published';
  s.posts.push(post('other-old','published'),post('other-new'));
  s.series.push({...s.series[0],slug:'other-series',sections:[{posts:[{slug:'other-old',status:'published'},{slug:'other-new',status:'ready'}]}]});
  await assert.rejects(()=>queue.ingest(s),/MULTIPLE_ACTIVE_SERIES/);
});
test('D1 remembers active identity and blocks deletion or future predecessors without consuming another series',async()=>{
  for(const problem of ['deleted','future']){
    const {queue,time}=setup();const s=snapshot(2);
    s.posts[0].status='published';s.series[0].sections[0].posts[0].status='published';await queue.ingest(s);
    time('2026-10-11T23:05:00Z');
    if(problem==='deleted')s.series=[];
    else s.posts[0].publishedAt='2026-10-19T07:00:00+08:00';
    await assert.rejects(()=>queue.acquire(s,true),/ACTIVE_SERIES_RECONCILIATION_REQUIRED/);
    assert.equal((await queue.store.read()).data.releases.length,0);
  }
});

test('D1 manifest pause holds complete series and renews eligibility on resume',async()=>{
  const {queue,time}=setup();const s=snapshot(2);await queue.ingest(s);
  time('2026-10-13T10:00:00Z');(s.series[0] as any).paused=true;
  assert.equal((await queue.ingest(s)).plan.length,0);
  time('2026-10-14T10:00:00Z');(s.series[0] as any).paused=false;
  assert.equal((await queue.ingest(s)).seriesReadyAt.s,'2026-10-14T10:00:00Z');
});

test('D1 detects between-poll draft cycle even when final ready blob is byte-identical',async()=>{
  const {queue,time}=setup();const s=snapshot(0);s.series=[];s.posts=[post('a'),post('b')];
  let ready='2026-10-10T10:00:00Z';s.firstReadyAt=async p=>p.slug==='a'?ready:'2026-10-11T09:00:00Z';
  await queue.ingest(s);time('2026-10-13T10:00:00Z');
  s.revision='same-blob-new-history';ready='2026-10-13T09:00:00Z';
  assert.deepEqual((await queue.ingest(s)).plan.map(p=>p.slug),['b','a']);
});

test('D1 owner pause/resume renews uncommitted FIFO without moving a committed fixed date',async()=>{
 const {queue,time}=setup();const s=snapshot(0);s.series=[];s.posts=[post('a'),post('b')];
 s.firstReadyAt=async p=>p.slug==='a'?'2026-10-09T10:00:00Z':'2026-10-10T10:00:00Z';
 await queue.ingest(s);await queue.control(s,{action:'pause',slug:'a'});
 time('2026-10-13T10:00:00Z');await queue.control(s,{action:'resume',slug:'a'});
 s.revision='later-body-edit';
 assert.deepEqual((await queue.ingest(s)).plan.map(p=>p.slug),['b','a']);
 const other=setup();const series=snapshot(2);await other.queue.ingest(series);
 await other.queue.control(series,{action:'pause',scope:'series',slug:'s'});
 other.time('2026-10-13T10:00:00Z');await other.queue.control(series,{action:'resume',scope:'series',slug:'s'});
 assert.equal((await other.queue.ingest(series)).seriesReadyAt.s,'2026-10-13T10:00:00Z');
 const preview=await other.queue.previewOverride(series,'p0','2026-10-15T07:00:00+08:00');
 await other.queue.control(series,{action:'override',slug:'p0',releaseAt:preview.releaseAt,version:preview.version,revision:series.revision});
 await other.queue.control(series,{action:'pause',scope:'series',slug:'s'});
 await other.queue.control(series,{action:'resume',scope:'series',slug:'s'});
 assert.equal((await other.queue.ingest(series)).plan.find(p=>p.slug==='p0')?.releaseAt,preview.releaseAt);
});

test('D1 finishing active series still rejects two newly discovered started series in the same ingestion',async()=>{
 const {queue}=setup();const s=snapshot(2);
 s.posts[0].status='published';s.series[0].sections[0].posts[0].status='published';await queue.ingest(s);
 s.posts[1].status='published';s.series[0].sections[0].posts[1].status='published';
 for(const slug of ['x','y']) {
  s.posts.push(post(slug+'-old','published'),post(slug+'-new'));
  s.series.push({...s.series[0],slug,sections:[{posts:[{slug:slug+'-old',status:'published'},{slug:slug+'-new',status:'ready'}]}]});
 }
 await assert.rejects(()=>queue.ingest(s),/MULTIPLE_ACTIVE_SERIES/);
});

test('owner manual preview is read-only; confirmation records actual time without backdating and duplicate intent retains identity',async()=>{
  const s=setup();s.time('2026-10-12T03:00:00Z');const snap=snapshot();
  const preview=await (s.queue as any).previewManual(snap,'p0');
  assert.equal((await s.store.read()).version,0);
  const result=await (s.queue as any).acquireManual(snap,'p0',preview.version,preview.revision,'owner',true);
  assert.equal(result.created,true);assert.equal(result.record.mode,'manual');assert.equal(result.record.slot,'2026-10-12T11:00:00+08:00');
  const stored=await s.store.read();assert.equal(stored.data.startedAt,'2026-10-12T03:00:00Z');assert.equal(stored.data.releases.length,1);
  const repeat=await (s.queue as any).acquireManual(snap,'p0',preview.version,preview.revision,'owner',true);
  assert.equal(repeat.created,false);assert.equal(repeat.record.id,result.record.id);assert.equal((await s.store.read()).version,stored.version);
});
test('manual confirmation refuses out-of-order, stale version/source, disabled and held publications without identities',async()=>{
  for(const variant of ['order','version','revision','disabled','held','incomplete']) {
    const s=setup();const snap=snapshot();const preview=await (s.queue as any).previewManual(snap,'p0');
    if(variant==='held'){const state=await s.store.read();state.data.paused.push('series:s');await s.store.write(state);}
    if(variant==='incomplete')snap.series[0].sections[0].posts[2].status='planned';
    await assert.rejects(()=>(s.queue as any).acquireManual(snap,variant==='order'?'p1':'p0',variant==='version'?99:preview.version,variant==='revision'?'stale':preview.revision,'owner',variant!=='disabled'));
    assert.equal((await s.store.read()).data.releases.length,0);
  }
});

test('verified Monday manual publication occupies its date without claiming 07:00 and Thursday resumes chapter two',async()=>{
  const s=setup();s.time('2026-10-12T03:00:00Z');const snap=snapshot();const preview=await s.queue.previewManual(snap,'p0');
  const manual=await s.queue.acquireManual(snap,'p0',preview.version,preview.revision,'owner',true);
  await s.queue.record(manual.record.id,manual.record.lease,{state:'verified-public'},'public-confirmed');
  snap.posts[0].status='published';snap.posts[0].publishedAt=manual.record.slot;snap.series[0].sections[0].posts[0].status='published';snap.revision='head-2';
  assert.equal((await s.queue.view(snap)).plan[0].releaseAt,'2026-10-15T07:00:00+08:00');
  assert.equal(await s.queue.acquire(snap,true),undefined);
  s.time('2026-10-14T23:05:00Z');const next=await s.queue.acquire(snap,true);
  assert.equal(next?.slug,'p1');assert.equal(next?.slot,'2026-10-15T07:00:00+08:00');
  const stored=await s.store.read();assert.equal(stored.data.startedAt,'2026-10-12T03:00:00Z');assert.equal(stored.data.releases[0].slot,'2026-10-12T11:00:00+08:00');
});

test('manual publication cannot treat a legacy published intent as a publicly verified predecessor',async()=>{
  const s=setup();const snap=snapshot();snap.posts[0].status='published';snap.posts[0].publishedAt='2026-10-10T07:00:00+08:00';snap.series[0].sections[0].posts[0].status='published';
  await assert.rejects(()=>s.queue.previewManual(snap,'p1'),/MANUAL_PREDECESSOR_NOT_PUBLIC/);
  assert.equal((await s.store.read()).data.releases.length,0);
});

test('verified published chapter has no legacy attention warning and viewing preserves records and next slot', async () => {
  for (const mode of ['manual', 'scheduled'] as const) {
    const s = setup(); s.time('2026-10-12T03:56:38Z'); const snap = snapshot();
    let record;
    if (mode === 'manual') {
      const preview = await s.queue.previewManual(snap, 'p0');
      record = (await s.queue.acquireManual(snap, 'p0', preview.version, preview.revision, 'owner', true)).record;
    } else {
      s.time('2026-10-11T10:00:00Z'); await s.queue.ingest(snap);
      s.time('2026-10-11T23:05:00Z'); record = (await s.queue.acquire(snap, true))!;
    }
    s.time('2026-10-12T03:56:38Z');
    await s.queue.record(record.id, record.lease, { state: 'verified-public', mode, verifiedAt: '2026-10-12T04:08:06Z', rssGuid: 'https://fixture.invalid/posts/p0/' }, 'public-confirmed');
    snap.posts[0].status = 'published'; snap.posts[0].publishedAt = record.slot;
    snap.series[0].sections[0].posts[0].status = 'published';
    const before = await s.store.read();
    const view = await s.queue.view(snap);
    const completed = view.items.find(p => p.slug === 'p0')!;
    assert.equal(completed.state, 'verified-public');
    assert.equal(completed.reason, undefined);
    assert.equal(completed.estimatedAt, record.slot);
    assert.equal(view.items.filter(p => p.reason || ['failed', 'verification-unknown'].includes(p.state)).length, 0);
    assert.equal(view.plan[0].slug, 'p1');
    assert.equal(view.plan[0].releaseAt, '2026-10-15T07:00:00+08:00');
    assert.deepEqual(await s.store.read(), before);
  }
});

test('legacy attention is retained for unresolved, unlocked or ready-again release records', async () => {
  for (const variant of ['awaiting-verification', 'verification-unknown', 'failed', 'unlocked', 'ready-again'] as const) {
    const s = setup(); s.time('2026-10-12T03:56:38Z'); const snap = snapshot();
    const preview = await s.queue.previewManual(snap, 'p0');
    const intent = await s.queue.acquireManual(snap, 'p0', preview.version, preview.revision, 'owner', true);
    await s.queue.record(intent.record.id, intent.record.lease, {
      state: ['unlocked', 'ready-again'].includes(variant) ? 'verified-public' : variant as 'awaiting-verification' | 'verification-unknown' | 'failed',
      error: 'fixture-reconcile', ...(variant === 'unlocked' ? { unlockedAt: '2026-10-12T04:00:00Z' } : {}),
    }, 'fixture-state');
    const status = variant === 'ready-again' ? 'ready' : 'published';
    snap.posts[0].status = status;
    snap.posts[0].publishedAt = intent.record.slot;
    snap.series[0].sections[0].posts[0].status = status;
    const before = await s.store.read();
    const view = await s.queue.view(snap);
    assert.equal(view.items.find(p => p.slug === 'p0')?.reason, 'LEGACY_SCHEDULE_REQUIRES_ADOPTION', variant);
    assert.equal(view.releases[0].error, 'fixture-reconcile');
    assert.deepEqual(await s.store.read(), before);
  }
});

test('verified-public does not hide unrelated pause or missed fixed-slot reasons', async () => {
  for (const reason of ['PAUSED', 'MISSED_FIXED_SLOT']) {
    const s = setup(); s.time('2026-10-12T03:56:38Z'); const snap = snapshot();
    const preview = await s.queue.previewManual(snap, 'p0');
    const intent = await s.queue.acquireManual(snap, 'p0', preview.version, preview.revision, 'owner', true);
    await s.queue.record(intent.record.id, intent.record.lease, { state: 'verified-public' }, 'public-confirmed');
    snap.posts[0].status = 'published'; snap.posts[0].publishedAt = intent.record.slot;
    snap.series[0].sections[0].posts[0].status = 'published';
    const local = await s.store.read();
    if (reason === 'PAUSED') local.data.paused.push('post:p0');
    else local.data.overrides.p0 = '2026-10-08T07:00:00+08:00';
    await s.store.write(local);
    const before = await s.store.read();
    assert.equal((await s.queue.view(snap)).items.find(p => p.slug === 'p0')?.reason, reason);
    assert.deepEqual(await s.store.read(), before);
  }
});
