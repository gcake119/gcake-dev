import { parseHTML } from 'linkedom';
import type { DistributionBundle } from './prepare-distribution';
import { renderedArticle } from './substack-browser';
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const sorted=(values:string[])=>JSON.stringify([...new Set(values)].sort());
/** Anonymous origin proof must precede D1 intent and every provider write. */
export async function assertPagesPublication(bundle:DistributionBundle,fetcher:typeof fetch=fetch) {
  const expectedUrl=`https://gcake119.github.io/gcake-dev/posts/${bundle.slug}/`;
  if (bundle.canonicalUrl!==expectedUrl||!bundle.publishedAt||Date.parse(bundle.publishedAt)>Date.now()) throw Error('PAGES_PUBLIC_SOURCE_INVALID');
  const response=await fetcher(expectedUrl,{redirect:'error',signal:AbortSignal.timeout(30_000),headers:{'Cache-Control':'no-cache'}});
  if (!response.ok) throw Error('PAGES_PUBLIC_HTTP_FAILED');
  const {document}=parseHTML(await response.text());
  const unique=(selector:string)=>{const nodes=document.querySelectorAll(selector);if(nodes.length!==1)throw Error('PAGES_PUBLIC_CONTROLS_AMBIGUOUS');return nodes[0];};
  const body=unique('.prose'),date=unique('.article-header .article-meta time:first-of-type').getAttribute('datetime');
  const expected=renderedArticle({slug:bundle.slug,sourceRevision:bundle.sourceRevision,title:bundle.article.title,body:bundle.sourceMarkdown,canonicalUrl:expectedUrl,publishedAt:bundle.publishedAt,assets:bundle.article.assets});
  for(const element of body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr,br,hr'))element.appendChild(document.createTextNode(' '));
  const absolute=(url:string)=>new URL(url,expectedUrl).href;
  const links=[...body.querySelectorAll('a')].map(link=>absolute(link.getAttribute('href')??''));
  const images=[...body.querySelectorAll('img')].map(image=>({src:absolute(image.getAttribute('src')??''),alt:image.getAttribute('alt')??''}));
  if (normalize(unique('.article-header h1').textContent??'')!==bundle.article.title
    ||normalize(body.textContent??'')!==expected.text||unique('link[rel="canonical"]').getAttribute('href')!==expectedUrl
    ||!date||!Number.isFinite(Date.parse(date))||Date.parse(date)!==Date.parse(bundle.publishedAt)
    ||sorted(links)!==sorted(expected.links)||sorted(images.map(i=>`${i.src}\n${i.alt}`))!==sorted(expected.images.map(i=>`${i.src}\n${i.alt}`))) throw Error('PAGES_PUBLIC_EVIDENCE_MISMATCH');
  for(const image of images){if(!image.src.startsWith('https://'))throw Error('PAGES_PUBLIC_IMAGE_INVALID');const loaded=await fetcher(image.src,{redirect:'error',signal:AbortSignal.timeout(30_000)});if(!loaded.ok||!(loaded.headers.get('content-type')??'').startsWith('image/'))throw Error('PAGES_PUBLIC_IMAGE_FAILED');}
  return {verifiedAt:new Date().toISOString(),sourceRevision:bundle.sourceRevision,canonicalUrl:expectedUrl,publishedAt:bundle.publishedAt};
}
