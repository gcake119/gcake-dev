## Why

The owner requested the next active personal repository migration and approved increasing the four-core Mint host's shared CPU quota from 200% to 300%. gcake-dev is the most recently active unconfigured Linux repository; its validation currently assumes disposable hosted runners with sudo and Chrome installation.

## What Changes

- Add a sixth repository-scoped Mint runner under the existing unprivileged account, rootless engine, shared 16/20GiB memory budget and host build lock; raise aggregate CPU time to 300% without affinity changes.
- Move trusted PR/main validation to Mint with per-job pnpm/tool isolation, pre-provisioned Chrome and a private disposable /private/tmp test namespace; forks remain hosted.
- Preserve every existing test, build, dry-run and rehearsal gate without provider writes; independently review and verify actual GitHub jobs and cross-repository Docker lock behavior.

## Capabilities

### New Capabilities

- `mint-ci-verification`: Trusted low-privilege validation on the shared Mint host with isolated fixtures and unchanged provider boundaries.

### Modified Capabilities

None.

## Impact

Modified: .github/workflows/validate-pr.yml, .github/workflows/validate-editorial.yml, scripts/publishing/deployment-rehearsal.test.ts, scripts/workspace/foundation.test.ts, docs/decisions/index.md. New: scripts/ci/prepare-validation.sh and focused CI tests. Host repository: fixed gcake-dev installer, administrator CPU/tool setup, shared budget checker/allowlist and runner inventory. No product runtime, publication schedule, deployment workflow, credentials, browser profile or content changes; no application Docker image exists to migrate.
