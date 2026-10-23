# unattended-substack-drafts Specification

## Purpose

Synchronize complete finalized Git originals into persistent unpublished Substack drafts without an operator, only through a separately qualified owner-selected Computer Use integration and explicit activation. Preserve source ownership, original identity, foreground schedule authority and truthful recovery evidence.

## Requirements

### Requirement: Single existing draft natural qualification

An explicitly authorized one-use read-only qualification SHALL connect the real Computer Use executor within the existing scheduler occurrence before general write activation. The grant SHALL bind the original provider ID, exact slug, fixed source revision, runtime pin and expiry. It SHALL consume its attempt before dispatch, refuse other identities, source changes, scheduled/public/sending state and unresolved operations, and never create or mutate provider content. The executor SHALL use its own new scoped tab without operating existing user tabs, reload the original draft, collect complete saved content and list/slug evidence, then close only its own tab. The controller SHALL independently compare that evidence against Git and preserve unknown/failed attempts without replay or forged qualification receipts. Observer execution SHALL remain separate.

#### Scenario: Natural unchanged draft qualification
- **GIVEN** one read-only grant for an existing unscheduled draft whose complete content matches the fixed Git source
- **WHEN** the existing timer naturally starts the occurrence without operator assistance
- **THEN** the real executor reloads that same ID and exact slug, complete saved content verifies, no provider mutation or second timer occurs, and the attempt is recorded once

#### Scenario: Wrong scope or protected identity
- **GIVEN** the grant is expired, mismatched to runtime/source/identity, or the article is scheduled, public, held or has an unresolved operation
- **WHEN** the qualification occurrence evaluates the article
- **THEN** it dispatches no authenticated access for that invalid scope and preserves all existing commitments

#### Scenario: Executor failure or content mismatch
- **GIVEN** an attempt is consumed and the executor fails, times out, encounters a login challenge or returns incomplete or different content
- **WHEN** the controller evaluates the result or the next natural occurrence starts
- **THEN** it preserves failure evidence, performs no edit or replay, and does not claim qualification passed or block the anonymous observer

#### Scenario: Explicit Chrome scope survives executor browser inventories

- **GIVEN** the owner limits the unattended qualification to Chrome and different executor sessions assign different numeric browser identifiers
- **WHEN** the natural round creates its own tab
- **THEN** it selects Chrome by name, closes only its own tab after the read, and rejects qualification if actual execution evidence identifies any other browser


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Single existing draft actual write qualification

A separately authorized one-use write qualification SHALL use Chrome by name and validate actual Chrome evidence, target only the granted unscheduled never-published original ID and exact slug, and perform one logical complete same-content draft update followed by navigation away, reload and full saved-content verification. It SHALL bind the source revision, runtime pin, expected baseline digest, operation scope and expiry; persist a durable update intent before dispatch and recheck real before-content against that baseline before editing. This explicit qualification SHALL bypass the ordinary equal-content skip without modifying Git. It SHALL retain an unknown intent after dispatch failure or incomplete write/readback proof and never replay it. General writes, creation, slug changes, scheduling, publication and subscriber notifications SHALL remain disabled. The executor SHALL close only its own new Chrome tab. A bounded write qualification process SHALL have at most 600 seconds; the existing timer and shared locks SHALL remain in use.

#### Scenario: Natural same-content complete write and reload
- **GIVEN** a one-use actual-write grant for the original unscheduled draft and a complete saved baseline matching the fixed Git content
- **WHEN** the existing timer naturally starts the scoped occurrence
- **THEN** the autonomous Chrome executor replaces the complete content, observes saved status, leaves and reloads the same ID, verifies the full content and original slug, and preserves all schedule and delivery commitments

#### Scenario: Write qualification fails after dispatch
- **GIVEN** a consumed write grant and a persisted update intent
- **WHEN** execution fails, times out, lacks real paste/save/reload evidence, or the saved content differs
- **THEN** the result remains unqualified, the unresolved original update is retained for reconciliation, no repeat write or replacement article occurs, and the anonymous observer remains available

