import type { DeploymentObservation, PostSource, PostSummary, SaveContentRequest, SeriesSource } from '@gcake/admin-contract';
import YAML from 'yaml';
import type { ReleaseSnapshot } from './release-queue.js';
import {
  RepositoryConflictError,
  deletePost as deleteRepositoryPost,
  renamePost as renameRepositoryPost,
  saveRepositoryTransaction,
  type GitWriteRepository,
  type RepositoryCommit,
  type RepositoryFile,
  type RepositoryTransaction,
} from './git-writes.js';

const repositoryPath = '/repos/gcake119/gcake-dev';

export const GITHUB_APP_PERMISSIONS = Object.freeze({
  repository: 'gcake119/gcake-dev',
  metadata: 'read',
  contents: 'read-write',
  actions: 'read',
  actionsWrite: false,
} as const);

export interface InstallationTokenProvider {
  create(): Promise<string>;
}
export interface GitHubRepository {
  readonly fullName: 'gcake119/gcake-dev';
  readonly defaultBranch: string;
  readonly private: boolean;
}
export interface GitHubAppInstallationTokenProviderOptions {
  readonly appId: string;
  readonly installationId: string;
  readonly privateKey: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}
export interface GitHubAppReadClientOptions {
  readonly installationTokens: InstallationTokenProvider;
  readonly fetch?: typeof fetch;
}
export type GitHubAppWriteClientOptions = GitHubAppReadClientOptions;
type GitTreeEntry = {
  readonly path: string;
  readonly type: string;
  readonly sha: string;
};
type RepositorySnapshot = {
  readonly commitSha: string;
  readonly tree: readonly GitTreeEntry[];
};

type SeriesMembership = PostSummary['series'][number];

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function der(tag: number, value: Uint8Array): Uint8Array {
  const lengthBytes: number[] = [];
  for (let length = value.length; length > 0; length >>>= 8) lengthBytes.unshift(length & 0xff);
  const length = value.length < 128 ? [value.length] : [0x80 | lengthBytes.length, ...lengthBytes];
  return Uint8Array.from([tag, ...length, ...value]);
}

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = Uint8Array.from([0x02, 0x01, 0x00]);
  const rsaEncryption = Uint8Array.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  return der(0x30, Uint8Array.from([...version, ...rsaEncryption, ...der(0x04, pkcs1)]));
}

function privateKeyBytes(pem: string): Uint8Array {
  const isPkcs1 = pem.includes('-----BEGIN RSA PRIVATE KEY-----');
  const base64 = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\s/g, '');
  if (!base64) throw new Error('GITHUB_APP_PRIVATE_KEY_INVALID');
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return isPkcs1 ? pkcs1ToPkcs8(bytes) : bytes;
}

