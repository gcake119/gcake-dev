## Context

The owner explicitly approved planning a switch from Pages-first website-only mirroring to finalized drafts scheduled on Substack with first email and App inbox delivery. Pages failure is accepted and must remain independently visible. This supersedes the old delivery exclusion only for the new policy; existing published articles, ordinary updates, retries and cancellation do not gain resend authority. Planning is not activation.

Current discovery and prepareScheduledDistribution require published sources and anonymous Pages evidence; DistributionCoordinator rejects future publication dates. DistributionApproval and the UI adapters require newsletter skip, delivery off and schedule off. D1PublicationRepository retains IDs, revisions and remote URLs; DistributionRuntime owns locks and uncertain intents. These contracts require deliberate versioning rather than bypass flags.

Decision context:
- gate_level: 2; products: Git editorial queue, Substack distribution; risk_tags: cross-provider scheduling, irreversible delivery, durable identity, browser ownership.
- decision_refs: publishing-operations, quiet-background-distribution, series-scheduling; prior fix-substack-unattended-sync / Preserve durable identity and zero delivery.
- source_files: AGENTS.md; docs/distribution-scripted-runbook.md; those current specs; existing coordinator, inventory, scheduled-plan and transport contracts.
- missing_sources: docs/decisions index and ADR registry are absent; use the above sources and this explicit user decision. No bootstrap tooling or graph mutation is introduced.
- constraints: Git owns content; D1 owns operational state; source slug and original remote ID remain authoritative; background never accesses Chrome; unknown writes never replay.
- action: prepare a new isolated policy and additive operational migration; preserve the three existing dirty policy files and all installed runtime files during this proposal.
- needs_ledger_update: policy summary at implementation documentation stage; needs_adr_update: capture this cross-provider authority decision in the existing decision context if a registry is established by then; needs_archive_backfill: merge these delta specs only after implementation evidence.

Official capabilities checked 2026-10-19:
- https://support.substack.com/hc/en-us/articles/360037870412-How-do-I-schedule-an-article-to-publish-for-a-future-date-on-Substack : web scheduling, device timezone, maximum three calendar months.
- https://support.substack.com/hc/en-us/articles/15853567274772-Guide-to-your-Substack-Posts-page : Scheduled holds unpublished posts; existing UI supports editing/removing their scheduled time and reporting recipients.
- https://support.substack.com/hc/en-us/articles/360037831771-How-do-I-publish-a-new-post-on-Substack : combined email/App inbox control; published edits change website/App content and are not another email.
These are capability evidence, not a verified live selector contract or proof of individual delivery.

## Goals / Non-Goals

In scope: advance preparation of finalized portable source, confirmed-time arming, source-slug enforcement, actual content comparison and same-ID editing of unscheduled drafts, armed drafts and public articles, same-ID revise/postpone/cancel, separate delivery/public evidence, browser-free monitoring, additive migration, documented activation and rollback.

Out of scope: implementation in this planning turn; actual provider writes or sends; retrospective delivery for existing articles; redesigning queue priority, series order, original-site visibility or deployment; broad CMS/calendar UI; new timers/services/dependencies; private provider APIs, CDP, cookies or credential export; automatic browser control from background jobs; guaranteed recall of sent messages or suppression of a provider schedule while offline.

## Decisions

### Versioned source and delivery policy

**Supersedes**: fix-substack-unattended-sync / Preserve durable identity and zero delivery

Introduce policy scheduled-source-first-delivery-v1 alongside legacy pages-first-no-newsletter. The source adapter reads finalized main Markdown without invoking the published-only buildDistributionBundle path; keep legacy callers unchanged. Record sourceCommit, contentRevision, sourceSlug, canonicalUrl and media evidence. Do not backfill Git publishedAt merely to satisfy the old coordinator. Before Pages publication, expected Substack minute comes from the confirmed schedule, not a fabricated source publication timestamp.

Scheduled approval digests bind policyVersion, operation, stable scheduleId, remoteId if known, sourceCommit/contentRevision, sourceSlug, scheduledAt UTC, timeZone Asia/Taipei, audience everyone and delivery {email:true,appInbox:true}. Select the existing publication subscriber audience; no paid-tier or recipient expansion. UI evidence must confirm both channels through the provider's combined control; device push receipt depends on subscriber/provider settings and is never guaranteed. Historical skip approvals fail before D1/browser writes on the new path. Ordinary source saves only expose drift. Foreground controller authorization can generate exact reviewed scopes under this policy without inventing a new per-edit approval ceremony.

Alternative rejected: weaken the old published-date, Pages or newsletter checks globally; that would authorize legacy writes using stale receipts.

### Confirmed editorial slots and independent provider execution

