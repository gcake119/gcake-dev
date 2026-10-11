import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { ReleaseQueue, D1ReleaseStore, type ReleaseSnapshot } from './release-queue.js';
import { ReleaseDelivery, publicationFiles, verifyPublicRelease } from './release-delivery.js';
import { RepositoryConflictError } from './git-writes.js';
const source = '---\ntitle: 測試文章\nstatus: ready\n---\n\n正文不可改\n';
const manifest = 'slug: s\nsections:\n  - posts:\n      - slug: one\n        status: ready\n';
const snapshot = (): ReleaseSnapshot => ({
  revision: 'sha1',
  posts: [
    {
      slug: 'one',
      title: '測試文章',
      status: 'ready',
      path: 'src/content/posts/one.md',
      sha: 'blob',
      source,
    },
  ],
  series: [
    {
      slug: 's',
      path: 'src/content/series/s.yaml',
      sha: 'series',
      source: manifest,
      sections: [{ posts: [{ slug: 'one', status: 'ready' }] }],
    },
  ],
});
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0006_release_queue.sql', import.meta.url), 'utf8'));
  const store = new D1ReleaseStore({
    prepare(sql) {
      let v: any[] = [];
      return {
        bind(...x: any[]) {
          v = x;
          return this;
        },
        async first<T>() {
          return (db.prepare(sql).get(...v) as T) ?? null;
        },
        async run() {
          return { meta: { changes: db.prepare(sql).run(...v).changes } };
        },
      };
    },
  });
  let now = '2026-10-11T10:00:00Z';
  const queue = new ReleaseQueue(store, () => now, true);
  return {
    queue,
    time: () => {
      now = '2026-10-11T23:05:00Z';
    },
  };
}
const base = 'https://gcake119.github.io/gcake-dev/';
function publicFetch(rss = true, canonical = true): typeof fetch {
  return (async (input: any) => {
    const url = String(input);
    return new Response(
      url.endsWith('rss.xml')
        ? rss
          ? '<rss><channel><item><title>測試文章</title><link>' +
            base +
            'posts/one/</link><guid>' +
            base +
            'posts/one/</guid></item></channel></rss>'
          : '<rss><channel/></rss>'
        : '<html><link rel="canonical" href="' +
          (canonical ? base + 'posts/one/' : 'https://evil.test/') +
          '"><script type="application/ld+json">' +
          JSON.stringify({
            '@type': 'BlogPosting',
            headline: '測試文章',
            datePublished: '2026-10-12T07:00:00+08:00',
            url: base + 'posts/one/',
          }) +
          '</script></html>',
      { status: 200 },
    );
  }) as typeof fetch;
}
test('atomic publication changes frontmatter/manifest status but preserves body and order', () => {
  const s = snapshot();
  const files = publicationFiles(s, 'one', '2026-10-12T07:00:00+08:00');
  assert.equal(files.length, 2);
  assert.ok(files[0].source.endsWith('\n\n正文不可改\n'));
  assert.match(files[0].source, /status: published/);
  assert.match(files[1].source, /status: published/);
});
test('disabled execution and stale revisions never call Git writer', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time();
  let calls = 0;
  const d = new ReleaseDelivery(
    queue,
    {
      snapshot: async () => s,
      save: async () => {
        calls++;
        return { commitSha: 'written', paths: [] };
      },
    },
    false,
  );
  await assert.rejects(() => d.execute(), /RELEASE_DISABLED/);
  assert.equal(calls, 0);
});
test('lost Git write response remains unknown, reverify repairs public state without another write', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time();
  let writes = 0;
  const d = new ReleaseDelivery(
    queue,
    {
      snapshot: async () => s,
      save: async () => {
        writes++;
        throw new Error('network');
      },
    },
    true,
    publicFetch(),
    base,
  );
  const r = await d.execute();
  assert.equal(r?.state, 'verification-unknown');
  const verified = await d.reverify(r!.id);
  assert.equal(verified.state, 'verified-public');
  assert.equal(writes, 1);
  assert.equal(await d.execute(), undefined);
});
test('RSS delay and wrong canonical do not consume slot; conflict retries retain release identity', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time();
  let conflict = true;
  const d = new ReleaseDelivery(
    queue,
    {
      snapshot: async () => s,
      save: async () => {
        if (conflict) throw new RepositoryConflictError('ARTICLE_CONFLICT', 'p', 'a', 'b', 'new');
        return { commitSha: 'written', paths: [] };
      },
    },
    true,
    publicFetch(false),
    base,
  );
  const r = await d.execute();
  assert.equal(r?.state, 'failed');
  conflict = false;
  const retried = await d.retry(r!.id);
  assert.equal(retried.id, r?.id);
  assert.equal(retried.state, 'awaiting-verification');
  const checked = await d.reverify(r!.id);
  assert.equal(checked.state, 'awaiting-verification');
  assert.ok(checked.pageVerifiedAt);
  assert.equal(checked.rssGuid, undefined);
  const bad = await verifyPublicRelease(publicFetch(true, false), base, 'one', '測試文章');
  assert.equal(bad.page, false);
});

