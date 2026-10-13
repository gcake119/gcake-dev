import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDistributionBundle, type DistributionTarget } from './prepare-distribution';
import { DistributionCoordinator, type DistributionApproval, type SubstackBrowserAdapter } from '../../apps/admin-worker/src/distribution-coordinator';
import { D1PublicationRepository } from '../../apps/admin-worker/src/publication-operations';
import { boundedDistributionError } from '../../apps/admin-worker/src/distribution-runtime';
import { CloudflareD1Database } from './d1-api';
import { openSubstackProfile, PlaywrightSubstackAdapter, type SubstackUiContract } from './substack-browser';
import { AttendedSubstackAdapter, FileAttendedExchange, anonymousSubstackReader } from './substack-attended';
import { assertPagesPublication } from './pages-publication';

export interface DistributionConfig {
  substack: { transport?: 'profile' | 'macos-chrome'; profileContractReviewed?: boolean; macosChrome?: {processId?:number;windowId:number;tabId:number;automationApproved:boolean;contractReviewed:boolean}; writeEnabled: boolean; profile: string; ui: SubstackUiContract };
  trial?: { sourceCommit?: string; writeEnabled: boolean; slug: string; sourceRevision: string; substackOrigin: string; digests: Record<DistributionTarget, string>; sessionDirectory: string };
  unattended?: { enabled: boolean; slug?: string; scope?: 'all-formal-markdown'; repository?: 'gcake119/gcake-dev'; branch?: 'main'; policy: 'pages-first-no-newsletter'; targets: DistributionTarget[] };
}
export function assertCurrentTargetPolicy(config: DistributionConfig, target: DistributionTarget) {
  if (config.unattended && !config.unattended.targets.includes(target)) throw new Error('DISTRIBUTION_TARGET_AUTHORIZATION_REVOKED');
}
export function assertTrialScope(config: DistributionConfig, article: ReturnType<typeof articleFromBundle>, target: DistributionTarget, digest: string) {
  assertCurrentTargetPolicy(config, target);
  const trial = config.trial;
  if (!trial || trial.slug !== article.slug || trial.sourceRevision !== article.sourceRevision
    || trial.substackOrigin !== 'https://gcakedev.substack.com' || config.substack.ui.origin !== trial.substackOrigin
    || trial.digests?.[target] !== digest) throw new Error('DISTRIBUTION_TRIAL_SCOPE_MISMATCH');
}
export function articleFromBundle(bundle: Awaited<ReturnType<typeof buildDistributionBundle>>, precision?: 'minute') {
  return { ...(precision ? {substackDatePrecision: precision} : {}), slug: bundle.slug, sourceRevision: bundle.sourceRevision, title: bundle.article.title, description: bundle.article.description, body: bundle.article.markdown, assets: bundle.article.assets, canonicalUrl: bundle.canonicalUrl, publishedAt: bundle.publishedAt };
}
export function reviewDigest(article: ReturnType<typeof articleFromBundle>, target: DistributionTarget, transport?: 'profile' | 'macos-chrome', publicIdentity?:SubstackUiContract['publicIdentity']): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify({ article, target, newsletter: 'skip', ...(target === 'substack' ? { ...(transport ? {substackTransport:transport} : {}), ...(publicIdentity?{substackPublicIdentity:publicIdentity}:{}), substackPolicy: 'full-mirror', canonicalPolicy: 'platform-article', datePolicy: article.substackDatePrecision === 'minute' ? 'after-publish-original-minute' : 'after-publish-original' } : {}) })).digest('hex');
}
async function json<T>(file: string): Promise<T> { return JSON.parse(await fs.readFile(path.resolve(file), 'utf8')) as T; }
export async function main(args = process.argv.slice(2), profileOpener = openSubstackProfile, root = process.cwd()) {
  const cleanArgs = args.filter(arg => arg !== '--');
  const [operation, slug, target] = cleanArgs;
  const flags = cleanArgs.slice(operation === 'login' ? 2 : 3);
  if (operation === 'login' && slug !== 'substack') throw new Error('DISTRIBUTION_LOGIN_SUBSTACK_ONLY');
  if (!['dry-run', 'prepare', 'publish', 'verify', 'retry', 'finalize', 'login'].includes(operation) || !slug || (operation !== 'login' && !['substack'].includes(target))) throw new Error('DISTRIBUTION_USAGE: distribution:run login substack --config path OR distribution:run <dry-run|prepare|publish|verify|retry|finalize> <slug> <substack> [--config path] [--receipt path] [--approval path] [--out path]');
  if (operation === 'finalize' && target !== 'substack') throw new Error('DISTRIBUTION_FINALIZE_SUBSTACK_ONLY');
  const parsed = new Map<string, string>();
  for (let i = 0; i < flags.length; i += 2) {
    if (!['--config', '--receipt', '--approval', '--out', '--mode', '--source-root'].includes(flags[i]) || !flags[i + 1] || flags[i + 1].startsWith('--') || parsed.has(flags[i])) throw new Error('DISTRIBUTION_ARGUMENT_INVALID');
    parsed.set(flags[i], flags[i + 1]);
  }
  const namedTarget = target as DistributionTarget;
  if (parsed.has('--source-root')) root = path.resolve(parsed.get('--source-root')!);
  const trialMode = parsed.get('--mode') === 'controlled-trial';
  if (parsed.has('--mode') && (!trialMode || operation === 'login')) throw new Error('DISTRIBUTION_ARGUMENT_INVALID');
  if (operation === 'login') {
    const configPath = parsed.get('--config'); if (!configPath) throw new Error('DISTRIBUTION_CONFIGURATION_REQUIRED');
    const config = await json<DistributionConfig>(configPath);
    if (config.substack.ui.origin !== 'https://gcakedev.substack.com' || config.substack.ui.homePath !== '/publish/home') throw new Error('SUBSTACK_LOGIN_ORIGIN_INVALID');
    const context = await profileOpener(config.substack.profile, root);
    try {
      const closed = new Promise<void>(resolve => context.once('close', () => resolve()));
      const page = await context.newPage();
      await page.goto(config.substack.ui.origin + config.substack.ui.homePath);
      console.log('請在專用瀏覽器登入，完成後關閉瀏覽器。');
      await closed;
    } finally { await context.close(); }
    return;
  }
  const bundle = await buildDistributionBundle(slug, path.join(root, 'src/content/posts'));
  const configPath = parsed.get('--config');
  const config = configPath ? await json<DistributionConfig>(configPath) : undefined;
  if (config) assertCurrentTargetPolicy(config, namedTarget);
  const article = articleFromBundle(bundle, config?.substack.ui.displayedDatePrecision);
  const digest = reviewDigest(article, namedTarget, config?.substack.transport,config?.substack.ui.publicIdentity);
  if (operation === 'dry-run') {
    const out = path.resolve(parsed.get('--out') ?? `.distribution-handoff/${slug}-${target}-review.json`);
    await fs.mkdir(path.dirname(out), { recursive: true, mode: 0o700 });
    const policy = namedTarget === 'substack' ? { ...(config?.substack.transport ? {substackTransport:config.substack.transport} : {}), substackPolicy: 'full-mirror', canonicalPolicy: 'platform-article', datePolicy: article.substackDatePrecision === 'minute' ? 'after-publish-original-minute' : 'after-publish-original' } : {};
    await fs.writeFile(out, JSON.stringify({ version: 1, digest, article, target, ...policy, ...(trialMode ? { executionMode: 'controlled-trial' } : {}), pagesVerificationRequired: true, newsletter: 'skip', externalWriteEnabled: false, approvalTemplate: { slug, target, sourceRevision: article.sourceRevision, digest, approved: false, newsletter: 'skip', operation: 'prepare', approvedAt: null, ...(trialMode ? { mode: 'controlled-trial' } : {}), ...(namedTarget === 'substack' ? { substackPolicy: 'full-mirror', ...(article.substackDatePrecision ? {substackDatePrecision:article.substackDatePrecision} : {}) } : {}) } }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ operation, slug, target, digest, reviewFile: out, externalWriteEnabled: false })); return;
  }
  if (!configPath || !config) throw new Error('DISTRIBUTION_CONFIGURATION_REQUIRED');
  let approval: DistributionApproval | undefined;
  if (operation === 'prepare' || operation === 'publish' || operation === 'finalize') {
    const approvalFile = parsed.get('--approval'), receiptFile = parsed.get('--receipt');
    if (!approvalFile || !receiptFile) throw new Error('DISTRIBUTION_REVIEW_AND_APPROVAL_REQUIRED');
    const reviewed = await json<{ version: number; digest: string; article: typeof article; target: DistributionTarget; executionMode?: string; substackPolicy?: string; canonicalPolicy?: string; datePolicy?: string }>(receiptFile);
    const authorized = await json<DistributionApproval & { digest: string; operation: string; mode?: string; approvedAt: string }>(approvalFile);
    if (reviewed.version !== 1 || reviewed.target !== namedTarget || reviewed.digest !== digest || reviewDigest(reviewed.article, namedTarget, config.substack.transport,config.substack.ui.publicIdentity) !== digest
      || authorized.digest !== digest || authorized.operation !== operation || !Number.isFinite(Date.parse(authorized.approvedAt))
      || reviewed.executionMode !== (trialMode ? 'controlled-trial' : undefined) || authorized.mode !== (trialMode ? 'controlled-trial' : undefined)) throw new Error('DISTRIBUTION_REVIEW_OR_APPROVAL_STALE');
    approval = authorized;
    // Validate before opening a browser or contacting D1.
    const { assertDistributionApproval } = await import('../../apps/admin-worker/src/distribution-coordinator');
    assertDistributionApproval(article, namedTarget, approval);
    if (namedTarget === 'substack' && (reviewed.substackPolicy !== 'full-mirror' || reviewed.canonicalPolicy !== 'platform-article' || reviewed.datePolicy !== (article.substackDatePrecision === 'minute' ? 'after-publish-original-minute' : 'after-publish-original') || authorized.substackPolicy !== 'full-mirror' || config.substack.ui.publicationPolicy !== 'full-mirror')) throw new Error('SUBSTACK_POLICY_APPROVAL_REQUIRED');
    if ((trialMode ? config.trial?.writeEnabled : config[namedTarget].writeEnabled) !== true) throw new Error('DISTRIBUTION_WRITE_DISABLED');

  }
  if (trialMode) {
    assertTrialScope(config, article, namedTarget, digest);
    if (config.unattended?.scope === 'all-formal-markdown') {
      const { assertGeneralPolicy, openFixedSnapshot } = await import('./distribution-inventory');
      assertGeneralPolicy(config);
      if (!config.trial?.sourceCommit || await openFixedSnapshot(root) !== config.trial.sourceCommit) throw new Error('DISTRIBUTION_TRIAL_SOURCE_COMMIT_MISMATCH');
    }
  }
  if (['prepare', 'publish', 'finalize'].includes(operation)) await assertPagesPublication(bundle);
  let context: {close():Promise<void>} | undefined;
  try {
    const repository = new D1PublicationRepository(new CloudflareD1Database(process.env.CLOUDFLARE_ACCOUNT_ID ?? '', process.env.DISTRIBUTION_D1_DATABASE_ID ?? '', process.env.CLOUDFLARE_API_TOKEN ?? ''));
    let substack: SubstackBrowserAdapter | undefined;
    if (namedTarget === 'substack') {
      if (trialMode && ['profile','macos-chrome'].includes(config.substack.transport??'')) {
        if (operation === 'publish') {
          const state=(await repository.listStates(slug)).find(s=>s.target==='substack');
          if(!state?.remoteId||state.sourceRevision!==article.sourceRevision||!['prepare_ready','verified'].includes(state.status))throw Error('SUBSTACK_TRIAL_PREPARED_DRAFT_REQUIRED');
        }
        const {createProfileTransport}=await import('./substack-profile');
        const selected=await createProfileTransport(article,operation as 'prepare'|'publish'|'verify'|'retry'|'finalize',repository,config,root,profileOpener,()=>assertPagesPublication(bundle));
        substack=selected.adapter;context=selected.context;
      } else if (trialMode) {
        if (operation === 'publish') {
          const state = (await repository.listStates(slug)).find(state => state.target === 'substack');
          if (!state?.remoteId || state.sourceRevision !== article.sourceRevision || !['prepare_ready', 'verified'].includes(state.status)) throw new Error('SUBSTACK_TRIAL_PREPARED_DRAFT_REQUIRED');
        }
        const session = await FileAttendedExchange.create(config.trial!.sessionDirectory, process.cwd());
        const publicReader = async (remote: Parameters<ReturnType<typeof anonymousSubstackReader>>[0]) => {
          // Codex can record selectors observed on the first real public page before acknowledging publication.
          const current = await json<DistributionConfig>(configPath);
          assertTrialScope(current, article, namedTarget, digest);
          if (current.substack.ui.publicationPolicy !== 'full-mirror') throw new Error('SUBSTACK_POLICY_APPROVAL_REQUIRED');
          return anonymousSubstackReader(current.substack.ui)(remote);
        };
        substack = new AttendedSubstackAdapter(article, operation as 'prepare' | 'publish' | 'verify' | 'retry' | 'finalize', repository.runtime, session.exchange, publicReader, () => assertPagesPublication(bundle));
      } else {
        const browserContext = await profileOpener(config.substack.profile, root);context=browserContext;
        substack = new PlaywrightSubstackAdapter(await browserContext.newPage(), config.substack.ui);
      }
    }
    const coordinator = new DistributionCoordinator(repository, substack);
    const state = await coordinator.run(article, namedTarget, operation as 'prepare' | 'publish' | 'verify' | 'retry' | 'finalize', approval);
    console.log(JSON.stringify({ operation, ...(namedTarget === 'substack' ? { substackPolicy: config.substack.ui.publicationPolicy ?? 'strict-source' } : {}), state }));
    if (['failed', 'manual_required', 'uncertain'].includes(state.status)) process.exitCode = 1;
  } finally { await context?.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(boundedDistributionError(error)); process.exitCode = 1; });
