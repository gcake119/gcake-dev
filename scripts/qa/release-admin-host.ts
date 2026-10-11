/** Disposable, loopback-only Admin QA host. Git save mutates memory only. */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { ReleaseQueue, D1ReleaseStore, type ReleaseSnapshot } from '../../apps/admin-worker/src/release-queue';
import { ReleaseDelivery } from '../../apps/admin-worker/src/release-delivery';
import { releaseApi } from '../../apps/admin-worker/src/release-api';
const root = resolve('.');
const files: { path: string; sha: string; source: string }[] = [];
async function collect(dir: string) {
  for (const name of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = dir + '/' + name.name;
    if (name.isDirectory()) await collect(path);
    else if (/\.(mdx?|ya?ml)$/.test(path)) {
      const source = await readFile(join(root, path), 'utf8');
      files.push({ path, sha: createHash('sha256').update(source).digest('hex'), source });
    }
  }
}
await collect('src/content/posts');
await collect('src/content/series');
if (process.argv.includes('--demo')) {
  const source = '---\ntitle: 本機驗收文章（不會正式發布）\ndescription: 供人工驗收定稿與排程使用的獨立草稿。\nstatus: draft\ntopics:\n  - development-automation\n---\n\n這是一篇只存在於本機記憶體的驗收草稿。\n\n你可以確認定稿、暫停／恢復，並預覽指定時段。\n';
  files.unshift({ path: 'src/content/posts/release-acceptance-demo.md', source, sha: createHash('sha256').update(source).digest('hex') });
}
let revision = 'qa-revision-1';
function snapshot(): ReleaseSnapshot {
  const posts: ReleaseSnapshot['posts'] = [],
    series: ReleaseSnapshot['series'] = [];
  for (const file of files) {
    if (file.path.startsWith('src/content/posts')) {
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(file.source);
      const data = YAML.parse(match![1]);
      posts.push({
        ...file,
        slug: file.path
          .split('/')
          .pop()!
          .replace(/\.mdx?$/, ''),
        title: data.title,
        status: data.status,
        publishedAt: data.publishedAt,
      });
    } else {
      const doc = YAML.parse(file.source);
      series.push({ ...file, slug: doc.slug, sections: doc.sections });
    }
  }
  return { revision, posts, series };
}
const db = new DatabaseSync(':memory:');
db.exec(await readFile(join(root, 'apps/admin-worker/migrations/0006_release_queue.sql'), 'utf8'));
const store = new D1ReleaseStore({
  prepare(sql) {
    let v: any[] = [];
    return {
      bind(...values: any[]) {
        v = values;
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
const queue = new ReleaseQueue(store);
const delivery = new ReleaseDelivery(queue, {
  snapshot: async () => snapshot(),
  async save(input) {
    if (input.expectedBaseCommitSha !== revision) throw new Error('GIT_CONFLICT');
    for (const change of input.files) {
      const file = files.find((f) => f.path === change.path)!;
      file.source = change.source;
      file.sha = createHash('sha256').update(change.source).digest('hex');
    }
    revision += '-saved';
    return { commitSha: revision, paths: input.files.map((f) => f.path) };
  },
});
const session = {
  id: 'qa-session',
  tokenHash: 'qa-only',
  user: { githubUserId: 'qa-owner', login: '本機驗收' },
  csrfToken: 'qa-only',
  expiresAt: Date.now() + 86400000,
};
let outage = false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, 'http://127.0.0.1:4319');
    let result: unknown;
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    } else if (url.pathname === '/qa/outage') {
      outage = url.searchParams.get('on') === '1';
      result = { outage };
    } else if (url.pathname === '/api/v1/auth/session') result = { authenticated: true, user: session.user, csrfToken: session.csrfToken };
    else if (url.pathname === '/api/v1/posts') {
      const s = snapshot();
      result = {
        posts: s.posts.map((p) => ({
          ...p,
          blobSha: p.sha,
          commitSha: s.revision,
          series: s.series
            .filter((m) => m.sections.some((sec) => sec.posts.some((p1) => p1.slug === p.slug)))
            .map((m) => ({ slug: m.slug, title: YAML.parse(m.source).title, sectionId: 'extensions', position: 0 })),
        })),
      };
    } else if (url.pathname === '/api/v1/series') {
      const s = snapshot();
      result = { series: s.series.map((m) => ({ ...m, baseBlobSha: m.sha, baseCommitSha: s.revision })) };
    } else if (url.pathname === '/api/v1/github/deployments/latest') result = {};
    else if (url.pathname.startsWith('/api/v1/posts/')) {
      const s = snapshot();
      const p = s.posts.find((p) => p.slug === url.pathname.split('/').pop());
      if (!p) throw new Error('not found');
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(p.source)!;
      result = {
        ...p,
        frontmatter: YAML.parse(match[1]),
        body: p.source.slice(match[0].length),
        baseBlobSha: p.sha,
        baseCommitSha: s.revision,
        series: s.series
          .filter((m) => m.sections.some((sec) => sec.posts.some((p1) => p1.slug === p.slug)))
          .map((m) => ({ slug: m.slug, title: YAML.parse(m.source).title, sectionId: 'extensions', position: 0 })),
      };
    } else if (url.pathname.startsWith('/api/v1/series/')) {
      const s = snapshot();
      const m = s.series.find((m) => m.slug === url.pathname.split('/').pop())!;
      result = { ...m, baseBlobSha: m.sha, baseCommitSha: s.revision };
    } else if (url.pathname.startsWith('/api/v1/publications/')) result = { states: [] };
    else if (url.pathname.startsWith('/api/v1/releases')) {
      if (outage) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: '本機驗收：佇列暫時無法載入。' } }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      const response = await releaseApi(
        new Request(url, { method: req.method, headers: req.headers as any, ...(body ? { body } : {}) }),
        delivery,
        session,
      );
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(await response.text());
      return;
    } else {
      const path = join(root, 'apps/admin/dist', url.pathname === '/' ? 'index.html' : url.pathname);
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' });
      res.end(path.endsWith('index.html') ? data.toString().replace('<body>', '<body><aside style="padding:12px 20px;background:#fff3cd;color:#493b00;font:16px/1.6 system-ui;text-align:center" role="note">本機驗收模式：所有儲存只更新記憶體，不會提交 Git；正式發布停用。重新啟動會清空操作。</aside>') : data);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: '本機驗收資料無法載入。' } }));
  }
});
server.listen(4319, '127.0.0.1', () => console.log('Local mock Admin: http://127.0.0.1:4319 (production disabled; writes memory only)'));