#### Scenario: Invalid write baseline or protected identity
- **GIVEN** an invalid baseline grant, a changed real before-content, or a scheduled or public identity
- **WHEN** the write qualification evaluates the identity or prepares to edit
- **THEN** it rejects the operation without overwriting that changed content or changing the protected provider state


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Qualified unattended draft integration

The worker SHALL remain disabled until an explicitly approved Computer Use handoff proves authenticated complete saved reads, draft creation when independently enabled, same-ID updates, exact-slug persistence, exhaustive discovery, media fidelity, create-result correlation and observed revision/disposition conflict protection. Qualification and activation SHALL be distinct from observer acceptance and SHALL bind publication, source scope, runtime/configuration, operation scope and expiry/revocation. The worker SHALL NOT use private undocumented endpoints, exported login state or authentication-challenge bypass. Computer Use SHALL operate only an owner-authorized controlled session; the anonymous observer SHALL retain no browser access. The owner-selected existing FileAttendedExchange transport SHALL permit local implementation without an official write API. Real executor/session and full saved-readback qualification SHALL remain required before activation. Existing-ID-only activation SHALL keep creation disabled and SHALL NOT claim live creation qualification. UI pre/post checks SHALL NOT be described as atomic provider-side protection.

#### Scenario: Observer evidence is insufficient

- **GIVEN** only anonymous observer acceptance and a draft request
- **WHEN** the worker evaluates its authority
- **THEN** it performs no authenticated access or write and reports capability qualification required

#### Scenario: Qualified scoped worker starts

- **GIVEN** the selected Computer Use integration has current qualification and separate draft-only activation
- **WHEN** a matching ordinary round starts
- **THEN** only the authorized publication and finalized source scope can be accessed for draft synchronization

#### Scenario: Authentication expires or a challenge appears

- **GIVEN** a previously activated worker loses valid authentication
- **WHEN** it attempts a saved-draft read
- **THEN** it reports owner action and incomplete verification without bypass, mutation or repeated login attempts

#### Scenario: No qualified executor or conclusive create recovery

- **GIVEN** no qualified Computer Use executor/session or conclusive create recovery is available
- **WHEN** the integration is reviewed
- **THEN** activation remains disabled and the missing capability is reported without substituting private endpoints or fabricating UI evidence

#### Scenario: Expired revoked or mismatched authority

- **GIVEN** the activation is expired, revoked or does not match runtime or source scope
- **WHEN** a round starts or reaches a mutation boundary
- **THEN** no new authenticated operation outside current authority is dispatched and existing provider commitments are preserved


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Complete finalized draft coverage

The worker SHALL enumerate all eligible finalized complete full Markdown originals from one clean immutable current main snapshot, including complete series and standalone originals. It SHALL preserve existing eligibility/media rules and source-owned title, description, complete body structure, meaningful code whitespace, images/alt, links and identical slug. Pages availability and confirmed scheduling time SHALL NOT be prerequisites for new-policy draft preparation. Unsupported or incomplete sources SHALL NOT be partially synchronized. Git SHALL remain the content owner and D1 SHALL store only identity, versions, operation metadata and evidence.

#### Scenario: New complete original before Pages

- **GIVEN** an eligible finalized original with ready media, no known mirror and no public Pages route or confirmed time
- **WHEN** an authorized qualified round completes creation and reload
- **THEN** one full source-matching draft exists with the exact slug and original-site link, remains unpublished and has no schedule or delivery

#### Scenario: Complete series and standalone inventory

- **GIVEN** several eligible full originals include a complete series and a standalone original
- **WHEN** bounded ordinary rounds continue through the inventory
- **THEN** each eligible identity is covered fairly without requiring an operator or skipping unchanged Git revisions

#### Scenario: Incomplete source unsupported content or media

- **GIVEN** a source is unfinished, its series incomplete, its content unsupported or any required image unavailable
- **WHEN** eligibility and full-content checks run
- **THEN** the affected identity is blocked before creation or replacement and its last saved draft remains preserved

#### Scenario: Missing code link or alt after save