async function createAppJwt(appId: string, privateKey: string, now: number): Promise<string> {
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 600, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes(privateKey).buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

export class GitHubAppInstallationTokenProvider implements InstallationTokenProvider {
  readonly #options: GitHubAppInstallationTokenProviderOptions;
  readonly #fetch: typeof fetch;
  #cached?: { readonly token: string; readonly expiresAt: number };
  constructor(options: GitHubAppInstallationTokenProviderOptions) {
    this.#options = options;
    this.#fetch = options.fetch ?? fetch;
  }
  async create(): Promise<string> {
    const now = (this.#options.now ?? Date.now)();
    if (this.#cached && this.#cached.expiresAt > now + 60_000) return this.#cached.token;
    const jwt = await createAppJwt(this.#options.appId, this.#options.privateKey, now);
    const response = await this.#fetch(
      `https://api.github.com/app/installations/${encodeURIComponent(this.#options.installationId)}/access_tokens`,
      {
        method: 'POST',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${jwt}`,
          'user-agent': 'gcake-admin-worker',
          'x-github-api-version': '2022-11-28',
        },
      },
    );
    const payload = (await response.json()) as {
      token?: unknown;
      expires_at?: unknown;
    };
    if (!response.ok || typeof payload.token !== 'string') {
      throw new Error(`GITHUB_API_FAILED: installation token HTTP ${response.status}`);
    }
    const expiresAt = typeof payload.expires_at === 'string' ? Date.parse(payload.expires_at) : Number.NaN;
    if (Number.isFinite(expiresAt)) this.#cached = { token: payload.token, expiresAt };
    return payload.token;
  }
}

function splitFrontmatter(source: string): {
  frontmatter: Readonly<Record<string, unknown>>;
  body: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: source };
  const value = YAML.parse(match[1] ?? '') as unknown;
  return {
    frontmatter: value && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {},
    body: match[2] ?? '',
  };
}

function slugFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.(mdx?|ya?ml)$/i, '');
}

export class GitHubAppReadClient {
  readonly #installationTokens: InstallationTokenProvider;
  readonly #fetch: typeof fetch;
  constructor(options: GitHubAppReadClientOptions) {
    this.#installationTokens = options.installationTokens;
    this.#fetch = options.fetch ?? fetch;
  }
  async #get(path: string): Promise<unknown> {
    const installationToken = await this.#installationTokens.create();
    const response = await this.#fetch(`https://api.github.com${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${installationToken}`,
        'user-agent': 'gcake-admin-worker',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GITHUB_API_FAILED: GitHub returned HTTP ${response.status}`);
    return response.json();
  }
  private repositoryRead?: Promise<GitHubRepository>;
  private treeReads=new Map<string,Promise<GitTreeEntry[]>>();
  private blobReads=new Map<string,Promise<string>>();
  async getRepository():Promise<GitHubRepository> {return this.repositoryRead??=this.readRepository();}
  private async readRepository(): Promise<GitHubRepository> {
    const value = (await this.#get(repositoryPath)) as {
      full_name?: unknown;
      default_branch?: unknown;
      private?: unknown;
    };
    if (value.full_name !== 'gcake119/gcake-dev' || typeof value.default_branch !== 'string' || typeof value.private !== 'boolean') {
      throw new Error('GITHUB_API_FAILED: Unexpected repository response');
    }
    return {
      fullName: value.full_name,
      defaultBranch: value.default_branch,
      private: value.private,
    };
  }
  async #snapshot(): Promise<RepositorySnapshot> {
    const repository = await this.getRepository();
    const branch = (await this.#get(`${repositoryPath}/branches/${encodeURIComponent(repository.defaultBranch)}`)) as {
      commit?: { sha?: unknown; commit?: { tree?: { sha?: unknown } } };
    };
    const commitSha = branch.commit?.sha;
    const treeSha = branch.commit?.commit?.tree?.sha;
    if (typeof commitSha !== 'string' || typeof treeSha !== 'string') {
      throw new Error('GITHUB_API_FAILED: Unexpected branch response');
    }
    let treeRead=this.treeReads.get(treeSha);
    if(!treeRead) {
      treeRead=(async()=> {
        const tree=await this.#get(`${repositoryPath}/git/trees/${treeSha}?recursive=1`) as {tree?:unknown;truncated?:boolean};
        if(tree.truncated || !Array.isArray(tree.tree))throw new Error('GITHUB_API_FAILED: Unexpected tree response');
        return tree.tree.filter((entry):entry is GitTreeEntry=> {
          if(!entry || typeof entry!=='object')return false;const value=entry as Record<string,unknown>;
          return typeof value.path==='string' && typeof value.type==='string' && typeof value.sha==='string';
        });
      })();this.treeReads.set(treeSha,treeRead);
    }
    return {commitSha,tree:await treeRead};
  }
  async #readBlob(sha:string):Promise<string> {
    let pending=this.blobReads.get(sha);
    if(!pending) {
      pending=(async()=> {
        const blob=await this.#get(`${repositoryPath}/git/blobs/${sha}`) as {content?:unknown;encoding?:unknown};
        if(blob.encoding!=='base64' || typeof blob.content!=='string')throw new Error('GITHUB_API_FAILED: Unexpected blob response');
        return decodeBase64(blob.content);
      })();this.blobReads.set(sha,pending);
    }
    return pending;
  }
  async #seriesMemberships(snapshot: RepositorySnapshot): Promise<Map<string, SeriesMembership[]>> {
    const memberships = new Map<string, SeriesMembership[]>();
    const entries = snapshot.tree.filter((entry) => entry.type === 'blob' && /^src\/content\/series\/[^/]+\.ya?ml$/.test(entry.path));
    await Promise.all(
      entries.map(async (entry) => {
        const manifest = YAML.parse(await this.#readBlob(entry.sha)) as {
          slug?: unknown;
          title?: unknown;
          sections?: Array<{ id?: unknown; posts?: Array<{ slug?: unknown }> }>;
        };
        if (typeof manifest.slug !== 'string' || typeof manifest.title !== 'string') return;
        for (const section of manifest.sections ?? []) {
          if (typeof section.id !== 'string') continue;
          for (const [position, post] of (section.posts ?? []).entries()) {
            if (typeof post.slug !== 'string') continue;
            const current = memberships.get(post.slug) ?? [];
            current.push({
              slug: manifest.slug,
              title: manifest.title,
              sectionId: section.id,
              position,
            });
            memberships.set(post.slug, current);
          }
        }
      }),
    );
    return memberships;
  }
  private historyPaths: string[] = [];
  private batchHistory = new Map<string, {date:string; parent?:string; files:Map<string,string|undefined>}>();
  /** One read-only query returns 10 exact first-parent snapshots for all eligible files. */
  private async historyBatch(sha:string) {
    const fields=this.historyPaths.map((path,i)=>`f${i}: file(path:${JSON.stringify(path)}) { object { __typename ... on Blob { text } } }`).join(' ');
    let selection='oid';
    for(let i=0;i<10;i++) selection=`oid committedDate ${fields} parents(first:1) { nodes { ${selection} } }`;
    const token=await this.#installationTokens.create();
    const response=await this.#fetch('https://api.github.com/graphql',{
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
      headers:{authorization:`Bearer ${token}`,'content-type':'application/json','user-agent':'gcake-admin-worker'},
      body:JSON.stringify({query:`query($oid:GitObjectID!) { repository(owner:"gcake119",name:"gcake-dev") { object(oid:$oid) { ... on Commit { ${selection} } } } }`,variables:{oid:sha}}),
    });
    if(!response.ok) throw new Error(`GITHUB_API_FAILED: GitHub returned HTTP ${response.status}`);
    const reader=response.body?.getReader(); if(!reader) throw new Error('INVALID_READY_HISTORY');
    const chunks:Uint8Array[]=[];let size=0;
    for(;;) {const part=await reader.read();if(part.done)break;size+=part.value.length;
      if(size>2*1024*1024) {await reader.cancel();throw new Error('READY_HISTORY_RESPONSE_LIMIT');} chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const payload=JSON.parse(new TextDecoder().decode(bytes));
    const absentFileError=(error:any)=> {
      const path=error.path;
      if(error.type!=='NOT_FOUND' || !Array.isArray(path) || path[0]!=='repository' || path[1]!=='object' ||
        !this.historyPaths.some((_p,i)=>path.at(-1)===`f${i}`))return false;
      const ancestry=path.slice(2,-1);
      if(ancestry.length%3 || ancestry.some((part:any,i:number)=>part!==['parents','nodes',0][i%3]))return false;
      return path.reduce((value:any,key:any)=>value?.[key],payload.data)===null;
    };
    if(!payload.data?.repository?.object || (payload.errors && (!Array.isArray(payload.errors) || !payload.errors.every(absentFileError)))) {
      const errors=Array.isArray(payload.errors)?payload.errors:[];
      const allowed=new Set(['NOT_FOUND','FORBIDDEN','RATE_LIMITED','RESOURCE_LIMITS_EXCEEDED']);
      console.warn('release-history-rejected',{stage:'graphql',root:!!payload.data?.repository?.object,
        types:[...new Set(errors.map((e:any)=>allowed.has(e.type)?e.type:'UNKNOWN'))],
        depthRejected:errors.some((e:any)=>typeof e.message==='string' && e.message.startsWith('Query has depth of '))});
      throw new Error('INVALID_READY_HISTORY');
    }
    let node=payload.data.repository.object;const pending=new Map<string,{date:string;parent?:string;files:Map<string,string|undefined>}>();
    if(node.oid!==sha) throw new Error('INVALID_READY_HISTORY');
    for(let i=0;node && i<10;i++) {
      if(typeof node.oid!=='string' || !node.oid || pending.has(node.oid) || typeof node.committedDate!=='string' ||
        !Number.isFinite(Date.parse(node.committedDate)) || !Array.isArray(node.parents?.nodes) || node.parents.nodes.length>1)
        throw new Error('INVALID_READY_HISTORY');
      const files=new Map<string,string|undefined>();
      for(const [j,path] of this.historyPaths.entries()) {
        if(!Object.hasOwn(node,`f${j}`)) throw new Error('INVALID_READY_HISTORY');
        const file=node[`f${j}`];
        if(file!==null && (!file || file.object?.__typename!=='Blob' || typeof file.object.text!=='string')) {console.warn('release-history-rejected',{stage:'blob',index:j});throw new Error('INVALID_READY_HISTORY');}
        files.set(path,file?.object.text);
      }
      const parent=node.parents.nodes[0];
      if(parent && (typeof parent.oid!=='string' || !parent.oid)) throw new Error('INVALID_READY_HISTORY');
      pending.set(node.oid,{date:node.committedDate,parent:parent?.oid,files});node=parent;
    }
    // Partial/error payloads never populate the request cache.
    for(const [key,value] of pending)this.batchHistory.set(key,value);
  }
  private async batchedReadiness(path:string,revision:string,eligible:(source:string)=>boolean):Promise<string> {
    let since:string|undefined,sha:string|undefined=revision;const seen=new Set<string>();
    for(let depth=0;sha && depth<1000;depth++) {
      if(seen.has(sha))throw new Error('INVALID_READY_HISTORY');seen.add(sha);
      if(!this.batchHistory.get(sha)?.files.has(path))await this.historyBatch(sha);
      const entry:{date:string;parent?:string;files:Map<string,string|undefined>}=this.batchHistory.get(sha)!;const source=entry.files.get(path);
      if(source===undefined || !eligible(source)) {if(since)return since;throw new Error('READY_TRANSITION_NOT_FOUND');}
      since=entry.date;sha=entry.parent;
    }
    if(sha)throw new Error('READY_HISTORY_LIMIT');if(since)return since;throw new Error('READY_TRANSITION_NOT_FOUND');
  }
  /** Request-scoped cache; snapshots never mix revisions or credentials across requests. */
  private historyCommits = new Map<string, Promise<{date:string;parent?:string}>>();
  private historyCommit(sha:string) {
    let pending=this.historyCommits.get(sha);
    if(!pending) {
      pending=(async()=> {
        const commit=await this.#get(`${repositoryPath}/commits/${encodeURIComponent(sha)}`) as {
          sha?:unknown;commit?:{committer?:{date?:unknown}};parents?:{sha?:unknown}[];
        };
        if(commit.sha!==sha || typeof commit.commit?.committer?.date!=='string' ||
          !Number.isFinite(Date.parse(commit.commit.committer.date)) || !Array.isArray(commit.parents) ||
          commit.parents.some(p=>typeof p.sha!=='string')) throw new Error('INVALID_READY_HISTORY');
        return {date:commit.commit.committer.date,parent:commit.parents[0]?.sha as string|undefined};
      })();
      this.historyCommits.set(sha,pending);
    }
    return pending;
  }
  /** Walk main's visible first-parent snapshots, not feature-branch path history. */
  private async continuousReadiness(path: string, revision: string, eligible: (source: string) => boolean): Promise<string> {
    if(this.historyPaths.includes(path))return this.batchedReadiness(path,revision,eligible);
    let since:string|undefined;
    let sha:string|undefined=revision;
    const seen=new Set<string>();
    const encodedPath=path.split('/').map(encodeURIComponent).join('/');
    for(let depth=0;sha && depth<1000;depth++) {
      if(seen.has(sha)) throw new Error('INVALID_READY_HISTORY');
      seen.add(sha);
      const commit=await this.historyCommit(sha);
      // A file first created on main terminates at its first absent parent.
      let file:{encoding?:unknown;content?:unknown};
      try {file=await this.#get(`${repositoryPath}/contents/${encodedPath}?ref=${encodeURIComponent(sha)}`) as typeof file;}
      catch(error) {
        if(since && error instanceof Error && /HTTP 404$/.test(error.message)) return since;
        throw error;
      }
      if(file.encoding!=='base64' || typeof file.content!=='string') throw new Error('INVALID_READY_HISTORY');
      if(!eligible(decodeBase64(file.content))) {
        if(since) return since;
        throw new Error('READY_TRANSITION_NOT_FOUND');
      }
      since=commit.date;sha=commit.parent;
    }
    if(sha) throw new Error('READY_HISTORY_LIMIT');
    if(since) return since;
    throw new Error('READY_TRANSITION_NOT_FOUND');
  }
  async firstReadyAt(path: string, revision: string): Promise<string> {
    return this.continuousReadiness(path,revision,source=>splitFrontmatter(source).frontmatter.status==='ready');
  }
  async firstSeriesReadyAt(path: string, revision: string, order: string[]): Promise<string> {
    return this.continuousReadiness(path,revision,source=> {
      const document=YAML.parseDocument(source);
      if(document.errors.length) throw new Error('INVALID_READY_HISTORY');
      const manifest=document.toJS();
      const refs=manifest?.sections?.flatMap((s:any)=>s.posts??[]);
      return Array.isArray(refs) && refs.length>0 && manifest.publication?.status!=='paused' && manifest.status!=='paused' &&
        JSON.stringify(refs.map((p:any)=>p.slug))===JSON.stringify(order) &&
        refs.every((p:any)=>['ready','published'].includes(p.status));
    });
  }
  async releaseSnapshot(): Promise<ReleaseSnapshot> {
    const snapshot = await this.#snapshot();
    if (snapshot.tree.some(entry=>entry.path==='src/data/editorial-queue.json'))
      throw new Error('LEGACY_JOURNAL_RECONCILIATION_REQUIRED');
    const entries = snapshot.tree.filter(
      (e) => e.type === 'blob' && (/^src\/content\/posts\/.+\.mdx?$/.test(e.path) || /^src\/content\/series\/[^/]+\.ya?ml$/.test(e.path)),
    );
    const files = await Promise.all(
      entries.map(async (e) => ({
        path: e.path,
        sha: e.sha,
        source: await this.#readBlob(e.sha),
      })),
    );
    const posts: ReleaseSnapshot['posts'] = [],
      series: ReleaseSnapshot['series'] = [];
    for (const file of files) {
      if (file.path.startsWith('src/content/posts/')) {
        const { frontmatter } = splitFrontmatter(file.source);
        if (!['draft', 'ready', 'published'].includes(String(frontmatter.status)) || typeof frontmatter.title !== 'string')
          throw new Error('INVALID_SNAPSHOT');
        const publishedAt = frontmatter.publishedAt;
        if (publishedAt !== undefined && (typeof publishedAt !== 'string' || !Number.isFinite(Date.parse(publishedAt))))
          throw new Error('INVALID_SNAPSHOT');
        posts.push({
          ...file,
          slug: slugFromPath(file.path),
          title: frontmatter.title,
          status: String(frontmatter.status),
          publishedAt: publishedAt as string | undefined,
        });
      } else {
        const doc = YAML.parseDocument(file.source);
        const manifest = doc.toJS();
        if (
          doc.errors.length ||
          !manifest ||
          typeof manifest.slug !== 'string' ||
          !Array.isArray(manifest.sections) ||
          manifest.sections.some(
            (section: any) =>
              !Array.isArray(section.posts) ||
              section.posts.some((p: any) => typeof p.slug !== 'string' || !['planned', 'draft', 'ready', 'published'].includes(p.status)),
          )
        )
          throw new Error('INVALID_SNAPSHOT');
        series.push({
          ...file,
          slug: manifest.slug,
          sections: manifest.sections,
          paused: manifest.publication?.status === 'paused' || manifest.status === 'paused',
          external: manifest.source?.type === 'external',
        });
      }
    }
    this.historyPaths=[...posts.filter(p=>p.status==='ready').map(p=>p.path),...series.filter(s=>!s.paused && !s.external && s.sections.flatMap(x=>x.posts).every(ref=>['ready','published'].includes(ref.status) && posts.some(p=>p.slug===ref.slug && p.status===ref.status))).map(s=>s.path)];
    return { revision: snapshot.commitSha, posts, series, firstReadyAt: (post) => this.firstReadyAt(post.path, snapshot.commitSha),
      firstSeriesReadyAt: (series) => this.firstSeriesReadyAt(series.path, snapshot.commitSha, series.sections.flatMap(s=>s.posts.map(p=>p.slug))) };
  }
  async listPosts(): Promise<readonly PostSummary[]> {
    const snapshot = await this.#snapshot();
    const memberships = await this.#seriesMemberships(snapshot);
    const entries = snapshot.tree.filter((entry) => entry.type === 'blob' && /^src\/content\/posts\/.+\.mdx?$/.test(entry.path));
    return Promise.all(
      entries.map(async (entry) => {
        const { frontmatter } = splitFrontmatter(await this.#readBlob(entry.sha));
        return {
          slug: slugFromPath(entry.path),
          path: entry.path,
          title: typeof frontmatter.title === 'string' ? frontmatter.title : slugFromPath(entry.path),
          status: typeof frontmatter.status === 'string' ? frontmatter.status : 'draft',
          series: memberships.get(slugFromPath(entry.path)) ?? [],
          blobSha: entry.sha,
          commitSha: snapshot.commitSha,
        };
      }),
    );
  }
  async getPost(slug: string): Promise<PostSource | undefined> {
    const snapshot = await this.#snapshot();
    const memberships = await this.#seriesMemberships(snapshot);
    const entry = snapshot.tree.find(
      (candidate) =>
        candidate.type === 'blob' &&
        candidate.path.startsWith('src/content/posts/') &&
        /\.mdx?$/.test(candidate.path) &&
        slugFromPath(candidate.path) === slug,
    );
    if (!entry) return undefined;
    const source = await this.#readBlob(entry.sha);
    const { frontmatter, body } = splitFrontmatter(source);
    return {
      slug,
      path: entry.path,
      source,
      frontmatter,
      body,
      title: typeof frontmatter.title === 'string' ? frontmatter.title : slug,
      status: typeof frontmatter.status === 'string' ? frontmatter.status : 'draft',
      series: memberships.get(slug) ?? [],
      baseBlobSha: entry.sha,
      baseCommitSha: snapshot.commitSha,
    };
  }
  async listSeries(): Promise<readonly SeriesSource[]> {
    const snapshot = await this.#snapshot();
    const entries = snapshot.tree.filter((entry) => entry.type === 'blob' && /^src\/content\/series\/[^/]+\.ya?ml$/.test(entry.path));
    return Promise.all(
      entries.map(async (entry) => ({
        slug: slugFromPath(entry.path),
        path: entry.path,
        source: await this.#readBlob(entry.sha),
        baseBlobSha: entry.sha,
        baseCommitSha: snapshot.commitSha,
      })),
    );
  }
  async getSeries(slug: string): Promise<SeriesSource | undefined> {
    const snapshot = await this.#snapshot();
    const entry = snapshot.tree.find(
      (candidate) =>
        candidate.type === 'blob' && /^src\/content\/series\/[^/]+\.ya?ml$/.test(candidate.path) && slugFromPath(candidate.path) === slug,
    );
    if (!entry) return undefined;
    return {
      slug,
      path: entry.path,
      source: await this.#readBlob(entry.sha),
      baseBlobSha: entry.sha,
      baseCommitSha: snapshot.commitSha,
    };
  }
  async retryPagesDeployment(commitSha: string): Promise<void> {
    const repository = await this.getRepository();
    const payload = (await this.#get(
      `${repositoryPath}/actions/workflows/deploy-pages.yml/runs?branch=${encodeURIComponent(repository.defaultBranch)}&per_page=1`,
    )) as {
      workflow_runs?: Array<{
        id: number;
        head_sha: string;
        conclusion: string;
      }>;
    };
    const run = payload.workflow_runs?.[0];
    if (!run || run.head_sha !== commitSha || run.conclusion !== 'failure' || !Number.isSafeInteger(run.id))
      throw new Error('REVERIFY_REQUIRED');
    const token = await this.#installationTokens.create();
    const response = await this.#fetch(`https://api.github.com${repositoryPath}/actions/runs/${run.id}/rerun-failed-jobs`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: 'Bearer ' + token,
        'user-agent': 'gcake-admin-worker',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error('DEPLOYMENT_RETRY_FAILED');
  }
  async getPagesDeployment(): Promise<DeploymentObservation | undefined> {
    return this.#deployment(true);
  }
  async getLatestDeployment(): Promise<DeploymentObservation | undefined> {
    return this.#deployment(false);
  }
  async #deployment(pages: boolean): Promise<DeploymentObservation | undefined> {
    const repository = await this.getRepository();
    const payload = (await this.#get(
      `${repositoryPath}/actions/${pages ? 'workflows/deploy-pages.yml/' : ''}runs?branch=${encodeURIComponent(repository.defaultBranch)}&per_page=1`,
    )) as { workflow_runs?: unknown };
    if (!Array.isArray(payload.workflow_runs) || !payload.workflow_runs.length) return undefined;
    const run = payload.workflow_runs[0] as Record<string, unknown>;
    if (typeof run.head_sha !== 'string' || typeof run.run_started_at !== 'string') {
      throw new Error('GITHUB_API_FAILED: Unexpected Actions response');
    }
    const state: DeploymentObservation['state'] =
      run.status !== 'completed'
        ? run.status === 'queued' || run.status === 'waiting' || run.status === 'pending'
          ? 'pending'
          : 'building'
        : run.conclusion === 'success'
          ? 'deployed'
          : 'failed';
    return {
      state,
      commitSha: run.head_sha,
      startedAt: run.run_started_at,
      ...(typeof run.updated_at === 'string' && run.status === 'completed' ? { completedAt: run.updated_at } : {}),
      ...(typeof run.html_url === 'string' ? { url: run.html_url } : {}),
    };
  }
}

class GitHubGitRepository implements GitWriteRepository {
  readonly #installationTokens: InstallationTokenProvider;
  readonly #fetch: typeof fetch;
  #defaultBranch?: string;

  constructor(options: GitHubAppWriteClientOptions) {
    this.#installationTokens = options.installationTokens;
    this.#fetch = options.fetch ?? fetch;
  }

  async #request(path: string, init: RequestInit = {}): Promise<Response> {
    const installationToken = await this.#installationTokens.create();
    return this.#fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${installationToken}`,
        'content-type': 'application/json',
        'user-agent': 'gcake-admin-worker',
        'x-github-api-version': '2022-11-28',
        ...init.headers,
      },
    });
  }

  async #branch(): Promise<string> {
    if (this.#defaultBranch) return this.#defaultBranch;
    const response = await this.#request(repositoryPath, { method: 'GET' });
    const value = (await response.json()) as {
      full_name?: unknown;
      default_branch?: unknown;
    };
    if (!response.ok || value.full_name !== 'gcake119/gcake-dev' || typeof value.default_branch !== 'string') {
      throw new Error(`GITHUB_API_FAILED: repository HTTP ${response.status}`);
    }
    this.#defaultBranch = value.default_branch;
    return value.default_branch;
  }

  async currentCommitSha(): Promise<string> {
    const branch = await this.#branch();
    const response = await this.#request(`${repositoryPath}/branches/${encodeURIComponent(branch)}`, { method: 'GET' });
    const value = (await response.json()) as { commit?: { sha?: unknown } };
    if (!response.ok || typeof value.commit?.sha !== 'string') {
      throw new Error(`GITHUB_API_FAILED: branch HTTP ${response.status}`);
    }
    return value.commit.sha;
  }

  async getFile(path: string): Promise<RepositoryFile | undefined> {
    const branch = await this.#branch();
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await this.#request(`${repositoryPath}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, { method: 'GET' });
    if (response.status === 404) return undefined;
    const value = (await response.json()) as {
      sha?: unknown;
      content?: unknown;
      encoding?: unknown;
    };
    if (!response.ok || typeof value.sha !== 'string' || value.encoding !== 'base64' || typeof value.content !== 'string') {
      throw new Error(`GITHUB_API_FAILED: content HTTP ${response.status}`);
    }
    return { sha: value.sha, content: decodeBase64(value.content) };
  }

  async commit(transaction: RepositoryTransaction): Promise<RepositoryCommit> {
    const branch = await this.#branch();
    const baseResponse = await this.#request(`${repositoryPath}/git/commits/${transaction.expectedBaseCommitSha}`, { method: 'GET' });
    const base = (await baseResponse.json()) as { tree?: { sha?: unknown } };
    if (!baseResponse.ok || typeof base.tree?.sha !== 'string') {
      throw new Error(`GITHUB_API_FAILED: base commit HTTP ${baseResponse.status}`);
    }
    const treeEntries = await Promise.all(
      transaction.changes.map(async (change) => {
        if (change.content === undefined) {
          return { path: change.path, mode: '100644', type: 'blob', sha: null };
        }
        const blobResponse = await this.#request(`${repositoryPath}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({
            content: change.content,
            encoding: 'utf-8',
          }),
        });
        const blob = (await blobResponse.json()) as { sha?: unknown };
        if (!blobResponse.ok || typeof blob.sha !== 'string') {
          throw new Error(`GITHUB_API_FAILED: blob HTTP ${blobResponse.status}`);
        }
        return {
          path: change.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        };
      }),
    );
    const treeResponse = await this.#request(`${repositoryPath}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: base.tree.sha, tree: treeEntries }),
    });
    const tree = (await treeResponse.json()) as { sha?: unknown };
    if (!treeResponse.ok || typeof tree.sha !== 'string') throw new Error(`GITHUB_API_FAILED: tree HTTP ${treeResponse.status}`);
    const commitResponse = await this.#request(`${repositoryPath}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: transaction.message,
        tree: tree.sha,
        parents: [transaction.expectedBaseCommitSha],
      }),
    });
    const commit = (await commitResponse.json()) as { sha?: unknown };
    if (!commitResponse.ok || typeof commit.sha !== 'string') throw new Error(`GITHUB_API_FAILED: commit HTTP ${commitResponse.status}`);
    const refResponse = await this.#request(`${repositoryPath}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (!refResponse.ok) {
      if (refResponse.status === 409 || refResponse.status === 422) {
        const currentCommitSha = await this.currentCommitSha();
        const first = transaction.changes[0];
        throw new RepositoryConflictError(
          first?.path.includes('/series/') ? 'SERIES_CONFLICT' : 'ARTICLE_CONFLICT',
          first?.path ?? '',
          first?.expectedBlobSha,
          first ? (await this.getFile(first.path))?.sha : undefined,
          currentCommitSha,
        );
      }
      throw new Error(`GITHUB_API_FAILED: ref HTTP ${refResponse.status}`);
    }
    return {
      sha: commit.sha,
      message: transaction.message,
      paths: transaction.changes.map((change) => change.path),
    };
  }
}

