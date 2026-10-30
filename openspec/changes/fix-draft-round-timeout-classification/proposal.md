## Problem
Required main CI intermittently reports an inconclusive read instead of exhausted round budget when slow draft-source media reaches the round deadline. The failure is reproduced locally before any provider dispatch.
## Root Cause
Separate native timeout signals and wall-clock checks can disagree by one clock tick. An inner round-owned abort can reject before the outer timer or Date.now comparison reports expiry, losing the existing budget-exhausted classification.
## Proposed Solution
Use one round-owned deadline signal across bounded fetches and use its fired state together with the original wall-clock deadline for guards and error classification. Keep caller cancellation distinct, preserve all existing time limits and unknown-operation protections, and extend the existing acceptance test with a controlled one-tick race.
## Success Criteria
A fired round-owned deadline is always budget-exhausted before provider dispatch, even if the wall clock remains one tick early. Caller cancellation before the round deadline remains a read failure. No provider call, prior intent mutation or automatic retry occurs.
## Capabilities
### New Capabilities
- `draft-round-deadline-classification`: Preserve the existing round-deadline verdict across asynchronous abort races.
### Modified Capabilities
None.
## Impact
- Modified: `scripts/publishing/substack-draft-round.ts`, `scripts/publishing/distribution-draft-sync.test.ts`, `docs/decisions/index.md`.
- No installed runtime, provider, scheduler, credential, database schema, time limit, CI workflow or new dependency changes. This repairs the required gate blocking the authorized read-only monitoring deployment.
