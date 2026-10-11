/** Local only: copies source, writes ephemeral Git/SQLite and builds real Astro. */
import { mkdtemp, cp, symlink, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { ReleaseQueue, D1ReleaseStore, type ReleaseSnapshot } from '../../apps/admin-worker/src/release-queue';
import { ReleaseDelivery } from '../../apps/admin-worker/src/release-delivery';
const root = resolve('.');
const dir = await mkdtemp(join(tmpdir(), 'gcake-release-simulation-'));
for (const path of ['src', 'scripts', 'packages', 'astro.config.mjs', 'tsconfig.json', 'package.json'])
  await cp(join(root, path), join(dir, path), {
    recursive: true,
    filter: (p) => !p.includes('/node_modules') && !p.includes('/dist') && !p.includes('/__pycache__'),
  });
await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
// Keep the fixed simulation clock independent of real editorial publication dates.
// This standalone exists only in the temporary copy; real manuscripts stay intact.
await writeFile(join(dir, 'src/content/posts/release-simulation-fixture.md'),
  '---\ntitle: Local release simulation\ndescription: Local-only release acceptance fixture\nstatus: ready\ntopics:\n  - testing-verification\n---\n\nLocal-only release acceptance fixture.\n');
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
git('init', '--quiet');
git('config', 'user.name', 'Release simulation');
git('config', 'user.email', 'simulation@example.invalid');
git('add', '.');
git('commit', '--quiet', '-m', 'Local simulation baseline');
const snapshot = async (): Promise<ReleaseSnapshot> => {
  const revision = git('rev-parse', 'HEAD');
  const files = git('ls-tree', '-r', '--name-only', revision).split('\n');
  const posts: ReleaseSnapshot['posts'] = [],
    series: ReleaseSnapshot['series'] = [];
  for (const path of files) {
    if (!/^src\/content\/(posts\/.+\.mdx?|series\/[^/]+\.ya?ml)$/.test(path)) continue;
    const source = execFileSync('git', ['show', revision + ':' + path], {
      cwd: dir,
      encoding: 'utf8',
    });
    const sha = git('rev-parse', revision + ':' + path);
    if (path.startsWith('src/content/posts')) {
      const m = /^---\n([\s\S]*?)\n---/.exec(source);
      const data = YAML.parse(m![1]);
      posts.push({
        slug: path
          .split('/')
          .pop()!
          .replace(/\.mdx?$/, ''),
        path,
        sha,
        source,
        title: data.title,
        status: data.status,
        publishedAt: data.publishedAt,
      });
    } else {
      const doc = YAML.parse(source);
      series.push({
        path,
        sha,
        source,
        slug: doc.slug,
        sections: doc.sections,
      });
    }
  }
  return { revision, posts, series };
};
const db = new DatabaseSync(join(dir, 'queue.sqlite'));
for (const file of (await readdir(join(root, 'apps/admin-worker/migrations'))).sort())
  db.exec(await readFile(join(root, 'apps/admin-worker/migrations', file), 'utf8'));
const store = new D1ReleaseStore({
  prepare(sql) {
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
});
let now = '2026-10-07T10:00:00Z';
const queue = new ReleaseQueue(store, () => now, true);
const initial = await snapshot();
await queue.ingest(initial);
const originals = initial.posts
  .filter((p) => p.slug.startsWith('ithome-2026-'))
  .map((p) => ({
    slug: p.slug,
    hash: createHash('sha256')
      .update(p.source.split(/\n---\n/)[1] ?? '')
      .digest('hex'),
  }));
now = '2026-10-07T23:07:00Z';
let writes = 0;
const server = createServer(async (req, res) => {
  try {
    const path = join(dir, 'dist', req.url!.replace(/^\/gcake-dev\//, ''), req.url!.endsWith('/') ? 'index.html' : '');
    const bytes = await readFile(path);
    res.writeHead(200, {
      'Content-Type': req.url!.endsWith('.xml') ? 'application/xml' : 'text/html',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const address = server.address() as { port: number };
// Keep real generated canonical URLs while transporting requests only to loopback.
const localFetch: typeof fetch = (input, init) => {
  const url = new URL(String(input));
  return fetch('http://127.0.0.1:' + address.port + url.pathname, init);
};
const delivery = new ReleaseDelivery(
  queue,
  {
    snapshot,
    async save(input) {
      assert.equal(git('rev-parse', 'HEAD'), input.expectedBaseCommitSha);
      for (const f of input.files) assert.equal(git('rev-parse', input.expectedBaseCommitSha + ':' + f.path), f.expectedBlobSha);
      for (const f of input.files) await writeFile(join(dir, f.path), f.source);
      git('add', '--', ...input.files.map((f) => f.path));
      git('commit', '--quiet', '-m', input.message);
      writes++;
      return {
        commitSha: git('rev-parse', 'HEAD'),
        paths: input.files.map((f) => f.path),
      };
    },
    deployment: async () => ({
      state: 'deployed',
      commitSha: git('rev-parse', 'HEAD'),
      startedAt: now,
      completedAt: now,
    }),
  },
  true,
  localFetch,
);
try {
  const release = await delivery.execute();
  assert.ok(release);
  assert.equal(release.state, 'awaiting-verification');
  assert.equal(writes, 1);
  execFileSync('pnpm', ['build'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const verified = await delivery.reverify(release.id);
  assert.equal(verified.state, 'verified-public');
  assert.ok(verified.rssGuid);
  assert.ok(verified.pageVerifiedAt);
  assert.equal(await delivery.execute(), undefined);
  assert.equal(writes, 1);
  const current = await snapshot();
  for (const p of originals) {
    const source = current.posts.find((x) => x.slug === p.slug)!.source;
    assert.equal(
      createHash('sha256')
        .update(source.split(/\n---\n/)[1] ?? '')
        .digest('hex'),
      p.hash,
    );
  }
  assert.deepEqual(
    current.series.find((s) => s.slug === 'ithome-2026-extensions')!.sections.flatMap((s) => s.posts.map((p) => p.slug)),
    initial.series.find((s) => s.slug === 'ithome-2026-extensions')!.sections.flatMap((s) => s.posts.map((p) => p.slug)),
  );
  const rss = await readFile(join(dir, 'dist/rss.xml'), 'utf8');
  const item = release.slug;
  // Isolate the one newly released RSS item for the send/restart simulation.
  const newItem = [...rss.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/g)].find((m) => m[0].includes('/posts/' + item + '/'))![0];
  const notifyScript = `import sys\nsys.path.insert(0,${JSON.stringify(join(root, 'scripts/hermes'))})\nfrom rss_poller import Poller\nfrom pathlib import Path\nsent=[]\nstate=Path(${JSON.stringify(join(dir, 'hermes-state.json'))})\npage=Path(${JSON.stringify(join(dir, 'dist/posts', item, 'index.html'))}).read_text()\nbase='https://gcake119.github.io/gcake-dev/'\nPoller(state,base,lambda u:page,lambda m:sent.append(m)).poll('<rss><channel/></rss>')\nfeed=${JSON.stringify('<rss><channel>' + newItem + '</channel></rss>')}\nPoller(state,base,lambda u:page,lambda m:sent.append(m)).poll(feed)\nPoller(state,base,lambda u:page,lambda m:sent.append(m)).poll(feed)\nassert len(sent)==1, sent\nprint('notification sends=1 across restart')\n`;
  await writeFile(join(dir, 'simulate-notification.py'), notifyScript);
  execFileSync('python3', [join(dir, 'simulate-notification.py')], {
    stdio: 'inherit',
  });
  const report = {
    mode: 'local-simulation',
    directory: dir,
    releaseId: release.id,
    slug: release.slug,
    gitCommit: verified.commitSha,
    bodyAndOrderPreserved: true,
    page: true,
    rssGuid: verified.rssGuid,
    notification: 'simulated-once-across-restart',
    productionEnabled: false,
  };
  await writeFile(join(dir, 'evidence.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.close();
  db.close();
}
