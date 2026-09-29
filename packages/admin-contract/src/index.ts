export const HEALTH_CONTRACT_VERSION = 'v1' as const;

export interface HealthResponse {
  status: 'ok';
  service: 'gcake-admin-worker';
  contractVersion: typeof HEALTH_CONTRACT_VERSION;
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return candidate.status === 'ok'
    && candidate.service === 'gcake-admin-worker'
    && candidate.contractVersion === HEALTH_CONTRACT_VERSION;
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ARTICLE_NOT_FOUND'
  | 'SERIES_NOT_FOUND'
  | 'ARTICLE_CONFLICT'
  | 'SERIES_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'CONFIRMATION_REQUIRED'
  | 'REFERENCED_RESOURCE'
  | 'MEDIA_TYPE_NOT_ALLOWED'
  | 'MEDIA_TOO_LARGE'
  | 'MEDIA_KEY_INVALID'
  | 'MEDIA_NOT_FOUND'
  | 'INVALID_SERIES'
  | 'INVALID_PUBLICATION_TIME'
  | 'PREVIEW_BUILD_FAILED'
  | 'PREVIEW_NOT_FOUND'
  | 'GITHUB_API_FAILED';

export interface MediaRecord {
  readonly id: string;
  readonly key: string;
  readonly url: string;
  readonly mime: 'image/webp' | 'image/png' | 'image/svg+xml';
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly createdAt: string;
  readonly replacedMediaId?: string;
}

export interface SaveFileInput {
  readonly path: string;
  readonly expectedBlobSha?: string;
  readonly source?: string;
}

export interface CreateSeriesRequest {
  readonly title: string;
  readonly slug: string;
  readonly expectedBaseCommitSha: string;
}

export interface UpdateSeriesRequest {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
}

export interface DeleteSeriesRequest {
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
  readonly confirmed: boolean;
}

export interface SaveContentRequest {
  readonly expectedBaseCommitSha: string;
  readonly message: string;
  readonly files: readonly SaveFileInput[];
}

export interface SaveContentResponse {
  readonly commitSha: string;
  readonly paths: readonly string[];
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: unknown;
    readonly retryable?: boolean;
  };
}

export interface AuthenticatedUser {
  readonly githubUserId: string;
  readonly login: string;
  readonly avatarUrl?: string;
}

export type SessionResponse = {
  readonly authenticated: false;
} | {
  readonly authenticated: true;
  readonly user: AuthenticatedUser;
  readonly csrfToken: string;
};

export interface PostSummary {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly status: string;
  readonly series: readonly PostSeriesMembership[];
  readonly blobSha: string;
  readonly commitSha: string;
}

export interface PostSource {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly status: string;
  readonly source: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
  readonly series: readonly PostSeriesMembership[];
  readonly baseBlobSha?: string;
  readonly baseCommitSha: string;
}

export interface PostSeriesMembership {
  readonly slug: string;
  readonly title: string;
  readonly sectionId: string;
  readonly position: number;
}

export interface SeriesSource {
  readonly slug: string;
  readonly title: string;
  readonly postCount: number;
  readonly path: string;
  readonly source: string;
  readonly baseBlobSha: string;
  readonly baseCommitSha: string;
}

export interface DeploymentObservation {
  readonly state: 'pending' | 'building' | 'deployed' | 'failed';
  readonly commitSha: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly url?: string;
}

export interface PreviewJob {
  readonly id: string;
  readonly repository: string;
  readonly postSlug: string;
  readonly baseRevision: string;
  readonly draftHash: string;
  readonly status: 'queued' | 'running' | 'ready' | 'failed' | 'expired';
  readonly url?: string;
  readonly error?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export type PublicationTarget = 'github_pages' | 'paragraph' | 'substack';
export type PublicationOperation = 'prepare' | 'publish' | 'verify' | 'retry' | 'newsletter';
export interface PublicationOperationRequest {
  readonly postSlug: string;
  readonly sourceRevision: string;
  readonly target: PublicationTarget;
  readonly operation: PublicationOperation;
  readonly newsletterIntentKey?: string;
  readonly explicitIrreversibleIntent?: true;
}
export type PublicationTargetStatus = 'not_configured' | 'prepare_ready' | 'pending' | 'published' | 'verified' | 'failed' | 'manual_required' | 'stale';
export interface PublicationTargetState {
  readonly postSlug: string;
  readonly target: PublicationTarget;
  readonly sourceRevision: string;
  readonly status: PublicationTargetStatus;
  readonly remoteId?: string;
  readonly remoteUrl?: string;
  readonly verifiedAt?: string;
  readonly newsletterSentAt?: string;
  readonly lastErrorCode?: string;
  readonly updatedAt: string;
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === 'string'
    && candidate.code.length > 0
    && typeof candidate.message === 'string'
    && candidate.message.length > 0;
}

export function isSessionResponse(value: unknown): value is SessionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.authenticated === false) return true;
  if (candidate.authenticated !== true || typeof candidate.csrfToken !== 'string') return false;
  const user = candidate.user;
  if (typeof user !== 'object' || user === null) return false;
  const identity = user as Record<string, unknown>;
  return typeof identity.githubUserId === 'string' && typeof identity.login === 'string';
}
