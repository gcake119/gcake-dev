import type { PortablePublication } from './publication-transform';

export type PublicationTarget = 'paragraph' | 'substack';
export type NewsletterIntent = 'skip' | 'send';
export type PublicationOperation = 'create-draft' | 'update-draft';

export interface PreparePublicationRequest {
  publication: PortablePublication;
  remoteId?: string;
  newsletter: NewsletterIntent;
}

export interface PreparedPublication {
  target: PublicationTarget;
  operation: PublicationOperation;
  newsletter: NewsletterIntent;
  externalWriteEnabled: false;
  interfaceStability: 'official-alpha' | 'no-official-publishing-api';
  payload: unknown;
}

export interface PublishResult {
  remoteId: string;
  remoteUrl?: string;
}

export interface VerifyRequest {
  remoteId: string;
  remoteUrl?: string;
}

export interface VerifyResult {
  public: boolean;
  remoteUrl?: string;
}

export interface PublicationAdapter {
  readonly target: PublicationTarget;
  prepare(request: PreparePublicationRequest): Promise<PreparedPublication>;
  publish(prepared: PreparedPublication): Promise<PublishResult>;
  verify(request: VerifyRequest): Promise<VerifyResult>;
}
