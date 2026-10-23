# Hermes native ACL review — 2026-10-23

This local review covers only the pending ACL eligibility repair and the existing Authority and runner permission separation contract. It does not install the candidate or qualify the legacy production feed PermissionError. The original dirty checkout, old failure evidence, recovery refs, timer, gateway and notification state are retained.

## Review findings and decisions

1. Old `/bin/ls -leR` inventory misses writable ACLs under hidden directories. The old-source acceptance run also refused a legitimate root-user grant; text account formatting is not a stable root identity contract. Native metadata inventory accepts only exact root-user UUIDs, preserves all existing mutation denials, checks every entry and includes hidden children without following external symlink targets.
2. The pending native implementation's 30-second progress checks cannot interrupt a blocked native call. The fixed local Python worker retains the existing subprocess deadline; `-I -B` excludes caller Python configuration and bytecode writes, the target is an argv value, and no shell, service or transport is invoked. All inspected-path metadata stays inside the bounded child. Unexpected helper status/output refuses eligibility.
3. Keeping the old display command with listing flags does not establish native identity or remove name-format dependence. In-process signal alarms would alter shared process signal behavior and fail for threaded callers. A fixed short-lived worker is the smallest reliable way to retain the existing hard timeout; it adds interpreter startup per existing eligibility check, no dependency, timer, CI job, or production activation.

## Acceptance evidence

- 13 pending tests against the old main implementation: 4 failures and 2 errors. Hidden descendant and root identity cases are real filesystem contract differences; synthetic missing/error/deadline cases are distinguished from production incident evidence.
- Pending native code before timeout repair: 13 tests passed on Darwin.
- Added blocked-worker/unexpected-result coverage: observed 5 failing assertions/subcases before the parent bound; the final blocked-worker test uses a scaled 0.5-second deadline and confirms its owned child PID has exited and been reaped.
- A target-metadata fault in the parent reproduced one failing boundary test before moving all inspected-path reads under the child deadline.
- Removing the native root-lookup error check made the corresponding characterization test fail; the original check was restored before the complete gate.
- Final focused Darwin acceptance: 18 tests passed. Mapping: safe/no display and readonly/deny; seven file mutation rights plus directory aliases; root user UUID/root group/later unsafe entry; hidden nested child; external symlink; missing/unreadable/changed node; progress budget; hard child timeout; unexpected result; failed root resolution; parent metadata boundary.

## Verification scope and limits

Apple local Xcode SDK `sys/acl.h` confirms the mutation mask, allow/deny tags, extended ACL type and Darwin entry selectors. Apple reference: https://github.com/apple-oss-distributions/copyfile/blob/main/copyfile.c . Real synthetic ACLs qualify Darwin behavior; Linux CI skips Darwin-only acceptance and supplies general regression evidence.

An initial complete Hermes run inside the restricted tool sandbox failed because local HTTP and Unix sockets were denied (`Operation not permitted`). This is preserved as an environment failure, not suppressed or fixed by changing assertions. Complete gates use the existing disposable test roots and local test sockets with notifications/publication disabled. They do not use formal services. Existing unrelated SQLite/socket ResourceWarnings remain outside this repair.

Exact final gate status, source hashes and preservation checks are in `native-acl-results-20261023.json`. The raw logs stay in the private local delivery directory rather than importing runtime bundles or private data. Historical native ACL root diagnosis is not asserted; no root/hermes production drill, install, live provider operation, publication or resend belongs to this PR.

## Final local gate

All five existing gates passed on the reviewed source: `pnpm test` (286 Hermes tests, including 18 native ACL cases, plus all other repository test groups), `pnpm check`, `pnpm build:all`, `pnpm release:dry-run` and `pnpm editorial:rehearse`. The two simulations report `productionWrites=false` and `telegramNetworkCalls=0`. Native-source hashes and the 18-case acceptance map are retained in the machine summary. The restricted-run failures are not counted as a pass.
