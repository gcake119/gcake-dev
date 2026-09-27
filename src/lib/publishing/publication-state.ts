export type TargetPublicationStatus = 'pending' | 'published' | 'publish_failed' | 'verification_failed';

export interface TargetPublicationState {
  status: TargetPublicationStatus;
  remoteId?: string;
  remoteUrl?: string;
  publishedAt?: string;
  publishFailure?: string;
  verificationFailure?: string;
  needsResync: boolean;
  newsletterSent: boolean;
  newsletterSentAt?: string;
}

export interface PostPublicationState {
  sourceRevision: string;
  targets: Partial<Record<'paragraph' | 'substack', TargetPublicationState>>;
}

export interface PublicationStateFile {
  version: 2;
  posts: Record<string, PostPublicationState>;
}