- **GIVEN** an attempted save omits a code block, changes meaningful inner whitespace, breaks a link or loses image alt
- **WHEN** fresh saved readback is compared with the fixed source
- **THEN** the same ID remains unverified or uncertain without a replacement draft or a complete-sync claim


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Actual comparison and human conflict protection

Every eligible synchronization round SHALL read actual complete saved content and compare it strictly with the fixed Git original and last verified saved baseline. Source changes with an unchanged remote baseline SHALL update that same draft and reload. Equal content SHALL issue zero writes. Independent remote changes conflicting with both baseline and Git SHALL require foreground conflict resolution, not automatic overwrite or reverse synchronization. Notification-only normalizations SHALL NOT weaken saved-content acceptance.

#### Scenario: Git edits an existing draft

- **GIVEN** saved draft A still matches its verified baseline and finalized Git B changes title, description, body, code, media or links
- **WHEN** the authorized worker compares, edits and reloads
- **THEN** the same unscheduled ID contains fully verified B with exact slug and no scheduling or subscriber operation

#### Scenario: Actual content already matches

- **GIVEN** actual saved content including all source-owned fields matches current Git
- **WHEN** another eligible round reads it
- **THEN** it records verified-no-change and issues zero provider mutations

#### Scenario: Human editor changes the remote draft

- **GIVEN** the saved remote content differs from both last verified baseline A and authoritative Git B
- **WHEN** the worker compares the actual draft
- **THEN** it preserves the human edit, exposes a conflict for foreground resolution and does not write either provider content or Git

#### Scenario: Unbaselined draft is discovered

- **GIVEN** a possible existing draft has no confirmed synchronization baseline
- **WHEN** the worker finds it during discovery
- **THEN** it requires exact identity proof and foreground adoption before overwriting divergent content

#### Scenario: Only notification presentation differs

- **GIVEN** a public unchanged-source article has known presentation-only differences
- **WHEN** the anonymous observer evaluates attention
- **THEN** it stays quiet under the existing rule and does not qualify a private full-draft save


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Persistent identity and uncertain outcome recovery

The worker SHALL preserve one durable source identity and original provider ID through restarts, renames and retries. Before initial creation it SHALL exhaust Drafts, Scheduled and Published discovery with conclusive identity evidence and retain the exact source slug. It SHALL persist intent before mutation, serialize with foreground operations and use fresh observed revision/disposition checks before and after editing. Unknown create or update outcomes SHALL be reconciled read-only without mutation replay, replacement ID, slug suffix or age-based lock takeover. Incomplete or eventually consistent negative discovery SHALL NOT prove an unknown create failed.

#### Scenario: Restart after unknown create

- **GIVEN** a create attempt lost acknowledgement and its ID is unknown
- **WHEN** the process restarts and lists do not conclusively resolve that attempt
- **THEN** the original intent remains unresolved and no second draft is created

#### Scenario: Unknown create resolves to original identity

- **GIVEN** a retained create attempt is conclusively correlated to one saved matching draft
- **WHEN** read-only recovery verifies its identity and complete saved content
- **THEN** that original ID is retained without repeating creation

#### Scenario: Known ID disappears or discovery is partial

- **GIVEN** a known ID cannot be read or an initial list scan is incomplete
- **WHEN** a round evaluates creation
- **THEN** it holds the identity and performs no replacement create

#### Scenario: Slug occupied or rewritten

- **GIVEN** another ID owns the exact source slug or the platform changes it on save
- **WHEN** creation or saved-slug verification runs
- **THEN** it retains evidence and any created original ID, stops and never appends a suffix or recreates

#### Scenario: Unknown update after timeout

- **GIVEN** a same-ID update has an unknown outcome
- **WHEN** read-only recovery reads the saved article
- **THEN** only complete matching evidence resolves that attempt, while incomplete or conflicting evidence retains uncertainty without replay

#### Scenario: Concurrent foreground or worker

- **GIVEN** one writer owns the article or an unresolved mutation intent exists
- **WHEN** another writer attempts synchronization or the lock appears old
- **THEN** the competitor issues no mutation and does not steal ownership or erase the intent


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Freshness and source lifecycle boundaries

