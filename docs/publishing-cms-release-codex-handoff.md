# Codex handoff — Publishing CMS long-term release queue

## Current decision

This document is a handoff of product requirements, not evidence that production publishing is complete. Branch `feat/publishing-cms-release-design` is forked from `feat/editorial-release-queue`. Do not activate production publishing or change the body or reading order of the six finalized `ithome-2026-extensions` posts without explicit instruction.

Read in this order:
1. `docs/editorial-release-policy-handoff.md`
2. `docs/publishing-cms-release-queue-spec.md`
3. `src/lib/publishing/release-queue.ts` and tests
4. `docs/publishing-cms-architecture.md`, `docs/publishing-cms-implementation-design.md`
5. `openspec/specs/series-scheduling/spec.md`, `openspec/specs/publishing-operations/spec.md`
6. `apps/admin/src/App.vue`, `apps/admin/src/scheduling.ts`, `apps/admin-worker/src/*`, `src/lib/content/publication.ts`
7. `src/content/series/ithome-2026-extensions.yaml`, `.github/workflows/deploy-pages.yml`

## Work already committed in this branch

- Added `docs/publishing-cms-release-queue-spec.md` (product information architecture, state model, P0/P1, acceptance scenarios).
- Added `src/lib/publishing/release-eligibility.ts` and `.test.ts` (pure snapshot-based whole-manifest eligibility, fail-closed on incomplete/mismatched/missing articles and ambiguous membership).
- Registered both existing planner tests and new eligibility tests in `package.json` `test:public`.
- No production scheduler, queue persistence, CMS routes, Hermes job, GitHub Actions write permission, or release activation was added.
- GitHub connector operations cannot execute the repository test/build pipeline here; `pnpm test`, `pnpm check`, `pnpm build` remain UNVERIFIED, not PASS.

## Existing verified findings

- The existing pure planner is not production-connected, nor can it validate omitted series posts.
- The old CMS has editable per-post schedule UI and Paragraph/Substack target-state display, but no durable aggregate release queue.
- Git is editorial SSOT; D1 is runtime SSOT; R2 is media SSOT.
- The hourly Pages deploy does not promote `ready` to `published`; GitHub Actions write permissions require a safe, explicit solution.
- Hermes runs in a separate local user; Telegram delivery is not proof of page publication.
- Do not assume any existing or newly written test ran in this hosted environment. Run full test/build/static and production-like dry-run locally before any merge or rollout.

## Codex implementation sequence

1. Make an OpenSpec change from the accepted product policy; turn the P0 items in `docs/publishing-cms-release-queue-spec.md` into tasks and acceptance scenarios.
2. Implement robust manifest-wide eligibility + durable D1 ingestion; test unchanged timestamps and partial series.
3. Implement reservation/lease, state machine, idempotent execution and Git atomic changes behind disabled feature gate.
4. Integrate GitHub Actions schedule safely, preserving hourly deploy recovery.
5. Build Admin queue and workflows; retain existing Editor, Series Editor, Publishing Center.
6. Complete RSS / Hermes integration, event/audit/status evidence.
7. Run comprehensive tests and manual UI/design QA.
8. Report on remaining secrets/production permissions and request a single explicit production enablement decision.

Do not silently merge these branches into main and do not mark Oct 12 or later as promised release dates until the scheduler has been activated and checked.
