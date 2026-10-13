## Current completion

The owner authorized production Hermes installation/restart, summary deployment and private read credential, then existing-job activation and scoped commit/push. Installation, rebooted dry-run and natural live execution have passed as recorded in docs/hermes-monitor-evidence/production-live-owner.json. Earlier local-only approval sections are historical stages, not current restrictions. This source closeout preserves the later selected Telegram repair runtime and includes no credentials or live state.

## Why

The owner needs one long-term Hermes monitor for every series and standalone article, without per-article jobs or Codex polling. RSS proves new public content but cannot establish missed formal publication commitments; a minimal read-only projection of the D1 authority is required.

## What Changes

- Add a complete, minimal monitoring summary that distinguishes confirmed commitments from estimates, unscheduled articles, cancellations and unavailable observations. Reading it performs no ingestion, queue update or publication.
- Extend monitoring to all local series and standalone articles automatically, using Git editorial identity/order and independent RSS/canonical-page evidence.
- Preserve hourly checks and silent normal operation. Notify only for new public articles, confirmed overdue publications after a 60-minute grace, and recovery from two consecutive abnormal rounds after two consecutive healthy rounds.
- Preserve existing sent/unknown records, silent historical baseline, exclusive execution and uncertainty handling. Merge overdue recovery into the article notification.
- Plan acceptance-first TDD and separate local, live-read, Telegram-send and human-receipt evidence. This proposal authorizes documentation only.

## Capabilities

### New Capabilities

- `publication-monitor-summary`: Complete, authenticated, read-only projection of formal publication commitments for monitoring.
- `hermes-publication-monitoring`: Universal discovery, public evidence, overdue/recovery policies and durable notification deduplication.
- `hermes-runtime-update-safety`: Immutable approved local releases and complete runtime recovery.
- `hermes-update-entry-integration`: Isolated system-entry adapter, authority/runner permission split and durable supervisor recovery.

### Modified Capabilities

None. The existing series scheduling, publishing operations and durable release queue remain authoritative; this change adds an observer and does not change their publication behavior.

## Impact

Follow-up authorized 2026-10-12: implement Explicit scheduler context and drift-safe rounds locally. Add a reviewed Hermes script-runner patch, source-provenance fixtures and integration tests; wire the monitor CLI to scheduler metadata and preserve missed-round/retry isolation. No installed runtime or job modifications are authorized.

- New specs: publication-monitor-summary and hermes-publication-monitoring.
- Proposed new code: `apps/admin-worker/src/publication-monitor-summary.ts`, `apps/admin-worker/src/publication-monitor-summary.test.ts`, `scripts/hermes/publication_monitor.py`, `scripts/hermes/test_publication_monitor_acceptance.py`, `scripts/hermes/test_publication_monitor_integration.py`, `scripts/hermes/test_publication_monitor_unit.py`.
- Existing runtime integration: Worker route registration and the live Hermes wrapper are located and verified during implementation preflight; no symbol source was inspected in this planning turn.
- Modified documentation: `docs/publishing-cms-release-operations.md` after implementation verification, preserving historical evidence and current activation boundaries.
- Existing gate: `package.json` already includes Python discovery through test:hermes; retain it and the complete repository verification suite.
- External systems: one existing Hermes hourly job and private Telegram destination; D1 remains server-side. No migrations, production writes, gateway changes, credential creation, deployment, commit or push in this planning turn.


## Authorized local updater safety extension

Owner approval 2026-10-13: implement a local-only updater guard, content-bound version manifest and complete runtime recovery, with unknown releases skipped and retained for review. Add `hermes-runtime-update-safety`. Preserve existing completed tasks and production boundaries. New source/test files: `scripts/hermes/updater_guard.py`, `scripts/hermes/test_updater_guard.py`, `scripts/hermes/verify_runtime_update.py`; extend the candidate wrapper renderer with optional managed-release identity checks. No production installer/supervisor adapter, downloads of unknown releases, installed updater changes or live delivery are in scope.

## Authorized local update entry integration extension

Owner accepts the integration direction and authorizes isolated implementation only. Add the authority/runner filesystem contract, immutable release selector, fixed launchd command adapter, first-entry backup/restore transaction and fresh-process interrupted recovery. Implement `scripts/hermes/update_entry.py`, its acceptance tests and a bounded owner-run privilege/launchd drill. Preserve production labels, files, jobs, credentials and platforms. Local same-UID and fake launchctl evidence SHALL remain separate from real root/hermes and isolated system launchd evidence. No automatic production adapter, production operation, commit or push is authorized.

## Authorized combined privileged full gateway extension

Connect the actual root authority and hermes UID, owned test LaunchDaemon, full self-contained Python 3.11.15 Hermes CLI, guarded wrapper and shared synthetic history in one drill. Add Combined privileged full gateway qualification to the existing integration capability. Prebuild hash-bound fixture payloads as the main user, then root seals them and runs candidate code only as hermes. Add `prepare_combined_gateway.py`, `verify_combined_gateway.py`, unit/acceptance coverage and one owner command file. Preserve all prior completed work; no official service/job/configuration/platform operation, Telegram sending or commit/push is authorized. A user-forwardable Hermes message is a handoff only.

## Authorized production rollout extension

Owner authorization on 2026-10-13 supersedes prior production-installation exclusions for the Hermes patch, managed update entry, wrapper and existing gateway restart. After verified operation, update only the existing production monitor job and commit/push this change. Preserve all historical isolated tasks and evidence. Add production-specific fixed path/service mappings, fresh drift checks, durable first-install backup/restore, runner-only private state access, production read-only scheduled qualification and gated activation. Do not infer Telegram test-message authority or replace notification history. A missing summary endpoint or restricted credential blocks monitor activation; owner does not know their configuration, so establish their status rather than guessing. Installer and release artifacts require local acceptance and owner-run execution before production success can be reported.
