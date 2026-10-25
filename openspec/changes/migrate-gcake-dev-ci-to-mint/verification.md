# Mint validation migration evidence

Work item: migrate-gcake-dev-ci-to-mint, 2026-10-26 Asia/Taipei. Application base d1a7b86341f84fe54d9dce3b3d2d7b76fa78c711; host repository base93b83989d73e4d118d375d78956eced43c354166. Final PR/main integration remains pending until the exact remote results below are completed.

## Selection and authority

Fresh activity queries covered67 nonempty, nonarchived, unconfigured personal repositories. gcake-dev was most recently active: Editorial release queue40209954021, started2026-10-26 00:04:45 Asia/Taipei, failed before this migration. That provider-facing failure is preserved and is not repaired or retried here. This repository has Linux validation and static builds, but no application Docker image. Only validate-pr and validate-editorial migrate; the three provider/deployment workflows remain byte-identical to base and are not manually triggered.

Owner explicitly selected CPUQuota300%, retaining shared MemoryHigh16GiB, MemoryMax20GiB and Tasks4096. Mint is an i5-7400 with4 physical cores/4 threads and31GiB RAM. Before adjustment a short idle sample showed83–90% idle CPU and24GiB available memory. These are observations, not a throughput benchmark.300% is an aggregate CPU-time ceiling, not affinity or a guaranteed exclusive spare core or50% faster tests. Cumulative throttling counters are not current utilization percentages.

## Host implementation and observations

Fixed gcake-dev installer used the existing official runner2.338.1 archive SHA25608e9ccb3604d2462c24b5e33604dc30810296ca15cc65f23cffd4317eb144c37 and memory/stdin registration token. mint-gcake-dev is online, service active/enabled under the original ci-runner/user-995.slice/rootless daemon/template. No sudo or rootful Docker permission was added. CPU update backed up the known configuration, changed persistent and runtime quota, confirmed kernel ratio3 and unchanged memory/tasks, and preserved the original lock inode. Initial5 host source files independently reviewed: diff1f3fde152dde321b0dcaa3fc1632c5adc099ec44b838eddac512089db88cd446, no unresolvedP0/P1/P2.