The worker SHALL recheck source and provider versions at dispatch and source freshness after saved readback, coalescing newer revisions without an unbounded retry loop. It SHALL retain saved-versus-desired versions separately. Deleted, renamed, withdrawn or newly ineligible sources SHALL preserve remote content and stable identity and require foreground disposition. Rename ambiguity SHALL block new creation and require explicit same-ID mapping before later automatic updates.

#### Scenario: Continuous source edits before dispatch

- **GIVEN** comparison uses Git B and main advances to C before the write
- **WHEN** freshness is checked
- **THEN** B is not dispatched and C remains pending for a later bounded round

#### Scenario: Source changes after saved B

- **GIVEN** B was saved and C becomes authoritative before completion
- **WHEN** post-save freshness is checked
- **THEN** B is recorded only as saved and C remains pending without claiming current synchronization or another write in that occurrence

#### Scenario: Deleted withdrawn or unfinished source

- **GIVEN** a tracked draft or schedule has a removed source, lost eligibility or return to unfinished status
- **WHEN** the next complete inventory evaluates tracked identities too
- **THEN** its content and ID are retained and foreground disposition is requested without deleting or cancelling anything

#### Scenario: Source renamed

- **GIVEN** a tracked source path or slug changes
- **WHEN** the inventory sees the old tracked identity and replacement candidate
- **THEN** both are held for explicit same-ID mapping and slug review without creating another draft

#### Scenario: Budgets end during a large inventory

- **GIVEN** the qualified finite call or time budget is exhausted
- **WHEN** a round stops
- **THEN** it records incomplete coverage and a fair continuation point without claiming all sources synchronized or clearing prior issues


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Scheduled and public articles require foreground action

Automatic draft synchronization SHALL NOT arm, publish, unschedule, reschedule, postpone, delete, edit sending/published articles or initiate email/App delivery. A confirmed schedule or historical publication SHALL exclude automatic mutation even if local source changes. Computer Use SHALL reject observed remote revision or disposition changes before editing and check state again after reload. The system SHALL report residual external-user race risk; local locks and UI checks SHALL NOT be claimed as an atomic provider guarantee. Formal activation SHALL require an owner-controlled exclusive session and executor qualification. Source changes on scheduled/public articles SHALL preserve existing provider commitments and request precise foreground authorization through existing operations.

#### Scenario: Armed article source changes

- **GIVEN** ID 221098688 is scheduled for 2026-10-22 07:00 Asia/Taipei and its source changes
- **WHEN** ordinary draft synchronization evaluates it
- **THEN** it requests foreground reconciliation while retaining that ID, saved content, time and first-delivery commitment with zero worker edits or schedule operations

#### Scenario: Schedule time or eligibility changes

- **GIVEN** a scheduled source is delayed, removed or loses its confirmed slot
- **WHEN** the background detects it
- **THEN** the original schedule remains last confirmed and the pending action requires foreground authorization without automatic cancellation or rearm

#### Scenario: External scheduling wins the race

- **GIVEN** an unscheduled draft was compared and a human schedules it before the final UI recheck
- **WHEN** the worker checks the current UI immediately before draft update
- **THEN** the worker rejects the observed stale disposition and the worker preserves the schedule without update, unschedule or compensating mutation

#### Scenario: Due time publication or sending wins

- **GIVEN** an original is sending, published or reaches its scheduled instant during processing
- **WHEN** state is rechecked or a fresh UI state check rejects it
- **THEN** the worker leaves draft scope, retains original date and delivery evidence and never falls back to immediate publication or repeat send

#### Scenario: Old first delivery approval is present

- **GIVEN** only draft-sync authority and an old first-publication approval exist
- **WHEN** new content would require a revised schedule
- **THEN** the worker cannot reuse that approval to unschedule, edit or rearm and reports foreground authorization required

#### Scenario: Unchanged protected originals remain quiet
- **GIVEN** a scheduled or published original whose verified source revision still matches Git and which has no independent hold or unresolved operation
- **WHEN** the draft worker inventories that original
- **THEN** it records exclusion from draft synchronization without authenticated access or a new foreground-required alert, preserves its provider commitments, and still requests foreground action if the source later changes


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Bounded recovery and truthful disablement

