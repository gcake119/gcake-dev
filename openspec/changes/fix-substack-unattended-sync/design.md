## Context

Primary checkout contains unrelated dirty work. Repair code is isolated at origin/main 7e0fd14. The old installed PR27 runtime and pin remain rollback evidence. Live article identities are 220011124 and 220473117; today's source revision is bcec0ee0c31ce84ec835517d77772d54a470f2f6fb0f39937fb86c55888d7871. Decision ledger is absent; current Substack-only operations documents and completed controlled-distribution contracts govern this repair.

The implementation worktree is /Users/caiyijun/.codex/worktrees/fix-substack-native-sync/gcake-dev on codex/fix-substack-unattended-sync. Spectra CLI resolves this repository's primary checkout for its change artifacts; the primary checkout contains only this new change's documentation, while runtime edits and tests live in the isolated worktree. The installed-repair-20261015-crv89jlt installation uses a separate frozen runtime copy, so later review edits cannot silently alter scheduled execution. Preserve these boundaries when resuming or preparing a commit.

## Goals / Non-Goals

In scope: native scan readiness and observable control semantics, anonymous HTML date parsing, bounded source network reliability, website-only confirmation and same-ID date finalization; tests, new private installation and unattended same-ID verification.

Out of scope: changing author content, newsletter policy, credentials, private Substack endpoints, cookie/CDP reuse, broad write activation, Git commit/push/merge or Cloudflare deployment.

## Decisions

### Preserve durable identity and zero delivery

Reuse the coordinator, exact source receipts, approval digests, D1 locks/checkpoints/attempts and complete anonymous verifier. Do not patch provider state to claim success, extend authority, steal timed locks or replay unknown writes.

### Repair observed native and HTML contracts

Reproduce the native failing action with read-only diagnostics before choosing a correction. Keep scan totals and all three scopes mandatory. Parse publication instants according to case-insensitive HTML semantics with strict uniqueness and source-minute checks. Fix contract semantics instead of using unbounded waits or accepting incomplete evidence.

### Qualify a fresh pinned installation

Use a new private installation and file manifest; never rewrite the old pin to bypass mismatches. Reconcile D1 and stop the prior writer before installation. The new runtime must pass complete local gates and real native read-only discovery plus anonymous verification before switch. Observe an actual 900-second scheduled occurrence without kickstart. Preserve the old installation and exact rollback commands.

## Implementation Contract

The existing sync-distribution CLI and JSON result shapes remain compatible. Native list scanning returns the existing matches only after every scope is complete; identity/permission/control failures remain bounded and stop writes. The anonymous reader accepts valid case variants of the date attribute but rejects duplicates or invalid timestamps and still checks full body, title, canonical, links, images and original IDs. Website-only confirmation is bound to the active post-publication dialog and never enables delivery. Native date changes must be persisted and anonymously verified on the original ID before settling metadata intent. Runtime-specific connection handling must preserve TLS, credentials and no-retry semantics for provider mutations.

Verification: first obtain product RED tests through the existing adapters and anonymous-reader seams, then GREEN; run pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run. Live read-only discovery and exact-ID evidence remain distinct from local fixture evidence. Installed acceptance requires clean in-flight D1 state, a matching fresh pin, two existing public IDs, zero mutations/delivery in the repeated round and a new automatic run count/result.

## Risks / Trade-offs

UI text and React persistence can change; capture exact failing actions and reject missing controls. Native operations are slower than direct browser tests; use bounded readiness that proves current UI. HTML parser quirks must not hide multiple conflicting dates. No future new article is fabricated for acceptance: full local publication-flow regression plus real current native controls and actual verify-only scheduling provide separate evidence layers.