function seriesReferencesSlug(source: string, slug: string): boolean {
  const manifest = YAML.parse(source) as {
    sections?: Array<{ posts?: Array<{ slug?: unknown }> }>;
    editorial?: { currentPost?: unknown; nextPost?: unknown };
  };
  return (
    (manifest.sections ?? []).some((section) => (section.posts ?? []).some((post) => post.slug === slug)) ||
    manifest.editorial?.currentPost === slug ||
    manifest.editorial?.nextPost === slug
  );
}

export class GitHubAppWriteClient {
  readonly #repository: GitWriteRepository;
  readonly #reader: GitHubAppReadClient;

  constructor(options: GitHubAppWriteClientOptions) {
    this.#repository = new GitHubGitRepository(options);
    this.#reader = new GitHubAppReadClient(options);
  }

  async save(request: SaveContentRequest): Promise<{
    readonly commitSha: string;
    readonly paths: readonly string[];
  }> {
    const commit = await saveRepositoryTransaction(this.#repository, {
      expectedBaseCommitSha: request.expectedBaseCommitSha,
      message: request.message,
      changes: request.files.map((file) => ({
        path: file.path,
        expectedBlobSha: file.expectedBlobSha,
        content: file.source,
      })),
    });
    return { commitSha: commit.sha, paths: commit.paths };
  }

  async renamePost(input: {
    readonly slug: string;
    readonly newSlug: string;
    readonly source: string;
    readonly expectedBlobSha: string;
    readonly expectedBaseCommitSha: string;
  }): Promise<{
    readonly commitSha: string;
    readonly paths: readonly string[];
  }> {
    const [series, post] = await Promise.all([this.#reader.listSeries(), this.#reader.getPost(input.slug)]);
    const commit = await renameRepositoryPost(this.#repository, {
      oldSlug: input.slug,
      newSlug: input.newSlug,
      source: input.source,
      expectedBlobSha: input.expectedBlobSha,
      expectedBaseCommitSha: input.expectedBaseCommitSha,
      oldPath: post?.path,
      seriesFiles: series.map((item) => ({
        path: item.path,
        expectedBlobSha: item.baseBlobSha,
        source: item.source,
      })),
    });
    return { commitSha: commit.sha, paths: commit.paths };
  }

  async deletePost(input: {
    readonly slug: string;
    readonly expectedBlobSha: string;
    readonly expectedBaseCommitSha: string;
    readonly confirmed: boolean;
  }): Promise<
    | { readonly kind: 'deleted'; readonly commitSha: string }
    | { readonly kind: 'confirmation-required' }
    | { readonly kind: 'blocked'; readonly seriesReferences: readonly string[] }
  > {
    if (!input.confirmed) return { kind: 'confirmation-required' };
    const [series, post] = await Promise.all([this.#reader.listSeries(), this.#reader.getPost(input.slug)]);
    const references = series.filter((item) => seriesReferencesSlug(item.source, input.slug)).map((item) => item.slug);
    const result = await deleteRepositoryPost(this.#repository, {
      path: post?.path ?? `src/content/posts/${input.slug}.md`,
      expectedBlobSha: input.expectedBlobSha,
      expectedBaseCommitSha: input.expectedBaseCommitSha,
      confirmed: true,
      seriesReferences: references,
    });
    return result.kind === 'deleted' ? { kind: 'deleted', commitSha: result.commit.sha } : result;
  }
}