Reuse the existing queue's explicit fixed-slot preview/confirmation and stable reservation identity. Drafts can be prepared from eligible sources with estimated dates, but estimates never arm Substack. Foreground planning promotes an owner-confirmed future slot using that existing source-queue operation, then binds its reservation/version to Substack. An absent, expired, changed or merely estimated slot blocks arm. Do not reserve all estimates or change editorial priority silently. A provider-arm failure does not erase the original-site reservation. Subsequent original-slot changes invalidate the desired Substack commitment and require foreground reconciliation.

Require scheduledAt > now; calculate the three-calendar-month bound in the observed device timezone and reject ambiguity/normalization instead of rounding into another day. Confirm device timezone Asia/Taipei, visible local time, exact UTC equivalent and the stored Scheduled-list time after reload. Past or unsupported times never fall back to publish now. Pages remains independent; a due-time deploy failure neither cancels Substack nor initiates a retry/send. A later Pages date mismatch is reported and never silently backdated on an emailed article.

Alternative rejected: schedule against a queue estimate or use a fixed delay after 07:00; neither proves original-site availability or preserves a confirmed calendar.

### Additive schedule state and serialized uncertain intents

Add operational records through apps/admin-worker/migrations/0007_substack_schedules.sql. scheduleId is stable independently of mutable sourceSlug; retain source-path/rename mapping and remoteId, never title-only identity. Store desired version/slot versus observed saved draft and confirmed provider commitment separately. Keep legacy publication_target_states readable; private scheduled records must not masquerade as public verified states.

Schedule record shape: policyVersion, scheduleId, sourceSlug/path, sourceCommit/contentRevision, queue reservation/version, remoteId/editUrl/expectedPublicUrl, desiredState, desiredTime, observedState, observedRevision/time, timezone, audience, email/App settings, mutationVersion, unresolvedAttempt and timestamps. Observed states: draft_prepared, scheduled, cancelled_draft, published_unverified, verified, reconciliation_required. Desired-versus-observed differences expose pending edits/delays/cancellation without inventing confirmed state. Delivery evidence is separate: not_armed, armed, unknown, provider_reported; keep email and App observations distinct where provider data permits. No bodies or subscriber lists are stored in operational records.

Extend existing lock/checkpoint semantics with explicit schedule-arm, schedule-remove and same-ID draft-update intents. Existing schemas/readers must reject unsupported policy/operation versions instead of treating them as prepare/publish. Persist intent before UI mutation. Record expected state generation and check it under the target lock before dispatch/save. Reuse global round lock for shared runtime cutover only; per-article locks serialize actual provider changes. No age-based stealing. Resume first reads the same ID and all relevant lists; uncertain create without an ID requires complete discovery. An unresolved intent remains after failure; a local lock is released only by its owning completed process. No automatic mutation retry.

Alternative rejected: one scheduled boolean in the old state; it cannot distinguish desired cancellation from a still-armed provider or preserve separate versions and delivery authority.

### Foreground schedule mutation and browser-free observation

Extend the existing distribution:run controlled operations with prepare-draft, arm-schedule, revise-schedule, postpone-schedule, cancel-schedule, reconcile-schedule and sync-content. Outputs include policyVersion, scheduleId, original remoteId, desired/observed revisions and UTC/Taipei times, pendingAction, bounded errorCode and independent publication/delivery evidence. reconcile-schedule is authenticated read-only foreground discovery when needed; ordinary background cannot use it as an escape hatch. sync-content compares actual saved content and dispatches the same-ID draft, armed-draft or public correction flow under existing foreground synchronization authority. Existing operation names retain legacy semantics.

Use the existing attended Computer Use handoff first for new controls. Capture and qualify the current web selectors/evidence before extending native transport to these actions; no unverified fallback from attended to native. Native support can remain explicitly unsupported for this policy until it passes the same contract; its existing legacy verification remains functional. The existing background sync/LaunchAgent remains a reader: include schedule records even when the source is deleted, compare desired/armed versions/slot, and reuse Hermes attention deduplication. At due time read the expected public URL anonymously using the confirmed source evidence; before due, 404 is expected. A post-due missing public page is awaiting-publication/attention, never permission to publish again. Read failure preserves prior state. Do not perform authenticated delivery-metric inspection in background; foreground readback can add provider delivery evidence.

Alternative rejected: let the LaunchAgent manipulate the user's Chrome to keep drafts current. The owner has not revoked the no-background-browser boundary.

### Disarm before revision postponement or cancellation

Every operation starts with current source/slot/disposition checks and provider observation. If publication/sending has already started, reconcile the original article and report too late; updates can change public website/App content without another first-delivery intent.