The worker SHALL retain original identity, last confirmed provider state, attempted and desired versions, unresolved intent and independent draft/publication/delivery evidence across failures and disablement. It SHALL stop new dispatch when disabled, preserve owned in-flight evidence and keep anonymous observation available. Local disablement or code rollback SHALL NOT claim provider rollback, cancellation or message recall. Routine output SHALL exclude article bodies, secrets, login state and private-share tokens.

#### Scenario: Saved readback fails

- **GIVEN** a draft save response succeeded but full reload or media evidence is unavailable
- **WHEN** the result is recorded
- **THEN** verification is incomplete on the original ID, intent evidence is retained as needed and neither synchronization nor delivery is claimed

#### Scenario: Disable during an uncertain operation

- **GIVEN** a dispatched create/update is unresolved and another article is scheduled
- **WHEN** draft writes are disabled or an older runtime is proposed
- **THEN** new dispatch stops, identities/intents and the provider schedule remain preserved and unresolved provider rollback is reported

#### Scenario: Completed owned attempt exits

- **GIVEN** a round ends by success, failure, timeout or normal interruption
- **WHEN** its existing cleanup path runs
- **THEN** only that round's temporary source/payload resources are cleaned after necessary evidence is retained, and unresolved recovery evidence is preserved

#### Scenario: Draft success is not publication evidence

- **GIVEN** a complete draft is saved and verified
- **WHEN** the owner reads the outcome
- **THEN** draft verification is reported separately, publication and subscriber receipt are not asserted and scheduling task 5.3 stays pending


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Authenticated frontend status projection

The admin API SHALL provide authenticated read-only list and per-slug projections of draft sync, publication and delivery evidence as separate states. It SHALL preserve unknown outcomes and foreground-required actions without granting mutation authority or exposing bodies, secrets, session paths or full private handoff payloads. It SHALL use no-store responses, bounded pagination and existing session authentication; missing records SHALL return 404 and unavailable state SHALL return 503 rather than empty success.

#### Scenario: Frontend reads separate states

- **GIVEN** an authenticated owner and an original with pending draft synchronization, a confirmed schedule and unknown receipt
- **WHEN** the frontend reads its draft status
- **THEN** synchronization, original provider ID, confirmed schedule and unknown delivery are separate, and no provider operation occurs

#### Scenario: Anonymous read or write request

- **GIVEN** no valid owner session, or a valid session requesting a status-route mutation
- **WHEN** the API is called
- **THEN** unauthenticated access is rejected, mutations are rejected, and no private content or provider operation is produced

#### Scenario: Missing failed or paginated read

- **GIVEN** a missing original, a failed state read or invalid list bounds
- **WHEN** an authenticated owner reads status
- **THEN** the API returns the respective not-found, unavailable or invalid-input error and never substitutes successful empty evidence


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Ordinary Chrome executor and remaining live qualification

The explicitly authorized ordinary worker SHALL execute its existing validated handoff through the bounded unattended Chrome process, independently validate real browser/content evidence, and preserve request provenance outside Git. Each request SHALL recheck source, authority, generation and durable intent before dispatch and after observation. Equal content SHALL remain read-only; failed dispatched writes SHALL retain their original intent without replay. The existing single occurrence SHALL use finite serial budgets below its 900-second interval and continue fairly through eligible inventory. Protected records SHALL require no authenticated editor access.

#### Scenario: Ordinary changed source uses real executor
- **GIVEN** an enabled qualified worker and an unchanged saved baseline A with desired finalized Git B
- **WHEN** an ordinary occurrence executes the validated draft requests
- **THEN** the unattended Chrome executor reads and updates the original ID, navigates away, reloads and verifies B, while all schedules and subscriber commitments remain unchanged

#### Scenario: Ordinary equal or failed execution
- **GIVEN** either equal saved content or a dispatched write with incomplete evidence
- **WHEN** the worker completes or resumes
- **THEN** equal content causes no write, incomplete writes retain unresolved intent, and no operator response or repeated paste is substituted

