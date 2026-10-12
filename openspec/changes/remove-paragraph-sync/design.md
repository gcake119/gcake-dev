## Context

Git owns article content, D1 owns operational state, and retirement does not authorize deleting published articles or historical evidence. The primary checkout has independent work, so implementation occurs in an isolated checkout.

## Goals / Non-Goals

Goals: remove current integration surfaces, preserve Substack guards and historical state, audit installed execution paths.
Non-Goals: provider calls, publication, delivery, credential changes, database deletion, changing historical migrations, commit, push or deployment.

## Decisions

### Remove provider code instead of retaining a disabled adapter

**Supersedes**: complete-cross-platform-distribution / Existing Paragraph REST service

Executable destination types and config accept only Substack. A legacy stored-target type preserves historical rows without granting operational capability. Active UI filters legacy rows; rejected requests stop before repository access.

### Preserve evidence while removing operating instructions

Historical change archives, migration files, author content and dated acceptance receipts remain. Dedicated current Paragraph guides are removed; shared current guides explain only supported publication and Substack flows.

## Implementation Contract

DistributionCoordinator(repository, substack, now) has no Paragraph service dependency. Its public operations reject unsupported targets before reads or writes. DistributionConfig requires only substack configuration; policy targets must be exactly substack. Existing opaque config properties cannot enable a retired provider. Prepared bundles contain only a substack target. Worker binding requires no retired provider key; routes validate supported targets. Historical publication rows remain stored and are excluded from current actionable state reads. No schema migration is changed or automatically run. Tests exercise rejected CLI/coordinator targets, mixed policies, valid Substack preparation, preserved historical state and unchanged recovery identity. Repository test, check, build:all and release:dry-run are the completion gates.

## Risks / Trade-offs

Old private rollback configs are retained as historical artifacts, not active schedules. Installed runtime changes are handled by their owning conversation; this cleanup does not mutate its pinned code. Public author content mentioning Paragraph is not rewritten. New UI behavior is verified through publishing-center tests and local rendered inspection when available.


## Validation and installed-runtime audit（2026／10／13）

The retired-target acceptance tests had four genuine product failures before implementation and four passing cases afterward. The integrated snapshot includes all unrelated dirty work preserved from the primary checkout. It passed 359 Node tests and 31 Python tests, the 184-file Astro/TypeScript check with no diagnostics, all workspace/site builds, and the release dry run. The release rehearsal used local mock services only; production writes and Telegram network calls were false/zero. Spectra validation passed and analysis reported zero findings.

The primary checkout lacks workspace/module dependencies, so its direct full-gate attempts could not complete. Final gates ran on the same integrated source in /private/tmp/gcake-remove-paragraph-20261013 with working local dependencies. Existing unrelated whitespace findings remain untouched; the retirement file scope passes git diff --check.

The installed LaunchAgent dev.gcake.distribution-sync uses native-substack-final-20261013/unattended.json with targets exactly [substack], runs every 900 seconds, and its first run exited zero. The older pages-paragraph-substack heartbeat is PAUSED. No user crontab exists; the launchd configuration scan found no other distribution job. The process audit found no sync-distribution/run-distribution/retired-provider process running. The latest two installed-runtime D1 receipts, at 04：44：39 and 04：47：40 Taipei time, have empty locks, checkpoints and intents. These are timestamped audit receipts, not a promise about future rounds.

The all-articles-20261012 policy remains a dormant rollback record outside Git; no active scheduler references it. The installed runtime is a separately verified pinned release and was not replaced by repository cleanup. Existing remote IDs, published articles, immutable migrations and unresolved historical evidence are preserved. The removed GitHub workflow was manual dispatch and prepare-only, with no scheduled or provider write operation. Repository changes remain uncommitted and unpushed.


## Independent commit preparation（2026／10／13）

The owner subsequently authorized committing and pushing only this retirement. A HEAD-based candidate was reconstructed from the saved pre-retirement files, excluding all unrelated dirty content and metadata. Mixed package/document files were separated at the content level, and archived evidence uses the committed originals. The standalone candidate passed 345 Node tests, 31 Python tests, the 180-file check with no diagnostics, all builds and the local release rehearsal. The earlier 359-test result above describes the composite working-tree verification, not the scope of this independent commit. The commit will be pushed on codex/remove-paragraph-sync; remote main and the separately installed pinned runtime are not changed.
