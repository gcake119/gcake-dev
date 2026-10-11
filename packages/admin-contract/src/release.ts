export type ReleaseState =
  | 'committed-slot'
  | 'publishing'
  | 'awaiting-verification'
  | 'verified-public'
  | 'failed'
  | 'verification-unknown';
export interface ReleaseRecord {
  id: string;
  slug: string;
  seriesSlug?: string;
  slot: string;
  sourceRevision: string;
  state: ReleaseState;
  lease: string;
  leaseUntil: string;
  attempts: number;
  commitSha?: string;
  error?: string;
  unlockedAt?: string;
  pageVerifiedAt?: string;
  rssGuid?: string;
  verifiedAt?: string;
  deployment?: { state: string; commitSha: string; url?: string };
  nextRetryAt?: string;
  events: { at: string; type: string; detail?: string }[];
}
export interface QueueItem {
  slug: string;
  title: string;
  seriesSlug?: string;
  order?: number;
  readyAt?: string;
  contentStatus: string;
  postPaused: boolean;
  seriesPaused: boolean;
  state: string;
  reason?: string;
  estimatedAt?: string;
  notification: 'external-unreported';
}
export interface QueueView {
  version: number;
  revision: string;
  enabled: boolean;
  items: QueueItem[];
  plan: { slug: string; releaseAt: string }[];
  releases: ReleaseRecord[];
  blockedSeries: { seriesSlug: string; reasons: string[] }[];
  seriesReadyAt: Record<string, string>;
}
export interface OverridePreview {
  version: number;
  revision: string;
  releaseAt: string;
  conflicts: string[];
  before: { slug: string; releaseAt: string }[];
  after: { slug: string; releaseAt: string }[];
  affected: { slug: string; before?: string; after?: string }[];
}
export interface QueueControl {
  action: 'pause' | 'resume' | 'adopt-auto' | 'override' | 'cancel-override' | 'unlock';
  slug: string;
  scope?: 'post' | 'series';
  releaseAt?: string;
  version?: number;
  revision?: string;
  confirmed?: boolean;
}