#### Scenario: Explicit temporary qualification content
- **GIVEN** the owner's separate authorization to temporarily save an image and alt qualification version on ID 221099415
- **WHEN** the real executor saves and reloads that version and then restores the complete current Git content
- **THEN** both complete saved versions are independently verified on the original ID and slug, the final content matches Git, and no Git, schedule, publication or subscriber operation occurs


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Independently gated creation capability

The owner's selected initial standing activation SHALL synchronize existing original IDs only and keep new draft creation disabled. Qualification and authorization SHALL bind this narrower capability. Missing provider identities SHALL remain foreground-required without authenticated discovery, create dispatch or mutation intent. Creation SHALL require a separately qualified and enabled capability; the present existing-ID qualification SHALL NOT claim live creation acceptance.

#### Scenario: Creation disabled with a new eligible source
- **GIVEN** standing existing-ID synchronization and a finalized source without an original provider ID
- **WHEN** the worker evaluates that source
- **THEN** it reports new draft creation disabled, performs no authenticated operation and retains no new create intent

#### Scenario: Existing original continues under creation disablement
- **GIVEN** a known unscheduled original ID with baseline A and finalized Git B while creation is disabled
- **WHEN** ordinary synchronization executes
- **THEN** it can read and update that same ID without creating an article or changing its slug


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Approved original-image identity comparison

The owner explicitly approves media equivalence only when independently verified original-image SHA256, image order, alt and all source-owned links remain intact. The draft-only comparison profile SHALL preserve raw UI HTML and compare a separate content-addressed projection for supported standalone unlinked PNG images. The projection SHALL remove only a sole-image paragraph wrapper and replace image src with the verified original binary digest; it SHALL NOT remove source-owned links, captions, text or code. Unsupported image structures/formats, missing image proof and source-asset changes SHALL stop before new editing. Initial support SHALL be bounded to eight images, eight MiB each, with HTTPS-only public reads and unchanged existing time budgets. Browser-loaded evidence SHALL remain mandatory; a provider proxy SHALL be bound to the actual public original URL observed in that same image's DOM.

#### Scenario: Provider hosts an identical original image
- **GIVEN** a standalone PNG source image and a saved provider original with exactly the same bytes, loaded display, original order and alt
- **WHEN** the worker compares the independently hashed image projection and the complete saved text, structure and links
- **THEN** the hosted URL and sole-image wrapper differences are accepted without a repeat write, and raw provider evidence remains preserved

#### Scenario: Changed media or lost source content
- **GIVEN** a saved image has different bytes, alt or order, or saved content loses code, a caption or a source-owned link
- **WHEN** saved content is compared
- **THEN** complete synchronization is rejected and the original ID and any unresolved intent are retained without replay

#### Scenario: Unsupported linked image or oversized image
- **GIVEN** a source links an image, uses an unqualified format, exceeds eight images or an image exceeds eight MiB
- **WHEN** source and comparison eligibility are evaluated
- **THEN** no authenticated write is dispatched and the source is held as unsupported rather than losing its link or saving partial content

#### Scenario: Parent verifies immediately before paste
- **GIVEN** the executor has collected real complete before-content and invokes the existing local before-verifier
- **WHEN** the parent checks image hashes, source freshness, authority, generation and the exact baseline
- **THEN** only a verdict bound to this request and before-file digest permits the paste; missing or rejected verdict leaves the attempt unresolved without claiming a save


#### Scenario: Production read-only API delivery preserves provider authority
- **GIVEN** the owner-authorized production rollout and the current production assets, configuration and tracked Substack commitments
- **WHEN** the status API is deployed and the owner reads its list and single-article status through normal authentication
- **THEN** real production records and separate sync/publication/delivery states are returned without cached private responses, unauthenticated access and attempted writes are rejected, and existing assets, provider identities, schedules, delivery commitments and disabled creation remain unchanged


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Read-only frontend status integration

The existing publishing workspace SHALL present the paginated status list, and the selected saved article SHALL read its per-slug status. It SHALL separately label draft synchronization, publication and delivery, retain the last check time in Taipei, distinguish unknown recipient receipt and preserve independent attention. Read/refresh/page navigation SHALL issue GET only with same-origin session and no-store; no create, retry-write, arm, publish or send action is added. Failed refresh SHALL retain and mark prior evidence; unauthorized sessions SHALL hide cached private records and offer the existing login. Article changes/unmount SHALL cancel or ignore obsolete replies. Missing tracked identity SHALL not imply provider absence or enable creation.

