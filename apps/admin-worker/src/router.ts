import {
  authorizeOwner,
  consumeOAuthState,
  createCmsSession,
  createOAuthState,
  requireCsrf,
  type CmsUser,
  type SessionStore,
} from './auth.js';
import type {
  DeploymentObservation,
  PostSource,
  PostSummary,
  SeriesSource,
  SaveContentRequest,
  MediaRecord,
  PreviewJob,
  PublicationOperation,
  PublicationOperationRequest,
  PublicationTarget,
  PublicationTargetState,
} from '@gcake/admin-contract';
import { MediaValidationError } from './media.js';
import { InvalidSeriesError, type SeriesManifestInput } from './series-validation.js';
import YAML from 'yaml';

export type {
  DeploymentObservation,
  PostSource,
  PostSummary,
  SeriesSource,
} from '@gcake/admin-contract';

export interface GitHubContentReader {
  listPosts(): Promise<readonly PostSummary[]>;
  getPost(slug: string): Promise<PostSource | undefined>;
  listSeries(): Promise<readonly SeriesSource[]>;
  getSeries(slug: string): Promise<SeriesSource | undefined>;
  getLatestDeployment(): Promise<DeploymentObservation | undefined>;
}

export interface GitHubContentWriter {
  save(request: SaveContentRequest): Promise<{ readonly commitSha: string; readonly paths: readonly string[] }>;
  renamePost?(input: {
    readonly slug: string;
    readonly newSlug: string;
    readonly source: string;
    readonly expectedBlobSha: string;
    readonly expectedBaseCommitSha: string;
  }): Promise<{ readonly commitSha: string; readonly paths: readonly string[] }>;
  deletePost(input: {
    readonly slug: string;
    readonly expectedBlobSha: string;
    readonly expectedBaseCommitSha: string;
    readonly confirmed: boolean;
  }): Promise<
    | { readonly kind: 'deleted'; readonly commitSha: string }
    | { readonly kind: 'confirmation-required' }
    | { readonly kind: 'blocked'; readonly seriesReferences: readonly string[] }
  >;
}

export interface MediaApi {
  list(query?: string): Promise<readonly MediaRecord[]>;
  upload(input: {
    readonly slug: string; readonly name: string; readonly mime: string; readonly bytes: Uint8Array;
    readonly width: number; readonly height: number; readonly hash: string;
  }): Promise<MediaRecord>;
  replace(id: string, input: {
    readonly slug: string; readonly name: string; readonly mime: string; readonly bytes: Uint8Array;
    readonly width: number; readonly height: number; readonly hash: string;
  }): Promise<MediaRecord>;
  usages(id: string): Promise<readonly string[]>;
  delete(id: string, confirmed: boolean): Promise<
    | { readonly kind: 'blocked'; readonly usages: readonly string[] }
    | { readonly kind: 'confirmation-required' }
    | { readonly kind: 'deleted' }
  >;
}

export interface SeriesWriteValidator {
  validateAndSerialize(manifest: SeriesManifestInput): { readonly yaml: string; readonly path: string };
}

export interface PreviewApi {
  create(input: { readonly repository: string; readonly slug: string; readonly baseRevision: string; readonly draft: string }): Promise<PreviewJob>;
  get(id: string): Promise<PreviewJob | undefined>;
}

export interface PublicationApi {
  states(postSlug: string, sourceRevision: string): Promise<readonly PublicationTargetState[]>;
  operate(input: PublicationOperationRequest): Promise<PublicationTargetState>;
}

export interface OAuthClient {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<string>;
  fetchIdentity(accessToken: string): Promise<CmsUser>;
}

