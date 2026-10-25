## Context

Mint i5-7400 has four physical cores and four threads, 31GiB RAM; measured idle CPU was 83–90%, available memory24GiB, shared quota200%, high16GiB/max20GiB. Cumulative cgroup throttling is evidence of prior quota use, not a current utilization percentage. Owner explicitly selected300%. gcake-dev main d1a7b86 uses Node24/pnpm10.17.1, Chrome fixture tests and a fixed /private/tmp Hermes test namespace. Its scheduled editorial job failed before this migration; repairing or triggering it is out of scope.

## Goals / Non-Goals

Goals: aggregate300% CPU budget, sixth runner, full unchanged trusted PR/main validation, rootless shared lock and actual CI acceptance.

Non-Goals: no real Substack/Cloudflare/Pages publication, release/notification enablement, Docker application image, privileged runner, ordinary browser profile, backup access, product changes, OOM test, archive or recovery cleanup. Deployment/release workflows remain hosted and are not manually triggered.

## Decisions

### Three CPU times are a shared ceiling, not pinned cores

Persist CPUQuota300% while retaining memory16/20GiB and Tasks4096. Verify cpu.max ratio3 and shared daemon placement; no affinity change. Four-core headroom is a resource estimate, not an exclusive reserved core or throughput promise. Keep Backend's constrained scheduler unchanged.

### Trusted validation uses isolated Mint tools and fixtures

Same-repository jobs use repo-gcake-dev; forks retain hosted. Administrator provisions Chrome and required Linux libraries, while Mint jobs have no sudo. Keep Node24 and pnpm10.17.1, per-job pnpm install/store; validation only queries Docker information and needs no registry authentication. Preserve the hardcoded /private/tmp guard by creating a service-private size=8G tmpfs at /private, with /private/tmp owned0700 by ci-runner and unique per-fixture descendants; do not widen the Hermes authority allowlist. PrivateTmp remains enabled for /tmp. The explicit8GiB virtual capacity preserves the existing4GiB disk-budget guard; it is not preallocated RAM and remains within the shared memory ceiling. The /private mount lasts for the service lifetime, not a fresh mount for every job; fixtures use unique paths and their own cleanup. Browser tests retain actual channel chrome. Inspect native Linux prerequisites before installation and prove Chrome launches as ci-runner.

### Provider workflow boundaries remain unchanged

Migrate only validate-pr and validate-editorial; retain false release/notify flags and permissions contents:read. Preserve install/test/check/build/dry-run/rehearsal failure propagation. Cross-repo Docker jobs build only owned acceptance images under the original lock and verify the shared budget; they do not introduce a new application publisher.

## Implementation Contract

Behavior: trusted validation executes all original gates on Mint under aggregate300%/16/20GiB/4096; forks hosted. Prepare helper rejects wrong account/repo/socket/tools before exporting environment. Fixed installer registers only gcake-dev, never grants sudo. Browser and Hermes fixtures use synthetic local data only. CPU setup validates known existing configuration, preserves lock inode and records rollback copy; failure is visible. Pre-provision dependencies rather than adding sudo to Mint jobs. Preserve every test assertion/timeout; compatibility changes require focused failure reproduction and review.

Acceptance: focused helper/route/error-propagation checks, original full test/check/build/dry-run/rehearsal, actual trusted PR/main jobs, independent read-only review, exact head/base/full diff/checks/threads before normal merge, two real repo lock builds and host kernel quota readback. Final evidence distinguishes prior hosted failure, local fixtures, Mint execution and unexecuted provider/deployment paths. Source and evidence only; no archive.

## Risks / Trade-offs

Six runners share a Unix account and daemon and therefore require equal trust.300% can still contend with backup IO and does not guarantee a 50% speedup. Chrome may require native libraries; fail closed if sandbox/permissions cannot support the existing tests. Preserve the fixed native test namespace rather than borrowing private management data.
