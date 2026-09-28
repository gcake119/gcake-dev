export interface CmsUser {
  readonly githubUserId: string;
  readonly login: string;
  readonly avatarUrl?: string;
}

export interface CmsSession {
  readonly id: string;
  readonly user: CmsUser;
  readonly tokenHash: string;
  readonly csrfToken: string;
  readonly expiresAt: number;
}

export interface SessionStore {
  save(session: CmsSession): Promise<void>;
  findByRawToken(rawToken: string): Promise<CmsSession | undefined>;
  deleteByRawToken(rawToken: string): Promise<void>;
}

export interface TokenOptions {
  readonly now?: () => number;
  readonly randomToken?: () => string;
  readonly randomCsrfToken?: () => string;
}

const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const consumedOAuthStates = new Set<string>();
const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function secureCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function authorizeOwner(user: CmsUser, allowedGitHubUserIds: ReadonlySet<string>): CmsUser {
  if (!allowedGitHubUserIds.has(user.githubUserId)) {
    throw new Error('FORBIDDEN: 此 GitHub 帳號未獲授權。');
  }
  return user;
}

export async function createOAuthState(options: {
  readonly secret: string;
  readonly now?: () => number;
  readonly randomToken?: () => string;
}): Promise<{ value: string; cookieValue: string; cookie: string }> {
  const now = options.now?.() ?? Date.now();
  const value = options.randomToken?.() ?? crypto.randomUUID();
  const signedValue = `${value}.${now}`;
  const signature = await hmac(signedValue, options.secret);
  const cookieValue = `${signedValue}.${signature}`;
  return {
    value,
    cookieValue,
    cookie: secureCookie('gcake_oauth_state', cookieValue, OAUTH_STATE_MAX_AGE_SECONDS),
  };
}

export async function consumeOAuthState(
  state: string,
  cookieValue: string,
  options: { readonly secret: string; readonly now?: () => number },
): Promise<boolean> {
  if (consumedOAuthStates.has(cookieValue)) return false;

  const [cookieState, timestampText, signature] = cookieValue.split('.');
  const timestamp = Number(timestampText);
  if (!cookieState || !signature || cookieState !== state || !Number.isFinite(timestamp)) return false;

  const now = options.now?.() ?? Date.now();
  if (now < timestamp || now - timestamp > OAUTH_STATE_MAX_AGE_SECONDS * 1_000) return false;

  const expected = await hmac(`${cookieState}.${timestampText}`, options.secret);
  if (signature !== expected) return false;

  consumedOAuthStates.add(cookieValue);
  return true;
}

export async function createCmsSession(
  user: CmsUser,
  store: SessionStore,
  options: TokenOptions = {},
): Promise<{ cookie: string; csrfToken: string; expiresAt: number }> {
  const now = options.now?.() ?? Date.now();
  const rawToken = options.randomToken?.() ?? crypto.randomUUID();
  const csrfToken = options.randomCsrfToken?.() ?? crypto.randomUUID();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1_000;
  const tokenHash = await sha256(rawToken);

  await store.save({
    id: crypto.randomUUID(),
    user,
    tokenHash,
    csrfToken,
    expiresAt,
  });

  return {
    cookie: secureCookie('gcake_session', rawToken, SESSION_MAX_AGE_SECONDS),
    csrfToken,
    expiresAt,
  };
}

export function requireCsrf(request: Request, session: CmsSession): void {
  if (request.headers.get('x-csrf-token') !== session.csrfToken) {
    throw new Error('FORBIDDEN: CSRF 驗證失敗。');
  }
}

export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<string, CmsSession>();

  async save(session: CmsSession): Promise<void> {
    this.#sessions.set(session.tokenHash, session);
  }

  async findByRawToken(rawToken: string): Promise<CmsSession | undefined> {
    return this.#sessions.get(await sha256(rawToken));
  }

  async deleteByRawToken(rawToken: string): Promise<void> {
    this.#sessions.delete(await sha256(rawToken));
  }

  containsRawToken(rawToken: string): boolean {
    return this.#sessions.has(rawToken);
  }
}
