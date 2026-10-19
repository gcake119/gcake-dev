import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import matter from 'gray-matter';
import YAML from 'yaml';
import {listLocalPostFiles} from '../../src/lib/content/local-posts';
import {createPortablePublication} from '../../src/lib/publishing/publication-transform';
import {collectReleaseEligibility} from '../../packages/publishing-contract/src/release-eligibility';
import {openFixedSnapshot} from './distribution-inventory';
import {renderedArticle} from './substack-browser';
import type {DistributionArticle} from '../../apps/admin-worker/src/distribution-coordinator';
export interface ScheduledSource {slug:string;sourcePath:string;sourceCommit:string;sourceRevision:string;seriesSlug?:string;article:DistributionArticle}
export async function buildScheduledSource(root:string,slug:string,fetcher:typeof fetch=fetch):Promise<ScheduledSource>{
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('SUBSTACK_SOURCE_INVALID');
 const sourceCommit=await openFixedSnapshot(root);
 const files=await listLocalPostFiles(path.join(root,'src/content/posts'));
 const seen=new Set<string>();for(const f of files){if(seen.has(f.slug))throw Error('SUBSTACK_SOURCE_DUPLICATE_SLUG');seen.add(f.slug);}
 const file=files.find(f=>f.slug===slug);if(!file||!file.path.endsWith('.md'))throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');
 const entries=await Promise.all(files.map(async f=>({file:f,raw:await fs.readFile(f.path,'utf8')})));
 const posts=entries.map(e=>({slug:e.file.slug,status:matter(e.raw).data.status,readyAt:'snapshot-validated'}));
 const seriesRoot=path.join(root,'src/content/series');
 const names=await fs.readdir(seriesRoot).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [];throw e;});
 const manifests=await Promise.all(names.filter(n=>/\.ya?ml$/.test(n)).map(async n=>YAML.parse(await fs.readFile(path.join(seriesRoot,n),'utf8'))));
 const eligibility=collectReleaseEligibility(posts,manifests.map(m=>({...m,paused:m.status==='paused'||m.publication?.status==='paused',external:m.source?.type==='external'})));
 if(eligibility.blockedSeries.some(b=>manifests.find(m=>m.slug===b.seriesSlug)?.sections.some((s:{posts:{slug:string}[]})=>s.posts.some(p=>p.slug===slug))))throw Error('SUBSTACK_SOURCE_SERIES_INCOMPLETE');
 const raw=entries.find(e=>e.file.slug===slug)!.raw,status=matter(raw).data.status;
 if(!['ready','published'].includes(status))throw Error('SUBSTACK_SOURCE_NOT_FINALIZED');
 const sourceRevision='sha256:'+createHash('sha256').update(raw).digest('hex');
 const p=createPortablePublication({slug,source:raw,sourceRevision});
 if(p.distributionMode!=='full')throw Error('SUBSTACK_UNSUPPORTED_CONTENT');
 const article:DistributionArticle={slug,sourceRevision,title:p.title,description:p.description,body:p.body,canonicalUrl:p.canonicalUrl,assets:p.assets,substackDatePrecision:'minute',publishedAt:p.publishedAt};
 const rendered=renderedArticle(article);
 await Promise.all(rendered.images.map(async i=>{if(!i.src.startsWith('https://'))throw Error('SUBSTACK_SOURCE_MEDIA_UNAVAILABLE');const r=await fetcher(i.src,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('SUBSTACK_SOURCE_MEDIA_UNAVAILABLE');await r.body?.cancel();}));
 if(await openFixedSnapshot(root)!==sourceCommit)throw Error('SUBSTACK_SOURCE_CHANGED');
 const seriesSlug=manifests.find(m=>m.sections.some((s:{posts:{slug:string}[]})=>s.posts.some(p=>p.slug===slug)))?.slug;
 return {slug,seriesSlug,sourcePath:path.relative(root,file.path),sourceCommit,sourceRevision,article};
}

/** Independent Pages evidence; never an authorization prerequisite for Substack. */
export async function observeScheduledOriginal(root:string,source:ScheduledSource){
 const {buildDistributionBundle}=await import('./prepare-distribution');const {assertPagesPublication}=await import('./pages-publication');
 try{const bundle=await buildDistributionBundle(source.slug,path.join(root,'src/content/posts'));if(bundle.sourceRevision!==source.sourceRevision)return {status:'mismatch' as const};const proof=await assertPagesPublication(bundle);return {status:'verified' as const,publishedAt:proof.publishedAt};}
 catch(error){const code=error instanceof Error?error.message:'';return {status:code.includes('UNPUBLISHED_POST')?'not_published' as const:code.includes('EVIDENCE')||code.includes('SOURCE_INVALID')?'mismatch' as const:'unavailable' as const};}
}
