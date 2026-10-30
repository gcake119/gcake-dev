## Problem
Explicitly approved immediate Substack publication 221099415 was fully verified, but no success notification became eligible for the existing Hermes flow.
## Root Cause
The authenticated publication summary requires a saved Substack schedule for every candidate. Immediate publication legitimately has no armed revision or confirmed slot.
## Proposed Solution
Record the explicit immediate-publication authorization separately from schedule evidence. Admit fresh complete same-ID public verification through the existing summary and unchanged seven-field Hermes contract, using the real authorization instant as confirmedAt and the immutable authorized source revision for deduplication. Preserve the existing scheduled branch and all sent/intent/unknown suppression.
## Success Criteria
Approved immediate publications are notified once through the existing private-message flow without inventing a schedule. Missing, mixed, stale or malformed authority cannot notify. Existing scheduled identities and keys remain unchanged.
## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `substack-publication-notifications`: Explicit immediate-publication authority alongside scheduled publication authority.
## Impact
- Modified: `apps/admin-worker/src/publication-monitor-summary.ts`, `apps/admin-worker/src/publication-monitor-summary.test.ts`, `apps/admin-worker/src/substack-schedules.ts`, `scripts/hermes/test_shared_publication_monitor.py`, `docs/distribution-scripted-runbook.md`.
- Existing Hermes consumer, private ledger, timer and runtime remain compatible. No new dependencies or migrations.
