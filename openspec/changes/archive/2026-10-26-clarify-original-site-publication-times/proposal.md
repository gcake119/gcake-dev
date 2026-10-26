## Problem
A delayed original-site publication was notified at 09:25 with "Taipei publication time 07:00". That value came from RSS metadata and represented the article's scheduled timestamp, not when the site became publicly visible.
## Root Cause
The original-site monitor labels RSS publishedAt as an actual publication time. It does not capture the instant when each canonical page is successfully read and verified.
## Proposed Solution
The owner selected scheduled time plus public-confirmation time. Capture a local completion timestamp after each canonical-page verification and display it as public confirmation, separately from the formally confirmed editorial schedule. Unknown schedule or missing/invalid observation timing stays explicitly unknown. Preserve identity verification, hourly scheduling, deduplication and existing sent/unknown history.
## Success Criteria
Delayed publications display their confirmed schedule and actual successful page-observation instant using distinct Taipei labels. Notification dispatch time, round start, RSS metadata and build completion are not substituted for public confirmation. Content updates and formatting deployment cannot resend an existing event.
## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `hermes-publication-monitoring`: Distinguish scheduled time from public-confirmation observation time in article notifications.
## Impact
- Modified: `scripts/hermes/publication_monitor.py`, `scripts/hermes/test_publication_monitor_acceptance.py`, `scripts/hermes/test_publication_monitor_integration.py`, `docs/decisions/index.md`.
- The original-site Python monitor library requires an approved managed successor for production adoption. Existing Substack notification code, Worker, provider content, credentials, job and ledger remain outside this change.
