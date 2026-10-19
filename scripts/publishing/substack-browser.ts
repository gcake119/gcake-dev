import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type Locator, type BrowserContext } from 'playwright';
import { marked } from 'marked';
import { parseHTML } from 'linkedom';
import type { DistributionArticle, RemoteArticle, SubstackBrowserAdapter } from '../../apps/admin-worker/src/distribution-coordinator';

export type UiLocator = { role: string; name: string } | { css: string };
export interface SubstackUiContract {
  version: 1; origin: string; reviewedAt: string; publishingCapabilitiesVerified: boolean; discoveryVerified: boolean;
  homePath: string; postsPath: string; editPath: string;
  createMenu?: UiLocator; create: UiLocator;
  title: UiLocator; body: UiLocator; saved: UiLocator;
  settings?: UiLocator; canonical?: UiLocator; publishedAt?: UiLocator; settingsDone?: UiLocator;
  publicationPolicy?: 'full-mirror';
  displayedDatePrecision?: 'minute';
  displayedDateFormat?: 'iso' | 'datetime-local'; displayedDateOffsetMinutes?: number;
  continue: UiLocator; email: UiLocator; confirmPublish: UiLocator;
  appNotification?: UiLocator; schedule?: UiLocator; immediateUpdate?: UiLocator; websiteOnlyConfirm?: UiLocator;
  draftLinks: string; nextPage?: UiLocator; scanComplete: UiLocator;
  publicLink?: UiLocator;
  publicIdentity?: {source:'anonymous-post-data';publicationId:number};
  discoveryScopes?: {state:'published'|'draft'|'scheduled';tab:UiLocator;items:string;titleSelector?:string;complete:UiLocator;next?:UiLocator;total?:UiLocator;empty?:UiLocator}[];
  publicBody: string; publicTitle: string; publicDate: string;
}
export interface PublicDomEvidence {
  html?:string; description?:string;
  title: string; text: string; canonical: string; publishedAt: string;
  postId?:string; publicationId?:number;
  links: string[]; images: { src: string; alt: string; loaded: boolean }[];
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
export function renderedArticle(article: DistributionArticle) {
  const html = marked.parse(article.body, { async: false });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const allowed = new Set(['P', 'A', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'EM', 'DEL', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  for (const element of document.body.querySelectorAll('*')) {
    if (!allowed.has(element.tagName)) throw new Error('SUBSTACK_UNSUPPORTED_CONTENT');
    for (const attribute of element.attributes) {
      if (/^on/i.test(attribute.name) || !['href', 'src', 'alt', 'title', 'class', 'start', 'align'].includes(attribute.name)) throw new Error('SUBSTACK_UNSUPPORTED_CONTENT');
    }
    for (const attr of ['href', 'src']) {
      const raw = element.getAttribute(attr); if (!raw) continue;
      const url = new URL(raw, article.canonicalUrl);
      if (!(attr === 'href' ? ['https:', 'http:', 'mailto:'] : ['https:', 'http:']).includes(url.protocol)) throw new Error('SUBSTACK_UNSUPPORTED_URL');
      element.setAttribute(attr, url.href);
    }
  }
  const portableHtml = document.body.innerHTML;
  // textContent alone joins adjacent paragraphs; introduce readable block boundaries.
  for (const element of document.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,tr,br,hr')) element.appendChild(document.createTextNode(' '));
  return {
    html: portableHtml,
    text: normalize(document.body.textContent ?? ''),
    links: Array.from(document.body.querySelectorAll('a')).map(a => a.getAttribute('href')!),
    images: Array.from(document.body.querySelectorAll('img')).map(img => ({ src: img.getAttribute('src')!, alt: img.getAttribute('alt') ?? '' })),
  };
}
function sorted(values: string[]) { return JSON.stringify([...new Set(values)].sort()); }
export function assertPublicDomEvidence(article: DistributionArticle, evidence: PublicDomEvidence, options?: { policy?: 'full-mirror'; remoteUrl: string; ignoreDate?: boolean }): void {
  const expected = renderedArticle(article);
  const mirror = options?.policy === 'full-mirror';
  if (evidence.title !== article.title || normalize(evidence.text) !== expected.text
    || evidence.canonical !== (mirror ? options.remoteUrl : article.canonicalUrl) || !article.publishedAt
    || !Number.isFinite(Date.parse(evidence.publishedAt)) || !Number.isFinite(Date.parse(article.publishedAt))
    || mirror && !evidence.links.includes(article.canonicalUrl)
    || !(mirror && options.ignoreDate) && (mirror && article.substackDatePrecision === 'minute' ? Math.floor(Date.parse(evidence.publishedAt) / 60_000) * 60_000 : Date.parse(evidence.publishedAt)) !== (mirror ? expectedSubstackDate(article) : Date.parse(article.publishedAt))
    || sorted(evidence.links) !== sorted(expected.links)
    || evidence.images.some(i => !i.loaded)
    || sorted(evidence.images.map(i => `${i.src}\n${i.alt}`)) !== sorted(expected.images.map(i => `${i.src}\n${i.alt}`))) throw new Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');
}
export function expectedSubstackDate(article: DistributionArticle): number {
  const instant = Date.parse(article.publishedAt ?? '');
  return article.substackDatePrecision === 'minute' ? Math.floor(instant / 60_000) * 60_000 : instant;
}
export function displayedDateValue(publishedAt: string, ui: Pick<SubstackUiContract, 'displayedDateFormat' | 'displayedDateOffsetMinutes' | 'displayedDatePrecision'>): string {
  const instant = Date.parse(publishedAt);
  if (!Number.isFinite(instant)) throw new Error('SUBSTACK_DATE_INVALID');
  if (ui.displayedDateFormat === 'iso') return publishedAt;
  const offset = ui.displayedDateOffsetMinutes;
  if (ui.displayedDateFormat !== 'datetime-local' || !Number.isInteger(offset) || Math.abs(offset!) > 840) throw new Error('SUBSTACK_DATE_FORMAT_UNVERIFIED');
  if (instant % 60_000 !== 0 && ui.displayedDatePrecision !== 'minute') throw new Error('SUBSTACK_DATE_PRECISION_UNSUPPORTED');
  return new Date(instant + offset! * 60_000).toISOString().slice(0, 16);
}
export function validateSubstackProfile(profile: string, repository: string): void {
  const rel = path.relative(path.resolve(repository), path.resolve(profile));
  if (!rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))
    || /(?:Google[\\/]Chrome|Microsoft[\\/]Edge|Brave-Browser|Firefox[\\/]Profiles|chromium[\\/]Default)/i.test(profile)) throw new Error('SUBSTACK_DEDICATED_PROFILE_REQUIRED');
}
export class PlaywrightSubstackAdapter implements SubstackBrowserAdapter {
  get publicationPolicy() { return this.ui.publicationPolicy; }
  constructor(private readonly page: Page, readonly ui: SubstackUiContract, fixture = false, private readonly beforeWrite?:()=>Promise<unknown>, private readonly anonymousReader?:(remote:RemoteArticle)=>Promise<PublicDomEvidence>, private readonly publicLocator?:(id:string)=>Promise<RemoteArticle>) {
    const origin = new URL(ui.origin);
    if ((!fixture && (origin.protocol !== 'https:' || origin.hostname !== 'gcakedev.substack.com'))
      || fixture && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      || ui.publicIdentity !== undefined && (ui.publicIdentity.source!=='anonymous-post-data'||!Number.isSafeInteger(ui.publicIdentity.publicationId)||ui.publicIdentity.publicationId<=0)
      || ui.version !== 1 || !Number.isFinite(Date.parse(ui.reviewedAt)) || !ui.homePath || !ui.postsPath || !ui.editPath.includes('{id}')
      || ui.publicationPolicy !== undefined && ui.publicationPolicy !== 'full-mirror'
      || !ui.create || !ui.title || !ui.body || !ui.saved || !ui.continue || !ui.email || !ui.confirmPublish) throw new Error('SUBSTACK_UI_CONTRACT_INVALID');
    // Native Apple Events require multiple guarded round trips per observation.
    // Allow a bounded navigation/rendering window without replaying actions.
    page.setDefaultTimeout(30_000);
  }
  private locator(spec: UiLocator): Locator {
    return 'css' in spec ? this.page.locator(spec.css) : this.page.getByRole(spec.role as Parameters<Page['getByRole']>[0], { name: spec.name, exact: true });
  }
  private async unique(spec: UiLocator): Promise<Locator> {
    const locator = this.locator(spec);
    if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('SUBSTACK_UI_CONTROL_AMBIGUOUS');
    return locator;
  }
  private safeUrl(value: string): string {
    const url = new URL(value, this.ui.origin);
    if (url.origin !== this.ui.origin || url.username || url.password) throw new Error('SUBSTACK_REMOTE_URL_INVALID');
    return url.href;
  }
  private async navigate(value: string) {
    const response = await this.page.goto(this.safeUrl(value), { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) throw new Error('SUBSTACK_HTTP_FAILED');
    await this.assertSession();
    if (/^\/publish\/post\//.test(new URL(this.page.url()).pathname)) await this.locator(this.ui.title).waitFor({state:'visible'});
  }
  private async assertSession() {
    const text = await this.page.locator('body').innerText();
    if (/sign in to|登入以|登入.*Substack/i.test(text) || /\/sign-in/.test(new URL(this.page.url()).pathname)) throw new Error('SUBSTACK_LOGIN_REQUIRED');
    if (/captcha|verify you are human|just a moment|attention required|too many requests|驗證您是人類/i.test(text)) throw new Error('SUBSTACK_MANUAL_INTERVENTION_REQUIRED');
    if (new URL(this.page.url()).origin !== this.ui.origin) throw new Error('SUBSTACK_UNEXPECTED_ORIGIN');
  }
  async preflight() { await this.navigate(this.ui.homePath); }
  async find(article: DistributionArticle): Promise<readonly RemoteArticle[]> {
    if (this.ui.discoveryVerified !== true) throw new Error('SUBSTACK_DISCOVERY_UNVERIFIED');
    await this.navigate(this.ui.postsPath);
    const matches = new Map<string,RemoteArticle>();
    const scopes = this.ui.discoveryScopes ?? [{tab:undefined,items:this.ui.draftLinks,complete:this.ui.scanComplete,next:this.ui.nextPage}];
    for (const scope of scopes) {
      await this.navigate(this.ui.postsPath);
      if (scope.tab){await this.locator(scope.tab).waitFor({state:'visible'});await (await this.unique(scope.tab)).click();}
      // A client-side tab transition can leave the previous list's totals and
      // rows visible. Establish the selected-list boundary before reading them.
      await this.locator(scope.complete).waitFor({state:'visible'});
      const totalSpec='total' in scope?scope.total:undefined;
      let total:number|undefined;
      if(totalSpec){const text=await (await this.unique(totalSpec)).innerText();const number=text.match(/[0-9][0-9,]*/)?.[0];total=number?Number(number.replace(/,/g,'')):0;if(!Number.isSafeInteger(total))throw Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');
        if(total===0){const empty='empty' in scope?scope.empty:undefined;if(!empty)throw Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');await this.locator(empty).waitFor({state:'visible'});}
        else {const until=Date.now()+10000;while(await this.page.locator(scope.items).count()===0&&Date.now()<until)await new Promise(r=>setTimeout(r,100));if(await this.page.locator(scope.items).count()===0)throw Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');}
      }
      const scannedIds=new Set<string>();
      const visited = new Set<string>();
      let complete = false;
      for (let pages = 0; pages < 100; pages++) {
        await this.assertSession();
        await (await this.unique(scope.complete)).waitFor({ state: 'visible' });
        const links = await this.page.locator(scope.items).evaluateAll((nodes,titleSelector) => nodes.map(n => ({ title: (titleSelector?n.querySelector(titleSelector)?.textContent:n.textContent)?.trim(), href: n.getAttribute('href') })), 'titleSelector' in scope?scope.titleSelector:undefined);
        const signature = JSON.stringify([this.page.url(),links]);
        if (visited.has(signature)) throw new Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');
        visited.add(signature);
        for(const link of links){if(!link.href)throw Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');const id=new URL(this.safeUrl(link.href)).pathname.match(/\/publish\/(?:post|posts\/detail)\/([a-zA-Z0-9-]+)$/)?.[1];if(!id)throw Error('SUBSTACK_REMOTE_ID_INVALID');scannedIds.add(id);}
        for (const link of links) {
          if (link.title !== article.title || !link.href) continue;
          const url = this.safeUrl(link.href), id = new URL(url).pathname.match(/\/publish\/(?:post|posts\/detail)\/([a-zA-Z0-9-]+)$/)?.[1];
          if (!id) throw new Error('SUBSTACK_REMOTE_ID_INVALID');
          const editorUrl = this.editUrl({id,url});
          let remote={id,url:editorUrl};
          if ('state' in scope&&scope.state==='published'&&this.publicLocator) {
            remote=await this.publicLocator(id);
            const publicUrl=new URL(this.safeUrl(remote.url));
            if(remote.id!==id||!/^\/p\/[a-z0-9-]+$/.test(publicUrl.pathname)||publicUrl.search||publicUrl.hash)throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
          }
          if (matches.has(id) && matches.get(id)!.url !== remote.url) throw new Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
          matches.set(id,remote);
        }
        if (!scope.next || await this.locator(scope.next).count() === 0) {complete=true;break;}
        const next = await this.unique(scope.next);
        if (!await next.isEnabled()) {complete=true;break;}
        await next.click();
      }
      if (!complete || total!==undefined&&scannedIds.size!==total) throw new Error('SUBSTACK_DRAFT_SCAN_INCOMPLETE');
    }
    return [...matches.values()];
  }
  async create(_article: DistributionArticle): Promise<RemoteArticle> {
    await this.beforeWrite?.();
    await this.navigate(this.ui.homePath);
    if (this.ui.createMenu) await (await this.unique(this.ui.createMenu)).click();
    await (await this.unique(this.ui.create)).click();
    await this.page.waitForURL(url => /\/publish\/post\/[a-zA-Z0-9-]+$/.test(url.pathname));
    await this.assertSession();
    const id = new URL(this.page.url()).pathname.split('/').at(-1)!;
    return { id, url: this.safeUrl(this.page.url()) };
  }
  private editUrl(remote: RemoteArticle): string {
    if (!/^[a-zA-Z0-9-]+$/.test(remote.id)) throw new Error('SUBSTACK_REMOTE_ID_INVALID');
    return this.safeUrl(this.ui.editPath.replace('{id}', encodeURIComponent(remote.id)));
  }
  private async assertEditorPublicIdentity(remote:RemoteArticle) {
    if(this.ui.publicIdentity){
      if(this.ui.publicIdentity.source!=='anonymous-post-data'||!this.anonymousReader||new URL(this.page.url()).pathname!==new URL(this.editUrl(remote)).pathname)throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
      const data=await this.anonymousReader(remote);
      if(data.postId!==remote.id||data.publicationId!==this.ui.publicIdentity.publicationId||data.canonical!==remote.url)throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
      return;
    }
    if (!this.ui.publicLink || this.safeUrl(await (await this.unique(this.ui.publicLink)).getAttribute('href') ?? '') !== this.safeUrl(remote.url)) throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');
  }
  async readIdentity(remote:RemoteArticle){await this.navigate(this.editUrl(remote));await this.assertEditorPublicIdentity(remote);return remote;}
  async update(remote: RemoteArticle, article: DistributionArticle) {
    await this.beforeWrite?.();
    const rendered = renderedArticle(article);
    await this.navigate(this.editUrl(remote));
    // Reject unsupported identity evidence before touching a persisted public draft.
    if (this.ui.immediateUpdate && /^\/p\//.test(new URL(remote.url,this.ui.origin).pathname)) {
      await this.assertEditorPublicIdentity(remote);
    }
    const title = await this.unique(this.ui.title);
    if (await title.inputValue() !== article.title) {
      await this.beforeWrite?.();
      await title.fill(article.title);
      // Finish the title autosave before the body edit; an earlier acknowledgement
      // must not masquerade as confirmation of the later content save.
      await this.locator(this.ui.saved).waitFor({ state: 'visible' });
    }
    const body = await this.unique(this.ui.body);
    await this.beforeWrite?.();
    await body.click(); await body.press('ControlOrMeta+A');
    // Paste HTML through the editor's normal clipboard event, preserving links/images.
    await body.evaluate((element, html) => {
      const clipboardData = new DataTransfer(); clipboardData.setData('text/html', html);
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, rendered.html);
    if (this.ui.publicationPolicy !== 'full-mirror' && this.ui.canonical && this.ui.publishedAt) {
      if (this.ui.settings) await (await this.unique(this.ui.settings)).click();
      await this.locator(this.ui.canonical).waitFor({state:'visible'});
      await (await this.unique(this.ui.canonical)).fill(article.canonicalUrl);
      await (await this.unique(this.ui.publishedAt)).fill(article.publishedAt!);
      if (this.ui.settingsDone) await (await this.unique(this.ui.settingsDone)).click();
    }
    await this.locator(this.ui.saved).waitFor({ state: 'visible' });
    // Reload checks persisted draft rather than trusting a stale autosave indicator.
    await this.page.reload({ waitUntil: 'domcontentloaded' }); await this.assertSession();
    await this.verifyDraft(article);
    if (this.ui.immediateUpdate && /^\/p\//.test(new URL(remote.url,this.ui.origin).pathname)) {
      await this.assertEditorPublicIdentity(remote);
      await (await this.unique(this.ui.continue)).click();
      await this.disableDelivery();
      await this.beforeWrite?.();
      await (await this.unique(this.ui.immediateUpdate)).click();
      await this.locator(this.ui.saved).waitFor({state:'visible'});
      await this.page.reload({waitUntil:'domcontentloaded'});await this.assertSession();await this.verifyDraft(article);
    }
  }
  private async disableDelivery() {
    for (const spec of [this.ui.email,this.ui.appNotification,this.ui.schedule]) {
      if (!spec) continue;
      await this.locator(spec).waitFor({state:'visible'});
      const control = await this.unique(spec);await control.uncheck();
      if (await control.isChecked()) throw Error('SUBSTACK_NEWSLETTER_DISABLED_REQUIRED');
    }
  }
  private async verifyDraft(article: DistributionArticle) {
    const title = await this.unique(this.ui.title);
    if (await title.inputValue() !== article.title) throw new Error('SUBSTACK_DRAFT_CONTENT_MISMATCH');
    const body = await this.unique(this.ui.body);
    await body.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => {}))); });
      const data = await body.evaluate(element => ({ text: (element as HTMLElement).innerText, links: Array.from(element.querySelectorAll('a')).map(a => a.href), images: Array.from(element.querySelectorAll('img')).map(i => ({ src: i.src, alt: i.alt, loaded: i.complete && i.naturalWidth > 0 })) }));
    const expected = renderedArticle(article);
    if (normalize(data.text) !== expected.text || sorted(data.links) !== sorted(expected.links) || data.images.some(i => !i.loaded)
      || sorted(data.images.map(i => `${i.src}\n${i.alt}`)) !== sorted(expected.images.map(i => `${i.src}\n${i.alt}`))) throw new Error('SUBSTACK_DRAFT_CONTENT_MISMATCH');
  }
  async readDraft(remote: RemoteArticle, article: DistributionArticle) { await this.navigate(this.editUrl(remote)); await this.verifyDraft(article); }
  async checkPublish(remote: RemoteArticle, article: DistributionArticle) {
    if (!this.ui.publishingCapabilitiesVerified || !this.ui.publishedAt || (this.publicationPolicy === 'full-mirror' ? !this.ui.settings || !this.ui.settingsDone || !(this.ui.publicLink||this.ui.publicIdentity) || !this.ui.displayedDateFormat : !this.ui.canonical)) throw new Error('SUBSTACK_CANONICAL_DATE_CAPABILITY_UNVERIFIED');
    if (this.publicationPolicy === 'full-mirror') {
      displayedDateValue(article.publishedAt!, this.ui);
      if (!renderedArticle(article).links.includes(article.canonicalUrl)) throw new Error('SUBSTACK_ORIGINAL_LINK_REQUIRED');
    }
    await this.navigate(this.editUrl(remote)); await this.verifyDraft(article);
    if (this.publicationPolicy === 'full-mirror') return;
    if (!this.ui.canonical) throw new Error('SUBSTACK_CANONICAL_DATE_CAPABILITY_UNVERIFIED');
    if (this.ui.settings) await (await this.unique(this.ui.settings)).click();
    await this.locator(this.ui.canonical).waitFor({state:'visible'});
    await this.locator(this.ui.publishedAt).waitFor({state:'visible'});
    if (await (await this.unique(this.ui.canonical)).inputValue() !== article.canonicalUrl
      || Date.parse(await (await this.unique(this.ui.publishedAt)).inputValue()) !== Date.parse(article.publishedAt!)) throw new Error('SUBSTACK_DRAFT_METADATA_MISMATCH');
    if (this.ui.settingsDone) await (await this.unique(this.ui.settingsDone)).click();
  }
  async publish(remote: RemoteArticle, article: DistributionArticle) {
    await this.beforeWrite?.();
    await this.checkPublish(remote, article);
    await (await this.unique(this.ui.continue)).click();
    await this.disableDelivery();
    const confirm = await this.unique(this.ui.confirmPublish);
    if (!await confirm.isEnabled()) throw new Error('SUBSTACK_PUBLISH_DISABLED');
    // Preserve the editor's article link before a successful click can navigate
    // away. This is only a candidate URL; anonymous readback still proves it.
    const beforeLink = this.ui.publicLink ? this.locator(this.ui.publicLink) : undefined;
    const candidateUrl = beforeLink && await beforeLink.count() === 1 && await beforeLink.isVisible()
      ? await beforeLink.getAttribute('href') : undefined;
    // Coordinator has already persisted intent. This click is never automatically repeated.
    await this.beforeWrite?.();
    await confirm.click();
    if (this.ui.websiteOnlyConfirm) {
      await this.locator(this.ui.websiteOnlyConfirm).waitFor({state:'visible'});
      await this.beforeWrite?.();
      await (await this.unique(this.ui.websiteOnlyConfirm)).click();
    }
    if(this.ui.publicIdentity){if(!this.publicLocator)throw Error('SUBSTACK_PUBLIC_IDENTITY_RESOLVER_REQUIRED');return this.publicLocator(remote.id);}
    if (candidateUrl) return { id: remote.id, url: this.safeUrl(candidateUrl) };
    if (this.ui.publicLink) {
      if (/^\/p\/[a-z0-9-]+$/.test(new URL(this.page.url()).pathname)) return { id: remote.id, url: this.safeUrl(this.page.url()) };
      await this.locator(this.ui.publicLink).waitFor({ state: 'visible' });
      const link = await this.unique(this.ui.publicLink);
      return { id: remote.id, url: this.safeUrl(await link.getAttribute('href') ?? '') };
    }
    await this.page.waitForURL(url => /^\/p\/[a-z0-9-]+$/.test(url.pathname));
    return { id: remote.id, url: this.safeUrl(this.page.url()) };
  }
  async finalizePublishedDate(remote: RemoteArticle, article: DistributionArticle) {
    if (this.publicationPolicy !== 'full-mirror' || !this.ui.publishingCapabilitiesVerified || !this.ui.settings || !this.ui.publishedAt || !this.ui.settingsDone || !(this.ui.publicLink||this.ui.publicIdentity)) throw new Error('SUBSTACK_DATE_CAPABILITY_UNVERIFIED');
    const value = displayedDateValue(article.publishedAt!, this.ui);
    // Anonymous exact article readback must succeed before any metadata mutation.
    const evidence = await this.readPublicEvidence(remote, article, true);
    remote = evidence.remote;
    if ((article.substackDatePrecision === 'minute' ? Math.floor(Date.parse(evidence.publishedAt) / 60_000) * 60_000 : Date.parse(evidence.publishedAt)) === expectedSubstackDate(article)) return remote;
    await this.navigate(this.editUrl(remote));
    await this.verifyDraft(article);
    await this.assertEditorPublicIdentity(remote);
    await this.beforeWrite?.();
    await (await this.unique(this.ui.settings)).click();
    await this.locator(this.ui.publishedAt).waitFor({state:'visible'});
    await (await this.unique(this.ui.publishedAt)).fill(value);
    await (await this.unique(this.ui.settingsDone)).click();
    // Confirmation is public readback, not a save-button acknowledgement.
    return this.verify(remote, article);
  }
  async verify(remote: RemoteArticle, article: DistributionArticle) {
    return (await this.readPublicEvidence(remote, article)).remote;
  }
  private async readPublicEvidence(remote: RemoteArticle, article: DistributionArticle, ignoreDate = false) {
    if(this.ui.publicIdentity&&!/^\/p\/[a-z0-9-]+$/.test(new URL(remote.url,this.ui.origin).pathname)){if(!this.publicLocator)throw Error('SUBSTACK_PUBLIC_IDENTITY_RESOLVER_REQUIRED');remote=await this.publicLocator(remote.id);}
    if (!/^\/p\/[a-z0-9-]+$/.test(new URL(remote.url, this.ui.origin).pathname) && this.ui.publicLink) {
      await this.navigate(this.editUrl(remote));
      remote = { id: remote.id, url: this.safeUrl(await (await this.unique(this.ui.publicLink)).getAttribute('href') ?? '') };
    }
    if (this.anonymousReader) {
      const data=await this.anonymousReader(remote);if(this.ui.publicIdentity&&(data.postId!==remote.id||data.publicationId!==this.ui.publicIdentity.publicationId))throw Error('SUBSTACK_REMOTE_IDENTITY_MISMATCH');assertPublicDomEvidence(article,data,{policy:this.publicationPolicy,remoteUrl:remote.url,ignoreDate});return {remote,publishedAt:data.publishedAt};
    }
    // Always use a fresh unauthenticated context; a private preview is not public evidence.
    const browser = this.page.context().browser();
    if (!browser) throw new Error('SUBSTACK_PUBLIC_BROWSER_REQUIRED');
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const publicUrl = new URL(remote.url, this.ui.origin);
      if (publicUrl.origin !== this.ui.origin || publicUrl.search || publicUrl.hash || !/^\/p\/[a-z0-9-]+$/.test(publicUrl.pathname) || /^\/p\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(publicUrl.pathname)) throw new Error('SUBSTACK_PUBLIC_URL_REQUIRED');
      const response = await page.goto(publicUrl.href, { waitUntil: 'load' });
      if (!response?.ok()) throw new Error('SUBSTACK_PUBLIC_HTTP_FAILED');
      const body = page.locator(this.ui.publicBody);
      if (await body.count() !== 1 || await page.locator(this.ui.publicTitle).count() !== 1 || await page.locator(this.ui.publicDate).count() !== 1) throw new Error('SUBSTACK_PUBLIC_EVIDENCE_MISMATCH');
      await body.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => {}))); });
      const data = await body.evaluate(element => ({ text: (element as HTMLElement).innerText, links: Array.from(element.querySelectorAll('a')).map(a => a.href), images: Array.from(element.querySelectorAll('img')).map(i => ({ src: i.src, alt: i.alt, loaded: i.complete && i.naturalWidth > 0 })) }));
      const publishedAt = await page.locator(this.ui.publicDate).getAttribute('datetime') ?? '';
      assertPublicDomEvidence(article, { ...data, title: await page.locator(this.ui.publicTitle).innerText(), canonical: await page.locator('link[rel="canonical"]').getAttribute('href') ?? '', publishedAt }, { policy: this.publicationPolicy, remoteUrl: publicUrl.href, ignoreDate });
      return { remote, publishedAt };
    } finally { await context.close(); }
  }
}
export async function openSubstackProfile(profile: string, repository: string, options: {headless?:boolean} = {}): Promise<BrowserContext> {
  validateSubstackProfile(profile, repository);
  await fs.mkdir(profile, { recursive: true, mode: 0o700 });
  const realProfile = await fs.realpath(profile), realRepository = await fs.realpath(repository);
  validateSubstackProfile(realProfile, realRepository);
  for (let ancestor = realProfile; ; ancestor = path.dirname(ancestor)) {
    try { await fs.access(path.join(ancestor, '.git')); throw new Error('SUBSTACK_PROFILE_INSIDE_GIT'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (path.dirname(ancestor) === ancestor) break;
  }
  await fs.chmod(realProfile, 0o700);
  // Use the same macOS Keychain as the owner's direct Chrome sign-in.
  // Do not replace encrypted profile authentication with Playwright's mock keychain.
  return chromium.launchPersistentContext(realProfile, { headless: options.headless ?? false, channel: 'chrome', ignoreDefaultArgs: process.platform === 'darwin' ? ['--use-mock-keychain','--password-store=basic'] : [] });
}