Google Chrome156.0.8078.47 was installed through a signed official repository, using active primary fingerprintEB4C1BFD4F042F6DDDCCEC917721F63BD38B4796 verified against [Google's official Linux repository instructions](https://www.google.com/linuxrepositories/). Only the temporary Google source was refreshed; the unrelated existing Cursor signature problem was not bypassed or changed. The package owns its normal update source. Tools source final SHA256816bd8553c69ef5966a734fba57384bda86f1cea10ac5598f01d2a607a7938f4 independently reviewed.

Only gcake-dev gets a service-private /private tmpfs, size8G. Existing PrivateTmp remains for /tmp, and /private/tmp is created0700 by ci-runner. The mount lasts for the service lifetime; it is not a new mount on every job. Individual fixtures retain unique paths and their own cleanup.8G is virtual capacity, not preallocated RAM; allocated pages still count against shared16/20GiB. Only the new runner was restarted after its API busy=false check; the other five services were not restarted. No host /private data or ordinary browser profile is bound into the service.

## Failures and focused checks

The first local full attempt used systemd's default tmpfs capacity. Read-only inspection in the actual runner namespace measured3,360,018,432 bytes, below the existing Hermes4GiB free-space guard.32 failures among290 Hermes tests were retained in gcake-local-default-tmpfs-failure.log. Configuration was corrected to8G; the original guard, assertions and timeouts were not modified. Prepare now fails clearly before environment publication if available space is insufficient.

The next attempt passed Hermes290 tests with24 existing platform skips, then stopped on a foundation test that searched directly for the former Chrome install command in YAML. Its single literal now requires the browser helper exactly once. The existing executable shell fixture still checks the original hosted Chrome installation command, complete pnpm command order and exit73 for every simulated failure. It copies and executes the real helper, with bounded synthetic hosted environment.21 focused tests passed under umask077; this is not a waived Chrome gate.

Routing test first failed because the actual workflow was hosted rather than Mint. The absent new helper was initially an interface/setup absence, not a separate behavioral RED claim. Account and socket rejection tests now execute the actual helper and require no environment output. Separate administrator-created transient units, running as ci-runner with no new privileges, masked Chrome or omitted the private mount: actual helper returned MINT_CI_TOOLS / MINT_CI_PRIVATE_MOUNT respectively and left GITHUB_ENV empty. Neither installed Chrome nor the normal runner was modified. Probe log: gcake-negative-preflight.log, exit0.

## Complete local verification

All original commands completed with LOCAL_CI_EXIT=0: pnpm test; pnpm check; pnpm build:all; pnpm release:dry-run; pnpm editorial:rehearse. Install used frozen lockfile and the repository's exact pnpm10.17.1, Node24.22.1. The complete test command includes Hermes, all workspaces, browser fixtures, public content and observability. Hermes reported290 tests/24 existing platform skips; no new skip was added. Dry-run and rehearsal reported productionWrites=false and telegramNetworkCalls=0.

This ran in a temporary nonprivileged User=yi-chun unit with UMask0077, NoNewPrivileges, private8G fixture mount and the same user-995.slice CPU/memory ceiling. Source HEAD remained base d1a7b86 plus the reviewed working diff during the complete command; it is development-only evidence, not a claim that a committed release SHA was locally executed. Changes before the initial PR commit were evidence/ledger/spec text only; the later TMPDIR correction and its separately scoped checks are recorded below. Raw result: /tmp/homeinfra-tools/gcake-local-full-ci.log. Application runtime, package manifest/lock and provider workflows were unchanged.

Independent final implementation review covered five files: both validation workflows, prepare-validation.sh, deployment-rehearsal.test.ts and foundation.test.ts. Full scope diff SHA25632e48d1b1011b1fff094d8c21e98d790e38f789d35c943edde6681969e568adb; no unresolvedP0/P1/P2.

## Real cross-repository execution

Fresh batch55ed37b2ae1b4b0d8cbd7b56fae269a6: gcake-dev40215127417 and Document Engine40215127358 both succeeded. Owner-only acceptance branch, permissions empty, no app checkout, secrets or registry push. Per-repo exclusive claim prevents a rerun from silently reusing the batch; any new acceptance needs a new paired batch.

Both jobs confirmed actual kernel CPU300%, memory16/20GiB, Tasks4096 and shared rootless daemon. gcake-dev also verified actual /private tmpfs total8GiB/free>4GiB, fixed private fixture directory permissions and real Chrome headless rendering of a fixed data URL using a fresh temporary profile. No ordinary profile or provider content was opened. Its no-sandbox setting matches the installed Playwright1.58.2 default, confirmed from chromium.js; it does not change the original fixture launch contract or runner privileges.

Build intervals: gcake-dev[38112.685580619,38122.730507967], Document Engine[38122.773279976,38131.67365196]; overlap=false, handoff about0.043seconds. Actual jobs rendezvoused before build admission. GC workflow SHA2563d8a18a4665cf12b4e445cdb7a9b92fa9be7605aac0d4756f53f94f6cbfdd17f; DE096b5f047c437a7422c6fc6f1d7923ba6614ec71080ffddc8a8bb38811d4cbcb; independent review passed. Earlier free-space-only proof was strengthened with total==8GiB rather than claiming it proved capacity. Acceptance branches/commitsfd4e67331c9b671b0f65e834dad6feaa49d93dbe and1b3f65162fe3b2084d50e74468754fa382c4ecfe remain for recovery and are not merged as product code.

## Requirement mapping and remaining integration

| Requirement | Implementation and coverage | Execution |
| --- | --- | --- |
| Trusted validation preserves complete gates on Mint | Both workflows, real hosted shell/exit73 test, same-repo/fork route assertions, original test/check/build/dry-run/rehearsal | Local complete pass; real owning PR/main pending |
| Fixtures retain safe native boundaries | prepare helper, unchanged Hermes guard, actual missing-Chrome/mount negative probes, fixed data-URL Chrome and real original browser fixtures | Local/probe/cross jobs passed; owning PR/main pending |
| Six runners share three CPU times and the existing build lock | Persistent/runtime CPU update, installed budget checker, fixed allowlist, two real repo build intervals | Actual kernel/shared daemon/lock passed |

Spec validate/analyze passed without findings after adding the concrete missing-Chrome example. Required review/fresh head/base/full diff/local scope/GitHub checks/threads/mergeability will be rechecked before ordinary exact-SHA merge. Classic branch-protection API returns404, but active repository rulesets enforce pull requests, strict required validate checks, deletion and non-fast-forward protection. The required approving review count is0; commits are attributed to gcake119. These rulesets, complete check rollup, reviews/threads and fresh base are explicitly checked before ordinary merge; no integration bypass is used.

Not-run/excluded: real external fork execution, production browser/readiness, provider publication/notification, deployment, CPU/OOM saturation and a post-install whole-host reboot. Fork routing has source/unit coverage; synthetic release/rehearsal and Chrome data URL are not provider acceptance. Existing editorial queue failures and unrelated worktrees remain untouched. No archive or recovery-ref cleanup is authorized.

## First owning PR and same-device temporary output

[PR71](https://github.com/gcake119/gcake-dev/pull/71), initial head01959d6d959fec9a60a1814b39a02ddab568e0f0, was independently reviewed as full12-file diffc3354cc069ada8d8cedc97b14da721ff80bef0f375783b49fbbff5f248233374. Actual Mint [run40215805683](https://github.com/gcake119/gcake-dev/actions/runs/40215805683) passed preparation and the preceding full test groups, then observability failed with EXDEV: Astro tried to rename workspace prerender output into os.tmpdir() under the service-private /tmp on another filesystem. The local checkout and local default temporary path had shared a filesystem, so its green result did not prove this service boundary. Failure loggcake-first-pr-failure.log is retained. No prior failure was cancelled or relabelled successful.

Mint prepare now creates a0700 per-run/attempt/job TMPDIR under RUNNER_TEMP and confirms its device matches GITHUB_WORKSPACE before publishing environment. PrivateTmp remains enabled and the original observability/Astro test is unchanged. [GitHub documents RUNNER_TEMP cleanup](https://docs.github.com/en/actions/reference/workflows-and-actions/variables) at job boundaries; files here are owned by the runner, and the directory remains available through post-actions rather than being deleted prematurely. Hosted behavior is unchanged.

Real ci-runner transient probes of the actual updated helper confirmed: different workspace/temp devices yield MINT_CI_TMP_DEVICE and empty GITHUB_ENV; same-device preparation publishes the exact unique TMPDIR with owner995/mode0700. Probe loggcake-tempdir-preflight-probe.log exit0.21 focused tests passed; the original observability test passed again with same-device TMPDIR (gcake-observability-same-device.log). Original app/tests/packages remain identical to the earlier full local pass; those unaffected results are reused with the new scoped helper/probe/observability evidence, not represented as a new complete local command. A fresh entire owning PR run is required for this change.

## Short temporary prefix for Chrome

The same-device fix initially encoded full run/attempt/job identifiers in TMPDIR. The final review-document update a48095a triggered full run40217013549 (the preceding513be16 run40216776992 was superseded by normal workflow concurrency). During abnormally long browser testing, a separate fixed-data-URL probe reproduced Chrome FATAL Socket path too long with a97-character TMPDIR. That known-invalid environment run was cancelled and its log retained; it is not reported as a passing or completed test suite. No timeout/assertion was increased.

Mint TMPDIR now uses a short unique mktemp suffix under the runner-managed job temporary root, enforces a conservative60-character maximum, retains0700 creation and the workspace device check. Run/attempt/job isolation is provided by the job-scoped RUNNER_TEMP lifecycle plus uniqueness rather than encoding long identifiers in the child name. A58-character prefix rendered the same data URL with Chrome exit0;21 focused checks passed. Earlier full local/app results remain scoped prior evidence; a fresh entire owning PR run is still required.
