## Why

The 15-minute Substack job repeatedly retries manual-required articles and navigates the user's ordinary Chrome tab. The user requires scheduled work to leave Chrome and foreground focus untouched.

## What Changes

- Persist manual-required disposition across scheduled rounds, including source changes and existing checkpoints, until an explicit attended action resolves it.
- Restrict scheduled execution to anonymous public verification of an unchanged known public article. Defer preparation, publication and metadata recovery to attended execution without starting or controlling any browser.
- Retain same-ID verification, source integrity, unsettled-intent checks, quiet repeat notifications and precise owned cleanup.

## Capabilities

### New Capabilities

- `quiet-background-distribution`: Persistent human-action holds and browser-free scheduled verification.

### Modified Capabilities

None. This supersedes background UI permissions in the historical active controlled-distribution and substack-unattended-reliability changes, per the user's 2026-10-17 instruction.

## Impact

- Modified: scripts/publishing/distribution-inventory.ts, scripts/publishing/plan-all-distribution.ts, scripts/publishing/sync-distribution.ts, scripts/publishing/run-distribution.ts, scripts/publishing/substack-profile.ts, scripts/publishing/distribution-launchd.ts, docs/distribution-launchd-runbook.md.
- Tests: scripts/publishing/distribution-inventory.test.ts, scripts/publishing/distribution-sync.test.ts, scripts/publishing/distribution-profile.test.ts, scripts/publishing/distribution-scheduled.test.ts, scripts/publishing/distribution-launchd.test.ts.
- Private installation: new frozen runtime and pin; preserve original credentials, original article IDs, D1 history and prior installation.

## Follow-up: Hermes attention delivery

The user explicitly requires human-action items to notify their existing Hermes Telegram home channel. Add a bounded status-file producer and an event-driven Hermes-owned sender, with persistent deduplication and no automatic resend of uncertain delivery. Preserve the completed browser-free repair and current scheduler until owner activation is available. New code: scripts/publishing/distribution-attention.ts, scripts/publishing/distribution-attention.test.ts, scripts/hermes/substack_attention.py, scripts/hermes/test_substack_attention.py, scripts/hermes/install_substack_attention.py.

## Follow-up: Public identity format repair

The user authorizes diagnosis and repair of the two held articles while preserving original IDs, zero Email/App delivery and no Chrome interference. Live anonymous HTML shows a single script#preloads-json of application/json type replacing the legacy inline JSON.parse string. Both public pages and archive identify the original IDs 220011124 and 220473117 under publication 11352259. Extend inert parsing without weakening identity or full-content checks, then explicitly verify only those two current source revisions and let the existing coordinator settle their D1 dispositions. Modify scripts/publishing/substack-public-identity.ts and scripts/publishing/distribution-public-identity.test.ts; preserve existing background holds and notification semantics.

## PR33 review corrections

Require anonymous-only acceptance at scheduler install and execution, preserve durable manual holds omitted from source inventory in Hermes attention, and recheck background eligibility under the per-target writer lock. These close three review findings without changing the running private installation, Chrome, article state or delivery.