export interface Phase1Dependencies {
  readonly oauth: OAuthClient;
  readonly sessions: SessionStore;
  readonly allowedGitHubUserIds: ReadonlySet<string>;
  readonly oauthStateSecret: string;
  readonly github?: GitHubContentReader;
  readonly githubWrites?: GitHubContentWriter;
  readonly media?: MediaApi;
  readonly seriesValidator?: SeriesWriteValidator;
  readonly previews?: PreviewApi;
  readonly publications?: PublicationApi;
  readonly now?: () => number;
  readonly randomToken?: () => string;
  readonly randomSessionToken?: () => string;
  readonly randomCsrfToken?: () => string;
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie');
  if (!cookie) return undefined;
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_MEDIA_ID = /^[a-zA-Z0-9-]+$/;
const SAFE_NEWSLETTER_INTENT_KEY = /^[a-zA-Z0-9:_-]{8,160}$/;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copied.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPhase1Handler(dependencies: Phase1Dependencies) {
  return async function handlePhase1(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/v1/auth/login') {
      const state = await createOAuthState({
        secret: dependencies.oauthStateSecret,
        now: dependencies.now,
        randomToken: dependencies.randomToken,
      });
      return new Response(null, {
        status: 302,
        headers: {
          location: dependencies.oauth.authorizationUrl(state.value),
          'set-cookie': state.cookie,
        },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/auth/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const stateCookie = cookieValue(request, 'gcake_oauth_state');
      if (!code || !state || !stateCookie || !await consumeOAuthState(state, stateCookie, {
        secret: dependencies.oauthStateSecret,
        now: dependencies.now,
      })) {
        return jsonError(403, 'FORBIDDEN', 'GitHub 登入狀態已失效，請重新登入。');
      }

      try {
        const accessToken = await dependencies.oauth.exchangeCode(code);
        const identity = authorizeOwner(
          await dependencies.oauth.fetchIdentity(accessToken),
          dependencies.allowedGitHubUserIds,
        );
        const session = await createCmsSession(identity, dependencies.sessions, {
          now: dependencies.now,
          randomToken: dependencies.randomSessionToken,
          randomCsrfToken: dependencies.randomCsrfToken,
        });
        return new Response(null, {
          status: 302,
          headers: {
            location: '/',
            'set-cookie': session.cookie,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('FORBIDDEN:')) {
          return jsonError(403, 'FORBIDDEN', '此 GitHub 帳號未獲授權。');
        }
        return jsonError(502, 'GITHUB_API_FAILED', 'GitHub 登入目前無法完成。');
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/auth/session') {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) {
        return Response.json({ authenticated: false });
      }
      return Response.json({
        authenticated: true,
        user: session.user,
        csrfToken: session.csrfToken,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!rawToken || !session) return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      try {
        requireCsrf(request, session);
      } catch {
        return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。');
      }
      await dependencies.sessions.deleteByRawToken(rawToken);
      return new Response(null, {
        status: 204,
        headers: {
          'set-cookie': 'gcake_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
        },
      });
    }

    if (url.pathname === '/api/v1/previews' || url.pathname.startsWith('/api/v1/previews/')) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      if (!dependencies.previews) return jsonError(503, 'PREVIEW_BUILD_FAILED', '正式預覽服務尚未設定。');
      try {
        if (request.method === 'GET') {
          const id = url.pathname.slice('/api/v1/previews/'.length);
          const job = id ? await dependencies.previews.get(id) : undefined;
          return job ? Response.json(job) : jsonError(404, 'PREVIEW_NOT_FOUND', '找不到或已清除這個預覽。');
        }
        if (request.method === 'POST' && url.pathname === '/api/v1/previews') {
          try { requireCsrf(request, session); } catch { return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。'); }
          const payload = await request.json() as Record<string, unknown>;
          if (typeof payload.repository !== 'string' || typeof payload.slug !== 'string'
            || !SAFE_SLUG.test(payload.slug) || typeof payload.baseRevision !== 'string' || typeof payload.draft !== 'string') {
            return jsonError(400, 'VALIDATION_FAILED', '正式預覽資料格式不正確。');
          }
          return Response.json(await dependencies.previews.create({
            repository: payload.repository, slug: payload.slug, baseRevision: payload.baseRevision, draft: payload.draft,
          }), { status: 201 });
        }
        return jsonError(404, 'NOT_FOUND', '找不到此預覽 API 路徑。');
      } catch (error) {
        return Response.json({ error: { code: 'PREVIEW_BUILD_FAILED', message: 'Astro 正式預覽建置失敗。', details: error instanceof Error ? error.message : undefined, retryable: true } }, { status: 502 });
      }
    }

    if (url.pathname.startsWith('/api/v1/publications/')) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      if (!dependencies.publications) return jsonError(503, 'GITHUB_API_FAILED', '發佈中心尚未設定。');
      const suffix = url.pathname.slice('/api/v1/publications/'.length);
      const [slug, action] = suffix.split('/');
      if (!slug || !SAFE_SLUG.test(slug)) return jsonError(404, 'ARTICLE_NOT_FOUND', '找不到這篇文章。');
      if (request.method === 'GET' && !action) {
        const sourceRevision = url.searchParams.get('sourceRevision');
        if (!sourceRevision) return jsonError(400, 'VALIDATION_FAILED', '缺少文章修訂版。');
        return Response.json({ states: await dependencies.publications.states(slug, sourceRevision) });
      }
      if (request.method === 'POST' && action === 'operations') {
        try { requireCsrf(request, session); } catch { return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。'); }
        const payload = await request.json() as {
          sourceRevision?: unknown; target?: unknown; operation?: unknown;
          newsletterIntentKey?: unknown; explicitIrreversibleIntent?: unknown;
        };
        const targets = new Set(['github_pages', 'paragraph', 'substack']);
        const operations = new Set(['prepare', 'publish', 'verify', 'retry', 'newsletter']);
        if (typeof payload.sourceRevision !== 'string' || typeof payload.target !== 'string' || !targets.has(payload.target)
          || typeof payload.operation !== 'string' || !operations.has(payload.operation)) {
          return jsonError(400, 'VALIDATION_FAILED', '發佈操作資料格式不正確。');
        }
        if (payload.operation === 'newsletter' && (payload.target !== 'paragraph'
          || typeof payload.newsletterIntentKey !== 'string' || !SAFE_NEWSLETTER_INTENT_KEY.test(payload.newsletterIntentKey)
          || payload.explicitIrreversibleIntent !== true)) {
          return jsonError(400, 'NEWSLETTER_EXPLICIT_INTENT_REQUIRED', '寄送電子報需要獨立且明確的不可逆確認。');
        }
        const operationRequest: PublicationOperationRequest = {
          postSlug: slug, sourceRevision: payload.sourceRevision,
          target: payload.target as PublicationTarget, operation: payload.operation as PublicationOperation,
          ...(payload.operation === 'newsletter' ? {
            newsletterIntentKey: payload.newsletterIntentKey as string,
            explicitIrreversibleIntent: true as const,
          } : {}),
        };
        return Response.json(await dependencies.publications.operate(operationRequest));
      }
      return jsonError(404, 'NOT_FOUND', '找不到此發佈 API 路徑。');
    }

    if (url.pathname === '/api/v1/media' || url.pathname.startsWith('/api/v1/media/')) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) {
        return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      }
      if (!dependencies.media) return jsonError(503, 'GITHUB_API_FAILED', '媒體服務尚未設定。');
      if (request.method !== 'GET') {
        try { requireCsrf(request, session); } catch {
          return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。');
        }
      }
      try {
        if (request.method === 'GET' && url.pathname === '/api/v1/media') {
          return Response.json({ media: await dependencies.media.list(url.searchParams.get('q') ?? '') });
        }
        const suffix = url.pathname.slice('/api/v1/media/'.length);
        const [id, action] = suffix.split('/');
        if (request.method !== 'POST' || url.pathname !== '/api/v1/media') {
          if (!id || !SAFE_MEDIA_ID.test(id)) return jsonError(404, 'MEDIA_NOT_FOUND', '找不到這個媒體。');
        }
        const mediaId = id ?? '';
        if (request.method === 'GET' && action === 'usage') {
          return Response.json({ usages: await dependencies.media.usages(mediaId) });
        }
        if (request.method === 'DELETE' && !action) {
          const payload = await request.json() as { confirmed?: unknown };
          const result = await dependencies.media.delete(mediaId, payload.confirmed === true);
          if (result.kind === 'confirmation-required') return jsonError(400, 'CONFIRMATION_REQUIRED', '請明確確認刪除媒體。');
          if (result.kind === 'blocked') {
            return Response.json({ error: { code: 'REFERENCED_RESOURCE', message: '媒體仍被文章引用。', details: { usages: result.usages } } }, { status: 409 });
          }
          return Response.json(result);
        }
        if (request.method === 'POST' && (url.pathname === '/api/v1/media' || action === 'replace')) {
          const form = await request.formData();
          const file = form.get('file');
          const slug = form.get('slug');
          const width = Number(form.get('width'));
          const height = Number(form.get('height'));
          if (!(file instanceof File) || typeof slug !== 'string' || !SAFE_SLUG.test(slug)
            || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
            return jsonError(400, 'VALIDATION_FAILED', '媒體上傳資料格式不正確。');
          }
          const bytes = new Uint8Array(await file.arrayBuffer());
          const input = { slug, name: file.name, mime: file.type, bytes, width, height, hash: await sha256Hex(bytes) };
          const record = action === 'replace'
            ? await dependencies.media.replace(mediaId, input)
            : await dependencies.media.upload(input);
          return Response.json(record, { status: 201 });
        }
        return jsonError(404, 'NOT_FOUND', '找不到此媒體 API 路徑。');
      } catch (error) {
        if (error instanceof MediaValidationError) return jsonError(400, error.code, error.message);
        if (error instanceof Error && error.message === 'MEDIA_NOT_FOUND') return jsonError(404, 'MEDIA_NOT_FOUND', '找不到這個媒體。');
        return jsonError(502, 'GITHUB_API_FAILED', '目前無法處理媒體。');
      }
    }

    if (request.method === 'GET' && (
      url.pathname === '/api/v1/posts'
      || url.pathname.startsWith('/api/v1/posts/')
      || url.pathname === '/api/v1/series'
      || url.pathname.startsWith('/api/v1/series/')
      || url.pathname === '/api/v1/github/deployments/latest'
    )) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) {
        return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      }
      if (!dependencies.github) {
        return jsonError(503, 'GITHUB_API_FAILED', 'GitHub 讀取服務尚未設定。');
      }

      try {
        if (url.pathname === '/api/v1/posts') {
          return Response.json({ posts: await dependencies.github.listPosts() });
        }
        if (url.pathname.startsWith('/api/v1/posts/')) {
          const slug = url.pathname.slice('/api/v1/posts/'.length);
          if (!SAFE_SLUG.test(slug)) return jsonError(404, 'ARTICLE_NOT_FOUND', '找不到這篇文章。');
          const post = await dependencies.github.getPost(slug);
          return post
            ? Response.json(post)
            : jsonError(404, 'ARTICLE_NOT_FOUND', '找不到這篇文章。');
        }
        if (url.pathname === '/api/v1/series') {
          return Response.json({ series: await dependencies.github.listSeries() });
        }
        if (url.pathname.startsWith('/api/v1/series/')) {
          const slug = url.pathname.slice('/api/v1/series/'.length);
          if (!SAFE_SLUG.test(slug)) return jsonError(404, 'SERIES_NOT_FOUND', '找不到這個系列。');
          const series = await dependencies.github.getSeries(slug);
          return series
            ? Response.json(series)
            : jsonError(404, 'SERIES_NOT_FOUND', '找不到這個系列。');
        }
        return Response.json({ deployment: await dependencies.github.getLatestDeployment() });
      } catch {
        return jsonError(502, 'GITHUB_API_FAILED', '目前無法讀取 GitHub 資料。');
      }
    }

    if ((request.method === 'POST' || request.method === 'DELETE')
      && url.pathname.startsWith('/api/v1/posts/')) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) {
        return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      }
      try {
        requireCsrf(request, session);
      } catch {
        return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。');
      }
      if (!dependencies.githubWrites) {
        return jsonError(503, 'GITHUB_API_FAILED', 'GitHub 寫入服務尚未設定。');
      }
      const slug = url.pathname.slice('/api/v1/posts/'.length);
      if (!SAFE_SLUG.test(slug)) return jsonError(404, 'ARTICLE_NOT_FOUND', '找不到這篇文章。');
      try {
        const payload = await request.json() as Record<string, unknown>;
        if (request.method === 'POST') {
          if ('newSlug' in payload) {
            if (typeof payload.newSlug !== 'string' || !SAFE_SLUG.test(payload.newSlug)
              || payload.newSlug === slug || typeof payload.source !== 'string'
              || typeof payload.expectedBlobSha !== 'string'
              || typeof payload.expectedBaseCommitSha !== 'string') {
              return jsonError(400, 'VALIDATION_FAILED', '文章 slug 改名資料格式不正確。');
            }
            if (!dependencies.githubWrites.renamePost) {
              return jsonError(503, 'GITHUB_API_FAILED', '文章 slug 改名服務尚未設定。');
            }
            return Response.json(await dependencies.githubWrites.renamePost({
              slug,
              newSlug: payload.newSlug,
              source: payload.source,
              expectedBlobSha: payload.expectedBlobSha,
              expectedBaseCommitSha: payload.expectedBaseCommitSha,
            }));
          }
          if (!Array.isArray(payload.files) || typeof payload.expectedBaseCommitSha !== 'string' || typeof payload.message !== 'string') {
            return jsonError(400, 'VALIDATION_FAILED', '儲存資料格式不正確。');
          }
          const requested = payload as unknown as SaveContentRequest;
          const postPath = new RegExp(`^src/content/posts/(?:[^/]+/)*${slug}\\.mdx?$`);
          const postFiles = requested.files.filter((file) => postPath.test(file.path));
          const pathsAreBounded = requested.files.every((file) => postPath.test(file.path)
            || /^src\/content\/series\/[a-z0-9][a-z0-9-]*\.ya?ml$/.test(file.path));
          if (postFiles.length !== 1 || !pathsAreBounded) {
            return jsonError(400, 'VALIDATION_FAILED', '儲存路徑不在允許的文章或系列範圍內。');
          }
          const seriesFiles = requested.files.filter((file) => file.path.startsWith('src/content/series/'));
          if (seriesFiles.length && !dependencies.seriesValidator) {
            return jsonError(503, 'GITHUB_API_FAILED', '系列驗證服務尚未設定。');
          }
          const files = requested.files.map((file) => {
            if (!file.path.startsWith('src/content/series/')) return file;
            const manifest = YAML.parse(file.source) as SeriesManifestInput;
            const validated = dependencies.seriesValidator!.validateAndSerialize(manifest);
            if (validated.path !== file.path) throw new InvalidSeriesError(['系列 slug 與檔案路徑不一致']);
            return { ...file, source: validated.yaml };
          });
          const saved = await dependencies.githubWrites.save({ ...requested, files });
          return Response.json(saved);
        }
        if (typeof payload.expectedBlobSha !== 'string' || typeof payload.expectedBaseCommitSha !== 'string') {
          return jsonError(400, 'VALIDATION_FAILED', '刪除資料格式不正確。');
        }
        const deleted = await dependencies.githubWrites.deletePost({
          slug,
          expectedBlobSha: payload.expectedBlobSha,
          expectedBaseCommitSha: payload.expectedBaseCommitSha,
          confirmed: payload.confirmed === true,
        });
        if (deleted.kind === 'confirmation-required') {
          return jsonError(400, 'CONFIRMATION_REQUIRED', '請明確確認刪除。');
        }
        if (deleted.kind === 'blocked') {
          return Response.json({
            error: {
              code: 'REFERENCED_RESOURCE',
              message: '文章仍被系列引用，請先更新系列。',
              details: { seriesReferences: deleted.seriesReferences },
            },
          }, { status: 409 });
        }
        return Response.json(deleted);
      } catch (error) {
        if (error instanceof InvalidSeriesError) {
          return Response.json({ error: { code: 'INVALID_SERIES', message: '系列資料未通過驗證。', details: { issues: error.issues } } }, { status: 400 });
        }
        if (error && typeof error === 'object' && 'code' in error) {
          const conflict = error as { code: unknown; currentBlobSha?: unknown; currentCommitSha?: unknown };
          if (conflict.code === 'ARTICLE_CONFLICT' || conflict.code === 'SERIES_CONFLICT') {
            return Response.json({
              error: {
                code: conflict.code,
                message: 'GitHub 上的內容已更新，未覆蓋較新的版本。',
                details: { currentBlobSha: conflict.currentBlobSha, currentCommitSha: conflict.currentCommitSha },
              },
            }, { status: 409 });
          }
        }
        return jsonError(502, 'GITHUB_API_FAILED', '目前無法寫入 GitHub。');
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/series/')) {
      const rawToken = cookieValue(request, 'gcake_session');
      const session = rawToken ? await dependencies.sessions.findByRawToken(rawToken) : undefined;
      if (!session || session.expiresAt <= (dependencies.now?.() ?? Date.now())) return jsonError(401, 'UNAUTHENTICATED', '請先登入。');
      try { requireCsrf(request, session); } catch { return jsonError(403, 'FORBIDDEN', '安全驗證失敗，請重新整理後再試。'); }
      if (!dependencies.githubWrites || !dependencies.seriesValidator) return jsonError(503, 'GITHUB_API_FAILED', '系列寫入服務尚未設定。');
      try {
        const slug = url.pathname.slice('/api/v1/series/'.length);
        if (!SAFE_SLUG.test(slug)) return jsonError(404, 'SERIES_NOT_FOUND', '找不到這個系列。');
        const payload = await request.json() as {
          manifest?: SeriesManifestInput; expectedBlobSha?: string; expectedBaseCommitSha?: string;
        };
        if (!payload.manifest || payload.manifest.slug !== slug || typeof payload.expectedBlobSha !== 'string' || typeof payload.expectedBaseCommitSha !== 'string') {
          return jsonError(400, 'VALIDATION_FAILED', '系列儲存資料格式不正確。');
        }
        const validated = dependencies.seriesValidator.validateAndSerialize(payload.manifest);
        return Response.json(await dependencies.githubWrites.save({
          expectedBaseCommitSha: payload.expectedBaseCommitSha,
          message: `Update series ${slug}`,
          files: [{ path: validated.path, expectedBlobSha: payload.expectedBlobSha, source: validated.yaml }],
        }));
      } catch (error) {
        if (error instanceof InvalidSeriesError) {
          return Response.json({ error: { code: 'INVALID_SERIES', message: '系列資料未通過驗證。', details: { issues: error.issues } } }, { status: 400 });
        }
        if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'SERIES_CONFLICT') {
          return Response.json({ error: { code: 'SERIES_CONFLICT', message: '系列已在 GitHub 更新，沒有覆蓋較新版本。' } }, { status: 409 });
        }
        return jsonError(502, 'GITHUB_API_FAILED', '目前無法儲存系列。');
      }
    }

    return jsonError(404, 'NOT_FOUND', '找不到此 API 路徑。');
  };
}
