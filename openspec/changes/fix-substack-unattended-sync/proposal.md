## Problem

The installed native Substack scheduler cannot complete article discovery reliably, and anonymous verification rejects valid React-rendered dateTime attributes. Chrome rebinding alone did not restore unattended operation on 2026-10-15. The approved article was recovered on remote ID 220473117 without email or App delivery.

## Root Cause

The public HTML parser preserves attribute spelling while the reader assumes lowercase datetime. Native navigation and locator readiness need action-level reproduction against the current UI; longer timeouts did not resolve the failure. Node connection-family selection also caused independently observed source-verification timeouts.

## Proposed Solution

Preserve existing Pages-first, same-ID, fail-closed policies. Add observable acceptance coverage before repairing native discovery/readiness, case-insensitive HTML date extraction, source network reliability, and the observed website-only confirmation. Qualify a newly pinned runtime with real native read-only discovery, original-ID public verification and a genuine scheduled round.

## Success Criteria

Both eligible public articles verify on their existing IDs; a complete native scan covers published, draft and scheduled lists without article mutation; valid dateTime and datetime HTML evidence agree at approved minute precision; incomplete scans, identity conflicts and unknown writes block creation or replay; no email or App delivery is enabled. Required local tests, checks, all builds and release rehearsal pass before installation. A later launchd occurrence completes without manual kickstart.

## Capabilities

### New Capabilities

- substack-unattended-reliability: Recovery of native discovery and anonymous public verification under the existing publication authority.

### Modified Capabilities

None. Existing delivery and identity constraints remain in force.

## Impact

- Modified: scripts/publishing/substack-browser.ts, scripts/publishing/substack-attended.ts, scripts/publishing/distribution-launchd.ts, scripts/publishing/distribution-launchd.test.ts and docs/distribution-general-config.example.json.
- New: scripts/publishing/distribution-native-reliability.test.ts.
- Documentation: docs/distribution-launchd-runbook.md and this change's acceptance evidence.