For a still-unpublished schedule: persist remove intent, unschedule once, reload and verify the same ID is in Drafts and not Scheduled before touching content or a replacement time. Revise then writes complete current content and saved slug, reloads/verifies full draft/media, and arms against the current confirmed slot. Postpone leaves content intact and arms the new confirmed future slot only after old-time removal; carry forward the one first-delivery commitment rather than allocating another. Cancel ends in cancelled_draft and retains content/ID; no deletion, unpublish or email recall. Confirmed cancellation does not automatically rearm; a later explicit arm needs a new reviewed scope on the same ID. Unknown remove/arm does not progress to the next mutation.

Return-to-draft, deletion or loss of series eligibility requests cancellation. A source-slug rename blocks automatic new creation; foreground reconciliation maps the same scheduleId/remoteId, checks new-slug conflicts and uses the same disarm/update flow. A vanished/changed source is not a successful cancellation. Local pause/rollout rollback does not disarm Substack; expose stillArmedUntilConfirmed=true until provider readback proves removal. Races are resolved from observed provider state, not an arbitrary local timeout or a guarantee that a user request beat the due instant.

### Compare edit and verify source-owned content

The owner's subsequent clarification requires actual editing after comparison, including articles that are already public. Git remains the only content authority. Uncommitted Editor text is not a source revision; a source returned to draft or removed is handled by the existing cancellation rules rather than replacing an armed article with unfinished content. Platform-only edits are observed divergence, never a reverse write into Git. Foreground synchronization presents the source/remote differences and applies the source-authoritative result within its already authorized scope; it does not create another confirmation ceremony for ordinary updates.

sync-content reads one saved eligible main snapshot, the tracked original remote identity and the actual persisted provider content. Compare semantic title/body structure, headings, paragraphs, lists, quotes and code, links, images/alt text and explicitly supported source-owned metadata. Expected rendering normalization is limited to the existing approved transform; it cannot erase missing paragraphs, structural changes or changed URLs. Keep publication time, subscriber audience, channels and armed slot out of the content patch. Return differences, sourceRevision, observedContentDigest, remoteId, operationMode and contentVerification; a checksum match from a prior run is not proof of current provider equality.

If content is equal, return verified-no-change with zero provider mutations, including no unschedule/rearm. If an unscheduled draft differs, persist an update intent, edit the same draft and reload to verify the complete result. If an armed draft differs, use the existing confirmed unschedule/update/readback/rearm sequence. If a public article differs, use an explicit update-existing-content flow with email/App resend off, no new schedule, no unpublish and no date repair; reload the editor and anonymously verify the same public canonical/ID, full content, links and media. A matching Pages page can independently verify the original-site outcome; updating the provider must not claim the Git-to-Pages deployment succeeded.

Recheck both the current source and observed provider content before an edit; if either changed, invalidate the patch and expose pending reconciliation instead of overwriting against stale evidence. Before successful completion or rearming, recheck the source again. Source B saved while C becomes current stays pending-C, even if B was saved remotely; no current-synchronized claim for B. Save failure, partial readback, changed identity or unknown update retain their intent without automatic repeated edits. This adds same-ID public-update intent to the existing runtime protocol, not another scheduler or content store.

Retain immutable first-publication/armed and delivery-version evidence separately from latest desiredContentRevision, observedContentDigest and contentVerifiedRevision/time. Initial public verification checks the armed snapshot; after an authorized public correction it checks the new verified correction version at the original publication minute. Later background rounds must not compare a corrected B page to the original emailed A snapshot and falsely fail it. Already delivered email remains A and is reported as such; correcting the website/App content never implies that past email was corrected or resent. No article-body copy is introduced into D1.

Acceptance covers an unscheduled draft edit, armed edit, published edit, equal-content no-op, provider-only divergence despite unchanged Git revision, source B-to-C race, remote-edit race and failed/partial save. Extend existing coordinator, attended/profile-update and public-evidence suites; use deterministic comparison cases and the existing integration seam, with no new test layer or mandatory CI job. The extra cost is foreground read/compare/reload and existing public verification after actual changes; unchanged matching content avoids writes.

### Reuse verification layers and qualify activation separately

Concrete new risks: stale content sent irreversibly; duplicate publication after lost acknowledgements; falsely cancelled provider schedules; mismatched slug/time/delivery settings. Existing tests cover immediate website-only publication, not scheduled mutation races. Extend existing scheduled/attended/native/runtime/review/sync suites rather than add a new testing layer or CI job.

Use table-driven acceptance tests through the coordinator/transport seams for the agreed Gherkin cases, then existing SQLite/D1 integration for uniqueness, version conflicts and intent restart. Use current browser fixtures for saved settings and explicit full-list discovery. Local development runs only affected suites; pre-submission reuses the required project aggregate gates once. No Docker environment is needed for the existing SQLite seam. Maintenance cost is the additive state migration plus provider controls and fixtures; runtime cost is the existing background Git/D1 scan and at most a due public read per eligible article, with no extra polling timer. Verify benefit by observing duplicate-dispatch count zero in fault/race fixtures and same-ID provider readback in acceptance; make no CI savings or delivery-success claims from latency.