#### Scenario: Three independent states in the existing interface
- **GIVEN** a saved article has verified draft content, a confirmed future publication and armed delivery with unknown recipient receipt
- **WHEN** the owner reads its Substack status or the publishing overview
- **THEN** the interface separately displays saved-and-verified, scheduled time in Taipei and delivery arranged with no confirmed recipient receipt, including the actual last check time

#### Scenario: Unknown outcome or independent hold remains visible
- **GIVEN** a result requires reconciliation, a source is excluded from automatic draft editing, or an independent publication hold exists
- **WHEN** the status is rendered
- **THEN** the interface preserves the corresponding evidence and attention, does not label unknown as success, and adds no provider mutation control

#### Scenario: Failed refresh and expired authentication
- **GIVEN** previously displayed status and a later unavailable read or expired owner session
- **WHEN** refresh completes
- **THEN** an unavailable read retains clearly marked prior evidence, while an expired session hides private rows and requests normal login, without changing provider state

#### Scenario: Article changes or identity has not been tracked
- **GIVEN** an article selection changes while an earlier read is pending, or the selected article is not tracked
- **WHEN** replies arrive or the view closes
- **THEN** an obsolete response cannot replace the current article, closed views stop reading, and missing status is described as untracked rather than proof that the provider article is absent

#### Scenario: Pagination and responsive read-only acceptance
- **GIVEN** multiple pages or a 390px viewport in either light or dark theme
- **WHEN** the owner reads or refreshes status and navigates pages
- **THEN** page boundaries are truthful, all three status labels remain readable without horizontal page overflow, and every new network operation is read-only


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Production frontend delivery preserves draft-only authority

The authorized frontend rollout SHALL serve the qualified assets with the existing read-only API backend, authentication, bindings and production variables. Chrome production acceptance SHALL use the actual deployed Document and assets without response overrides. Creation SHALL remain disabled and tracked original identities, schedules, public articles and subscriber commitments SHALL remain unchanged.

#### Scenario: Real production interface reads independent evidence
- **GIVEN** the qualified frontend candidate, explicit rollout authorization and the current production deployment
- **WHEN** the frontend is deployed and the owner reads the publishing list and original article in Chrome
- **THEN** both real read-only APIs return current evidence, the interface separates draft synchronization, publication and delivery with Taipei check time and unknown receipt, and refresh performs no provider mutation

#### Scenario: Deployment or real evidence differs
- **GIVEN** changed production variables, an unexpected deployment identity, unavailable real API evidence or an inconclusive synchronization result
- **WHEN** rollout preflight or Chrome verification detects it
- **THEN** an unexpected preflight difference prevents deployment, incomplete verification is reported honestly, and no create, schedule, publication, notification or automatic write retry is introduced

#### Scenario: Verified rollout retains existing commitments
- **GIVEN** six tracked original identities and disabled new draft creation before rollout
- **WHEN** real production acceptance and owned-browser cleanup finish
- **THEN** original IDs and slugs, existing schedule and subscriber commitments and the synchronization configuration remain unchanged, and only owned acceptance resources are closed


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Legacy publication history reads without write authority

The deployed legacy article status query SHALL read persisted publication history through the production runtime rather than fail for an omitted reader. It SHALL remain owner-authenticated and no-store. Missing history SHALL remain empty, revision mismatch SHALL remain stale, and storage failure SHALL report unavailable. Restoring reads SHALL NOT enable legacy mutations or change provider commitments.

#### Scenario: Runtime reads existing or absent history
- **GIVEN** an authenticated owner and existing persisted target history or an article without history
- **WHEN** the deployed article status query is read
- **THEN** it returns that actual history with revision mismatch marked stale, or an empty list when absent, without a configuration error or any write

