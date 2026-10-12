/** Local only: copies source, writes ephemeral Git/SQLite and builds real Astro. */
import { mkdtemp, cp, symlink, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
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
// Fixture lifecycle belongs only to this copy. Preserve Markdown suffix byte-for-byte.
const seriesFile=join(dir,'src/content/series/ithome-2026-extensions.yaml');
const seriesDocument=YAML.parseDocument(await readFile(seriesFile,'utf8'));
const fixtureSeries=seriesDocument.toJS();
const order:string[]=fixtureSeries.sections.flatMap((s:any)=>s.posts.map((p:any)=>p.slug));
assert.equal(order.length,6);
const files=async(directory:string):Promise<string[]>=>{
 const result:string[]=[];
 for(const item of await readdir(directory,{withFileTypes:true})) {
  if(item.isDirectory())result.push(...await files(join(directory,item.name)));
  else if(/\.mdx?$/.test(item.name))result.push(join(directory,item.name));
 }
 return result;
};
const bodies=new Map<string,string>();
for(const file of await files(join(dir,'src/content/posts'))) {
 const raw=await readFile(file,'utf8');const m=/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(raw)!;
 bodies.set(file,raw.slice(m[0].length));
 const slug=file.split('/').pop()!.replace(/\.mdx?$/,'');
 if(order.includes(slug)) {
  const doc=YAML.parseDocument(m[2]);doc.set('status','ready');doc.delete('publishedAt');
  await writeFile(file,m[1]+doc.toString().trimEnd()+m[3]+raw.slice(m[0].length));
 }
}
const sections=seriesDocument.get('sections',true) as YAML.YAMLSeq;
for(const section of sections.items as YAML.YAMLMap[])
 for(const post of (section.get('posts',true) as unknown as YAML.YAMLSeq).items as YAML.YAMLMap[])post.set('status','ready');
await writeFile(seriesFile,seriesDocument.toString());
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
for(const p of initial.posts.filter(p=>p.status==='ready' && !order.includes(p.slug)))
 await queue.control(initial,{action:'pause',slug:p.slug});
now = '2026-10-07T23:07:00Z';
let writes = 0;
const mockMessages:{chat_id:string;text:string}[]=[];
const server = createServer(async (req, res) => {
  try {
    if(req.method==='POST' && req.url==='/bot0:TEST_ONLY/sendMessage') {
      let body='';for await(const chunk of req) {body+=chunk;assert.ok(body.length<=65536);}
      const message=JSON.parse(body);assert.equal(message.chat_id,'0');
      mockMessages.push(message);res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:true,result:{message_id:mockMessages.length}}));return;
    }
    const url=new URL(req.url??'/', 'http://127.0.0.1');
    if(!url.pathname.startsWith('/gcake-dev/')) throw new Error('outside static base');
    const relative=url.pathname.slice('/gcake-dev/'.length)+(url.pathname.endsWith('/')?'index.html':'');
    const path=resolve(dir,'dist',relative);
    if(!path.startsWith(join(dir,'dist')+'/')) throw new Error('outside dist');
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
const site='http://127.0.0.1:'+address.port+'/gcake-dev/';
const config=join(dir,'astro.config.mjs');
await writeFile(config,(await readFile(config,'utf8')).replace("site: 'https://gcake119.github.io'",`site: 'http://127.0.0.1:${address.port}'`));
const siteFile=join(dir,'src/data/site.ts');
await writeFile(siteFile,(await readFile(siteFile,'utf8')).replace("url: 'https://gcake119.github.io/gcake-dev'",`url: '${site.slice(0,-1)}'`));
const exec=promisify(execFile);
const build=()=>exec('pnpm',['build'],{cwd:dir,maxBuffer:4*1024*1024});
const python=(...args:string[])=>exec('python3',[join(dir,'scripts/hermes/rss_monitor.py'),'--site',site,...args],{
 cwd:dir,env:{...process.env,HERMES_RSS_NOTIFY_ENABLED:'false',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:''},
});
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
  fetch,
  site,
);
try {
  await build();
  const feedBefore=await (await fetch(site+'rss.xml')).text();
  for(const slug of order) {
    assert.ok(!feedBefore.includes('/posts/'+slug+'/'));
    assert.equal((await fetch(site+'posts/'+slug+'/')).status,404);
  }
  const state=join(dir,'hermes-dry.sqlite');
  assert.equal((await python('--dry-run','--db',state)).stdout.trim(),'');
  const mockArgs=['--test-delivery','--db',join(dir,'hermes-mock.sqlite'),'--telegram-api','http://127.0.0.1:'+address.port+'/'];
  await python(...mockArgs);assert.equal(mockMessages.length,0);
  const release=await delivery.execute();
  assert.ok(release);assert.equal(release.slug,order[0]);
  assert.equal(release.state,'awaiting-verification');assert.equal(writes,1);
  const postFile=join(dir,(await snapshot()).posts.find(p=>p.slug===release.slug)!.path);
  const published=await readFile(postFile,'utf8');
  assert.ok(published.includes('ai-assisted-development'));
  await writeFile(postFile,published.replace('ai-assisted-development','invalid-rehearsal-topic'));
  await assert.rejects(build,'invalid topic must fail actual Astro build');
  assert.equal((await queue.view(await snapshot())).releases[0].id,release.id);
  assert.notEqual((await queue.view(await snapshot())).releases[0].state,'verified-public');
  await writeFile(postFile,published);
  now='2026-10-11T23:07:00Z';
  assert.equal(await delivery.execute(),undefined,'failed build must not create another publication');
  assert.equal(writes,1);
  await build();
  const verified=await delivery.reverify(release.id);
  assert.equal(verified.state,'verified-public');assert.ok(verified.rssGuid);assert.ok(verified.pageVerifiedAt);
  await python('--verify-url',site+'posts/'+release.slug+'/','--revision',release.publicationDigest!);
  const notice=(await python('--dry-run','--db',state)).stdout;
  assert.ok(notice.includes(site+'posts/'+release.slug+'/'));assert.ok(notice.includes('台北發佈時間'));
  assert.equal((await python('--dry-run','--db',state)).stdout.trim(),'');
  await python(...mockArgs);assert.equal(mockMessages.length,1);
  assert.ok(mockMessages[0].text.includes(site+'posts/'+release.slug+'/'));
  await python(...mockArgs);assert.equal(mockMessages.length,1);
  const current=await snapshot();
  assert.deepEqual(current.series.find(s=>s.slug==='ithome-2026-extensions')!.sections.flatMap(s=>s.posts.map(p=>p.slug)),order);
  for(const [file,body] of bodies) {
    const raw=await readFile(file,'utf8');const m=/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(raw)!;
    assert.equal(raw.slice(m[0].length),body);
  }
  const rss=await (await fetch(site+'rss.xml')).text();
  assert.ok(rss.includes('/posts/'+release.slug+'/'));
  for(const slug of order.slice(1)) {
    assert.ok(!rss.includes('/posts/'+slug+'/'));
    assert.equal((await fetch(site+'posts/'+slug+'/')).status,404);
  }
  console.log(JSON.stringify({
    mode:'local-simulation',authority:'D1',result:'passed',releaseId:release.id,
    buildFailureRetriedSameIdentity:true,gitWrites:1,baselineReadyRoutesAbsent:6,newRSSArticles:1,
    sourceDigestVerified:true,dryRunNotifications:1,repeatNotifications:0,mockTelegramRequests:1,
    sixBodiesUnchanged:true,readingOrderUnchanged:true,productionWrites:false,telegramNetworkCalls:0,
  },null,2));
} finally {
  await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();
  await rm(dir,{recursive:true,force:true});
}