## Implementation Contract

The observable result of prepare-draft is an unpublished, reloaded matching draft with source slug and ID. arm-schedule requires that evidence plus a still-confirmed future queue commitment and returns scheduled only after provider time/audience/email/App settings match. A missing control, timezone conflict, slug collision, stale revision, unsupported source, unknown write or race returns a bounded blocker with original ID and unresolved intent preserved. Proposed codes: SUBSTACK_SOURCE_NOT_FINALIZED, SUBSTACK_SCHEDULE_SLOT_UNCONFIRMED, SUBSTACK_SCHEDULE_TIME_INVALID, SUBSTACK_SCHEDULE_TIMEZONE_MISMATCH, SUBSTACK_SLUG_CONFLICT, SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED, SUBSTACK_SCHEDULE_TOO_LATE. Code names are diagnostic interfaces; acceptance asserts observable outcomes.

Initial source-version and public-date checks use the armed commitment. The anonymous verifier must validate exact same-ID, publication identity, source slug/canonical, complete normalized content, images, original-site link and scheduled minute without a Pages HTTP prerequisite. After an authorized public content correction, use its current contentVerifiedRevision while retaining the original armed/delivered version and publication minute. A read-only verification mismatch requests sync-content rather than editing, date repair or resending in the verifier. Provider availability and delivery evidence never promote original-site status. No individual email receipt or mobile push is inferred from public HTML.

Acceptance mapping: new capability source/time/identity requirements cover prepare/arm/duplicate cases; revision and postponement/cancellation requirements cover all foreground transitions and due-time races; source-authoritative content comparison and editing covers actual same-ID corrections and source/provider races; unknown-outcome requirement covers fault/restart/CAS; separate-evidence requirement covers Pages outage and delivery unknown. Publishing-operations delta covers legacy approval denial and no-backfill. Quiet-background delta covers no Chrome access, missing source, public-source drift and attention deduplication. Specs are complete before task creation; all implementation starts with a failing acceptance test.

## Risks / Trade-offs

- A scheduled provider operates while this computer sleeps or is offline → publication can occur, but unsynchronized edits/cancellation cannot be guaranteed; expose last confirmed time and pending action, never report stopped on local pause alone.
- Disarm fails near publication → preserve uncertainty and inspect original ID; no replacement or resend.
- Finalized draft and public page could have different later source versions → keep intended/armed/current versions separate and report drift.
- Provider UI and device timezone can change → qualify exact controls and reload readback; no private endpoints or selector guessing.
- Email and App inbox are coupled controls → record intended channels, use provider evidence where available and avoid promising device-level push or human receipt.
- Platform first delivery is irreversible → rollout uses one owner-selected future eligible article, never an old public article or a fake early publication.

## Migration Plan

1. Preserve current dirty policy changes and installed runtime/config/pin. Apply additive schema locally and verify old records/readers. Snapshot current IDs, unresolved intents and provider schedules before any activated migration.
2. Adopt IDs 220011124, 220473117 and 221069931 as already published with their verified source slugs; preserve unknown/absent delivery evidence, never create a first-delivery commitment for them.
3. Implement and run required local gates and existing PR CI without provider mutations. Update AGENTS/runbooks with precise legacy-versus-new policy scope; preserve historical evidence rather than rewrite it.
4. Separately authorize production migration/runtime installation and a specific future eligible pilot with first subscriber email/App delivery. This proposal supplies no such action-time activation evidence. Foreground qualify prepare/arm/unschedule/reload/rearm on that single ID before due; cancellation/race failure paths remain fixture-proven until real observations exist.
5. At due time let Substack publish without the controller, anonymously verify it in a subsequent ordinary background occurrence, and separately inspect available provider delivery evidence. Pages failure acceptance is fixture evidence unless naturally observed; do not break the original site to manufacture proof. Fixture, provider configuration, actual public article and delivery evidence are reported separately.
6. Rollback first blocks new arms, inventories every armed/unknown schedule, then uses foreground same-ID cancellation and readback where still possible. Old runtime/pin can be restored only after proving compatible state and reporting any already-public or still-armed commitments. Disabling the local process or gate alone is never a successful provider rollback. Retain all IDs, attempts and delivery evidence.

## Open Questions

No unresolved product decision blocks the plan. Live selector labels, scheduling readback details and provider delivery metrics remain explicit implementation qualification items, not assumed capabilities. Before activation, the owner selects the real pilot article/time; unverified channel evidence remains unknown rather than weakening acceptance.