test('fresh revision check after acquisition stops concurrent editorial mutation before Git write', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time();
  let reads = 0,
    writes = 0;
  const d = new ReleaseDelivery(
    queue,
    {
      snapshot: async () => ({
        ...s,
        revision: ++reads > 1 ? 'changed' : 'sha1',
      }),
      save: async () => {
        writes++;
        return { commitSha: 'never', paths: [] };
      },
    },
    true,
  );
  const r = await d.execute();
  assert.equal(r?.error, 'GIT_CONFLICT');
  assert.equal(writes, 0);
});
test('build failure retry reuses release id without writing article again', async () => {
  const { queue, time } = setup();
  const s = snapshot();
  await queue.ingest(s);
  time();
  let writes = 0,
    retries = 0;
  const d = new ReleaseDelivery(
    queue,
    {
      snapshot: async () => s,
      save: async () => {
        writes++;
        return { commitSha: 'written', paths: [] };
      },
      deployment: async () => ({
        state: 'failed',
        commitSha: 'written',
        startedAt: '2026-10-11T23:06:00Z',
      }),
      retryDeployment: async () => {
        retries++;
      },
    },
    true,
  );
  const r = await d.execute();
  const again = await d.retry(r!.id);
  assert.equal(again.id, r?.id);
  assert.equal(writes, 1);
  assert.equal(retries, 1);
});

test('wrong GUID, JSON-LD identity or release metadata never verifies publication', async () => {
  const wrong = (async (input: any) =>
    new Response(
      String(input).endsWith('rss.xml')
        ? '<rss><item><title>測試文章</title><link>' + base + 'posts/one/</link><guid>wrong</guid></item></rss>'
        : '<link rel="canonical" href="' +
          base +
          'posts/one/"><script type="application/ld+json">' +
          JSON.stringify({ '@type': 'BlogPosting', headline: '測試文章', datePublished: '2000-01-01', url: 'https://unrelated.test/' }) +
          '</script>',
    )) as typeof fetch;
  const result = await verifyPublicRelease(wrong, base, 'one', '測試文章', '2026-10-12T07:00:00+08:00');
  assert.equal(result.page, false);
  assert.equal(result.rssGuid, undefined);
  const wrongGuid = (async (input: any, init: any) => {
    const r = await publicFetch()(input, init);
    return new Response((await r.text()).replace('<guid>' + base + 'posts/one/</guid>', '<guid>wrong</guid>'));
  }) as typeof fetch;
  assert.equal((await verifyPublicRelease(wrongGuid, base, 'one', '測試文章')).rssGuid, undefined);
});

test('public reverify never associates an unrelated Pages deployment with this release', async () => {
  for (const observedSha of ['older-manual-sha', 'written']) {
    const {queue,time}=setup();
    const s=snapshot();
    await queue.ingest(s);
    time();
    const d=new ReleaseDelivery(queue,{
      snapshot:async()=>s,
      save:async()=>({commitSha:'written',paths:[]}),
      deployment:async()=>({state:'deployed',commitSha:observedSha,startedAt:'2026-10-11T23:06:00Z'}),
    },true,publicFetch(),base);
    const r=await d.execute();
    const checked=await d.reverify(r!.id);
    assert.equal(checked.state,'verified-public');
    assert.equal(checked.deployment?.commitSha, observedSha==='written'?'written':undefined);
  }
});
