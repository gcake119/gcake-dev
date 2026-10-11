import { HEALTH_CONTRACT_VERSION, type HealthResponse } from '@gcake/admin-contract';
import { D1SessionStore, type SessionDatabase } from './auth.js';
import { readProviderWriteFlags, type WorkerBindings } from './bindings.js';
import { GitHubAppInstallationTokenProvider, GitHubAppReadClient, GitHubAppWriteClient } from './github.js';
import { createPhase1Handler, type OAuthClient } from './router.js';

import { ReleaseQueue, D1ReleaseStore } from './release-queue.js';
import { validateAndSerializeSeries } from './series-validation.js';
import { ReleaseDelivery } from './release-delivery.js';

export const serviceName = 'gcake-admin-worker' as const;

export interface WorkerEnv extends WorkerBindings {
  readonly CMS_DB?: SessionDatabase;
  readonly GITHUB_OAUTH_CLIENT_ID?: string;
  readonly GITHUB_OAUTH_CLIENT_SECRET?: string;
  readonly GITHUB_OWNER_USER_IDS?: string;
  readonly GITHUB_APP_ID?: string;
  readonly GITHUB_APP_INSTALLATION_ID?: string;
  readonly GITHUB_APP_PRIVATE_KEY?: string;
  readonly OAUTH_STATE_SECRET?: string;
  readonly RELEASE_WRITE_ENABLED?: string;
  readonly RELEASE_AUTOMATION_SECRET?: string;
  readonly RELEASE_DEPLOY_RETRY_ENABLED?: string;
}

function runtimeNotConfigured(message: string): Response {
  return Response.json({ error: { code: 'RUNTIME_NOT_CONFIGURED', message } }, { status: 503 });
}

