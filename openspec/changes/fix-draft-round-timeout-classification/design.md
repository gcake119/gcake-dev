## Context
Required main run41016327285 failed only the existing media-round deadline acceptance. The same exact assertion failed locally on attempt13. The source uses separate round-owned timers and wall-clock comparisons; an abort can be observable while Date.now is one tick before the deadline.
## Goals / Non-Goals
In scope: preserve the existing budget verdict and prevent provider dispatch once the round-owned deadline fires. Out of scope: longer budgets, retries, changed provider behavior, permissions, live draft edits, installed runtime changes, new services and CI/test infrastructure.
## Decisions
### Share the existing round deadline signal
Create one native deadline signal for the existing round budget, propagate it through existing bounded fetches, and derive roundExpired from that signal or the original wall-clock deadline. Use it in existing guards and catches. Caller cancellation before that shared deadline stays distinct. This replaces per-fetch copies of the same deadline rather than adding another monitoring layer.
## Implementation Contract
runDraftSyncRound retains its existing signature and result shape. A fired round-owned timeout returns blocked/SUBSTACK_DRAFT_BUDGET_EXHAUSTED even with a one-tick-early wall clock. A caller-owned abort before the round deadline remains SUBSTACK_DRAFT_READ_INCONCLUSIVE. Both cases perform zero provider calls, preserve prior intent and do not report observed. Existing post-executor uncertainty protections, numeric budgets, locks and cleanup stay unchanged. Extend the current Node/SQLite acceptance seam with controlled signal ownership and clock ordering, then retain all existing deadline tests and full local gates.
## Risks / Trade-offs
Native timeout signals and wall-clock checks use different clocks. Treat the owned signal as affirmative expiry evidence without widening the original limit or reclassifying earlier caller aborts. Tests use controlled scheduling instead of lengthening sleep margins; the real original failure and bounded local reproduction remain preserved.
## Migration Plan
No schema or live runtime migration. Commit a separate scoped CI repair only after all five existing local gates pass under Node24; merge after required PR checks and verify exact main CI. The frozen Substack executor is not installed or activated by this work. Resume the already authorized Admin routing deployment only after a qualified main candidate exists.
