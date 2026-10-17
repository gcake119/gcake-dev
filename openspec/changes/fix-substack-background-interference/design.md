## Context

Baseline main b5f8d7c, isolated code worktree /private/tmp/gcake-substack-background-20261017. Spectra resolves artifacts into the primary checkout. The installed 2026-10-15 runtime retries manual_required states through prepare, calling native Chrome navigation before discovery fails. No decision ledger exists; the runbook and prior changes are decision sources.

## Goals / Non-Goals

In scope: durable human-action holds, anonymous-only scheduled verification, dispatch/transport enforcement, tests and fresh private runtime cutover.
Out of scope: resolving the existing public-identity ambiguity, creating a dedicated browser, changing login, writing Substack articles, modifying D1 dispositions to claim resolution, Git commit/push/merge or Worker deployment.

## Decisions

### Hold manual-required targets until attended resolution

The persisted manual_required state blocks planner operations regardless of revision or checkpoint. Preserve the original error, remote identity and unsettled intent. An explicit foreground operation remains the resolution path; do not add automatic expiry or infer release from source changes.

### Enforce anonymous-only scheduled execution

**Supersedes**: fix-substack-unattended-sync / Repair observed native and HTML contracts

Scheduled planning permits only verify for unchanged verified or published targets with a known public identity and no checkpoint. Other work is reported as SUBSTACK_BACKGROUND_ATTENDED_REQUIRED, retaining source/target provenance. All production sync dispatches explicitly pass --background. That execution mode rejects browser-writing operations before source/provider work and requires controlled-trial transport. The transport rechecks current persisted disposition, revision and checkpoint before returning the existing anonymous verifier; it never opens, navigates or executes JavaScript in any Chrome window. Explicit foreground commands preserve reviewed native behavior.

### Preserve installation evidence

Use a new immutable private runtime and pin. Retain original credentials and prior install. Real acceptance for this change is a browser-free production round that observes both existing manual holds, D1 unchanged, zero UI calls and zero article writes; do not clear holds to force a green public verification. Report held items as attention. Observe an automatic occurrence separately from an invoked round.

## Implementation Contract

planTarget keeps its existing four arguments and accepts an optional fifth background boolean; manual_required always yields no operations and DISTRIBUTION_MANUAL_REQUIRED. Background planning permits only same-revision public verification without checkpoints, else returns an attended-required blocker. prepareAllDistribution opts into background planning. run-distribution accepts a unique --background flag, requires controlled-trial verify and uses createProfileTransport with background=true. createProfileTransport uses current durable state and the same planner policy before choosing the existing anonymous reader. Unsupported or missing transport stops; there is no attended exchange or regular profile fallback in background mode. The sync production dispatcher always supplies the flag. Browser-free installation receipts explicitly identify anonymous-only execution, zero browser access, zero article writes, completed read-only round and zero in-flight state; held targets are recorded as held rather than verified. Existing JSON round result and ownership cleanup remain compatible. Repeated identical blockers stay quiet.

Verification: regression tests through planTarget, the CLI main and createProfileTransport; a two-round held-target sync test; full pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run. Read actual installed configuration/pin and real round results without touching Chrome or replaying provider intents.

## Risks / Trade-offs

New or changed articles stop for attended work instead of automatically opening Chrome. This is the explicit user-requested behavior change. Old runtime rollback restores intrusive behavior, so preserve it as evidence but do not automatically reactivate it. Unresolved manual-required articles remain unresolved and are not counted as synchronized.

## Follow-up: Hermes attention delivery

In scope: write a minimal snapshot of manual/attended-required Substack items after each executed round; an event-driven LaunchDaemon under the existing hermes account consumes the status file and invokes the official Hermes send tool targeting its configured Telegram home. No new timed poller, gateway restart, bot or credential copy. Root-owned installed code receives only validated public slug/reason data. Shared input grants only hermes read access; receipt output grants only the primary user read access.

The sender persists intent in a private SQLite ledger before one network attempt. Identical normalized issue sets remain quiet even after restart; a successful clear snapshot resets the active issue set without sending, so later recurrence generates a new event. Unknown/rejected delivery is preserved, surfaced as requiring operator action and never retried automatically. A skipped or malformed Hermes acknowledgement is not sent, and transport acceptance never means human receipt. A source/round failure cannot clear an existing issue set. Current held items are seeded once on activation even when the older round notification fingerprint says quiet.

The private installed Substack runtime remains immutable; prepare a new candidate and pin. Owner activation installs only the event bridge, file ACLs and candidate scheduler; it preserves gateway/runtime selection, jobs, credentials, history and the previous safe background installation. sudo requires a password in this session, so no production activation or real-send claim is permitted before that owner step succeeds. Verification covers producer delivery from actual runSyncRound, sender restart/deduplication, no automatic uncertain resend, malformed input and acknowledgement rejection, and installer fixture output/ownership.

## Follow-up: Inert JSON identity and explicit two-article recovery

Decision context remains Level 2: same-ID reconciliation, anonymous source evidence and internal D1 state. No decision ledger exists; current user boundaries override historical native-background permissions. In scope: support one designated application/json preloads script or one legacy inline JSON string, reject multiple competing records, retain exact publication/ID/canonical and full text/link/image/date verification, and explicitly reconcile only the two named held articles. Out of scope: Chrome/other browser automation, article create/update/publish/metadata operations, Email/App delivery, private Substack APIs, Hermes root/gateway changes, automatic release of all manual holds, commit/push/deploy.

Use the existing inert HTML parser to locate the unique designated data script; JSON.parse only its text. Legacy assignments are read only from executable script elements, without executing any source. A designated node with wrong type or invalid JSON fails; duplicate designated nodes, multiple legacy strings or simultaneous old/new data fail closed even if apparently identical. All existing identity checks remain unchanged.

After local RED/GREEN and required gates, prepare a fresh frozen runtime and pin, preserving the current Hermes-enabled installation and root-owned event sender. Reuse the acceptance of unchanged background/notification behavior with explicit source-hash evidence; parser correctness comes from live HTML fixtures and current anonymous full verification. Switch the user LaunchAgent only while idle and keep the shared round lock. Explicit controlled-trial verify bypasses automatic holds through its existing foreground operator seam, but its transport remains anonymous and browser-free. Take the shared lock and audit zero D1 intents/checkpoints/locks before the exact two verifies. Guard against any browser command or non-GET Substack request, retain raw verification evidence, and let coordinator.run verify write only internal verified state. Do not patch status directly or create replacement IDs. If any article fails its full checks, preserve its manual hold and original ID.
