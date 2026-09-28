export type EditorialSource = 'github';
export type MediaSource = 'r2';
export type RuntimeSource = 'd1';

export interface SourceOfTruthBoundaries {
  editorial: EditorialSource;
  media: MediaSource;
  runtime: RuntimeSource;
}

export const SOURCE_OF_TRUTH: Readonly<SourceOfTruthBoundaries> = Object.freeze({
  editorial: 'github',
  media: 'r2',
  runtime: 'd1',
});

export interface GitHubContentAdapter {
  readonly source: 'github';
}

export interface R2MediaAdapter {
  readonly source: 'r2';
}

export interface D1RuntimeAdapter {
  readonly source: 'd1';
}

export type ProviderTarget = 'paragraph' | 'substack';

export interface ProviderWriteFlags {
  readonly paragraph: boolean;
  readonly substack: boolean;
}

export const DEFAULT_PROVIDER_WRITE_FLAGS: Readonly<ProviderWriteFlags> = Object.freeze({
  paragraph: false,
  substack: false,
});

export function assertProviderWriteEnabled(
  target: ProviderTarget,
  flags: Readonly<ProviderWriteFlags>,
): void {
  if (flags[target] !== true) {
    throw new Error(`${target} production write is disabled until explicitly enabled`);
  }
}
