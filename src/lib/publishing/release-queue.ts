// CMS and editorial writers share one planner; retain the editorial API spelling.
import { planReleaseQueue as planSharedQueue, type ReleasePlanInput } from '../../../packages/publishing-contract/src/release-queue';
export * from '../../../packages/publishing-contract/src/release-queue';
export function planReleaseQueue(input: ReleasePlanInput & { activeSeries?: string }) {
  return planSharedQueue({ ...input, activeSeriesSlug: input.activeSeriesSlug ?? input.activeSeries });
}