function ownerIds(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function githubOAuth(env: WorkerEnv, fetcher: typeof fetch = fetch): OAuthClient | undefined {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  return {
    authorizationUrl(state) {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('state', state);
      return url.toString();
    },
    async exchangeCode(code) {
      const response = await fetcher('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const payload = (await response.json()) as { access_token?: unknown };
      if (!response.ok || typeof payload.access_token !== 'string') {
        throw new Error('GITHUB_API_FAILED: OAuth token exchange failed');
      }
      return payload.access_token;
    },
    async fetchIdentity(accessToken) {
      const response = await fetcher('https://api.github.com/user', {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${accessToken}`,
          'user-agent': 'gcake-admin-worker',
          'x-github-api-version': '2022-11-28',
        },
      });
      const payload = (await response.json()) as {
        id?: unknown;
        login?: unknown;
        avatar_url?: unknown;
      };
      if (!response.ok || (typeof payload.id !== 'number' && typeof payload.id !== 'string') || typeof payload.login !== 'string') {
        throw new Error('GITHUB_API_FAILED: OAuth identity lookup failed');
      }
      return {
        githubUserId: String(payload.id),
        login: payload.login,
        avatarUrl: typeof payload.avatar_url === 'string' ? payload.avatar_url : undefined,
      };
    },
  };
}

export async function handleRequest(request: Request, env: WorkerEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    const payload: HealthResponse = {
      status: 'ok',
      service: serviceName,
      contractVersion: HEALTH_CONTRACT_VERSION,
    };

    return Response.json(payload);
  }

  if (url.pathname.startsWith('/api/v1/')) {
    try {
      readProviderWriteFlags(env);
    } catch {
      return runtimeNotConfigured('外部發佈開關設定無效，所有寫入已停用。');
    }
    if (!env.CMS_DB) return runtimeNotConfigured('CMS 執行資料庫尚未設定。');

    const oauth = githubOAuth(env, fetcher);
    const owners = ownerIds(env.GITHUB_OWNER_USER_IDS);
    const installationTokens =
      env.GITHUB_APP_ID && env.GITHUB_APP_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY
        ? new GitHubAppInstallationTokenProvider({
            appId: env.GITHUB_APP_ID,
            installationId: env.GITHUB_APP_INSTALLATION_ID,
            privateKey: env.GITHUB_APP_PRIVATE_KEY,
            fetch: fetcher,
          })
        : undefined;
    const github = installationTokens ? new GitHubAppReadClient({ installationTokens, fetch: fetcher }) : undefined;
    const githubWrites = installationTokens ? new GitHubAppWriteClient({ installationTokens, fetch: fetcher }) : undefined;
    const releases =
      github && githubWrites
        ? new ReleaseDelivery(
            new ReleaseQueue(new D1ReleaseStore(env.CMS_DB), undefined, env.RELEASE_WRITE_ENABLED === 'true'),
            {
              snapshot: () => github.releaseSnapshot(),
              save: (input) => githubWrites.save(input),
              deployment: () => github.getPagesDeployment(),
              ...(env.RELEASE_DEPLOY_RETRY_ENABLED === 'true'
                ? {
                    retryDeployment: (sha: string) => github.retryPagesDeployment(sha),
                  }
                : {}),
            },
            env.RELEASE_WRITE_ENABLED === 'true',
            fetcher,
          )
        : undefined;
    if (url.pathname === '/api/v1/release-automation') {
      if (
        request.method !== 'POST' ||
        !env.RELEASE_AUTOMATION_SECRET ||
        request.headers.get('authorization') !== 'Bearer ' + env.RELEASE_AUTOMATION_SECRET
      )
        return Response.json({ error: { code: 'FORBIDDEN', message: '排程執行未獲授權。' } }, { status: 403 });
      if (env.RELEASE_WRITE_ENABLED !== 'true')
        return Response.json(
          {
            error: { code: 'RELEASE_DISABLED', message: '正式發布尚未啟用。' },
          },
          { status: 409 },
        );
      if (!releases) return runtimeNotConfigured('排程服務尚未設定。');
      try {
        const snapshot = await github!.releaseSnapshot();
        const view = await releases.queue.ingest(snapshot);
        for (const record of view.releases.filter(
          (r) =>
            r.state !== 'verified-public' &&
            r.state !== 'committed-slot' &&
            r.state !== 'failed' &&
            (r.state !== 'publishing' || Date.parse(r.leaseUntil) <= Date.now()),
        ))
          await releases.reverify(record.id);
        return Response.json({ release: await releases.execute() });
      } catch {
        return Response.json(
          {
            error: {
              code: 'RELEASE_FAILED',
              message: '排程未完成，請查看紀錄。',
            },
          },
          { status: 409 },
        );
      }
    }
    const isOAuthRoute = url.pathname === '/api/v1/auth/login' || url.pathname === '/api/v1/auth/callback';
    if (isOAuthRoute && (!oauth || !env.OAUTH_STATE_SECRET || owners.size === 0)) {
      return runtimeNotConfigured('CMS 登入服務尚未完成設定。');
    }

    return createPhase1Handler({
      oauth: oauth ?? {
        authorizationUrl: () => {
          throw new Error('RUNTIME_NOT_CONFIGURED');
        },
        exchangeCode: async () => {
          throw new Error('RUNTIME_NOT_CONFIGURED');
        },
        fetchIdentity: async () => {
          throw new Error('RUNTIME_NOT_CONFIGURED');
        },
      },
      sessions: new D1SessionStore(env.CMS_DB),
      github,
      githubWrites,
      releases,
      seriesValidator: github
        ? {
            async validateAndSerialize(manifest) {
              const snapshot = await github.releaseSnapshot();
              const result = validateAndSerializeSeries(manifest, {
                existingMarkdownSlugs: new Set(snapshot.posts.map((p) => p.slug)),
              });
              return { yaml: result.yaml, path: result.pathsToWrite[0] };
            },
          }
        : undefined,
      allowedGitHubUserIds: owners,
      oauthStateSecret: env.OAUTH_STATE_SECRET ?? '',
    })(request);
  }

  return Response.json({ error: { code: 'NOT_FOUND', message: '找不到此 API 路徑。' } }, { status: 404 });
}

export default {
  fetch(request: Request, env: WorkerEnv, _context?: unknown): Promise<Response> {
    return handleRequest(request, env, globalThis.fetch.bind(globalThis));
  },
};
