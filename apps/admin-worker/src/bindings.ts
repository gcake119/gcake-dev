import {
  type ProviderWriteFlags,
} from '@gcake/publishing-contract';

export interface WorkerBindings {
  readonly CMS_DB?: unknown;
  readonly MEDIA_BUCKET?: unknown;
  readonly SUBSTACK_WRITE_ENABLED?: string;
}

function parseDisabledByDefaultFlag(
  name: 'SUBSTACK_WRITE_ENABLED',
  value: string | undefined,
): boolean {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`${name} must be either "true" or "false"`);
}

export function readProviderWriteFlags(bindings: WorkerBindings): ProviderWriteFlags {
  return {
    substack: parseDisabledByDefaultFlag(
      'SUBSTACK_WRITE_ENABLED',
      bindings.SUBSTACK_WRITE_ENABLED,
    ),
  };
}