#### Scenario: Missing authorization, failed storage or attempted mutation
- **GIVEN** an unauthorized session, unavailable history storage or a mutation request against the production read-only history service
- **WHEN** the request is processed
- **THEN** private history is denied, unavailable storage remains a visible error, and mutations are rejected with no provider or state write

#### Scenario: Error recovery clears obsolete article evidence
- **GIVEN** the article view has a prior failed status read or another article
- **WHEN** a later status read succeeds or fails
- **THEN** prior error text disappears on success, and old article rows are not reused as evidence for the newly selected article; a genuine failed read stays visible


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Current Pages publication evidence is visible independently

The owner article status SHALL include current saved Pages publication, matching deployment and public verification evidence independently of the legacy target table. This read SHALL perform no ingestion, fresh verification or provider operation. The interface SHALL label these as saved historical observations with Taipei verification time and SHALL NOT equate deployment or planned time with public success.

#### Scenario: Saved public verification exists without legacy history
- **GIVEN** a current active article release has saved complete article/RSS verification and matching deployment but no legacy target row
- **WHEN** the owner reads the article status after unrelated main changes
- **THEN** the interface shows the stored publication, deployment and public verification evidence with its historical time and article link, rather than no record or a fresh verification claim

#### Scenario: Deployment is incomplete or bound to another source
- **GIVEN** a release is deployed without full page/RSS proof, or deployment refers to another commit
- **WHEN** the saved status is read
- **THEN** deployment and public verification remain distinct, missing proof stays incomplete, and an unrelated deployment cannot be shown as matched success

#### Scenario: No active record, ambiguity or failed read
- **GIVEN** an article has no active current record, multiple active records or unavailable storage
- **WHEN** its status is read
- **THEN** absence remains distinct from unlocked history and from an unavailable read, ambiguous evidence fails visibly, and no schedule or provider state changes

#### Scenario: Switching articles and authorized production verification
- **GIVEN** a previously displayed Pages record and the scoped production rollout
- **WHEN** another article is read and Chrome verifies deployed output
- **THEN** old Pages evidence is cleared, real saved evidence is displayed only for the selected article, original release and Substack commitments are preserved, creation remains disabled and only owned browser resources are cleaned


<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->

---
### Requirement: Deterministic complete draft-list evidence

Unattended draft synchronization SHALL validate all three observed lists with the same deterministic rules and actual observed totals. Both existing editor and published-detail link formats SHALL preserve their original IDs. A read failure SHALL retain prior content evidence and SHALL NOT cause a retry write, replacement draft or weaker content comparison.

#### Scenario: Published detail links coexist with draft links
- **GIVEN** complete observed draft, scheduled and published lists whose published rows use the published-detail URL shape
- **WHEN** the worker validates original ID 221099415 before full readback
- **THEN** all actual rows are counted, the original is confirmed only in drafts, and its full saved content can be independently read without any write

#### Scenario: Incomplete, conflicting or protected list evidence
- **GIVEN** observed totals differ from rows, lists are loading or paginated, a link is invalid, or an original appears in protected or duplicate identities
- **WHEN** the deterministic verifier runs in child and parent
- **THEN** reading or editing is held with a specific list/identity error, prior failures are preserved and no provider mutation is replayed

#### Scenario: Qualified original read and natural round
- **GIVEN** explicit scoped repair authorization and complete local gates
- **WHEN** Chrome fully reloads the same original and the unchanged timer later runs the repaired runtime naturally
- **THEN** complete content and exact slug/ID match current Git, creation remains disabled, schedules/publication/delivery commitments remain unchanged and owned resources are cleaned, without manual kickstart or fabricated provider evidence


#### Scenario: Unsupported creation flags cannot expand the ordinary executor
- **GIVEN** the qualified ordinary integration supports existing draft IDs and creation is not qualified
- **WHEN** discovery of a new identity or draft creation is requested, even with a creation flag set to true
- **THEN** both controller and direct executor reject before any browser process, preserve the original identity and pending intent, and require separately qualified creation support rather than infer permission from an empty discovery reply

<!-- @trace
source: automate-substack-draft-content-sync
updated: 2026-10-20
code:
  - docs/substack-draft-sync-api.md
-->