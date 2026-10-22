# quiet-background-distribution Specification

## Purpose

Keep browser-free Substack observation and human-action notifications truthful while preserving source identity, confirmed provider commitments and delivery evidence. The anonymous observer never uses authenticated provider access or mutates provider state. A separately qualified and activated unattended-draft-sync-v1 draft worker may perform only its authorized unscheduled draft operations under unattended-substack-drafts; it grants no browser or write authority to the observer. Foreground work retains schedule changes, publication, public corrections and subscriber-delivery authority, and draft changes outside that qualified scope.

## Requirements

### Requirement: Durable manual hold

The scheduled synchronizer SHALL skip article mutations requiring human action until explicit foreground reconciliation changes the persisted disposition. Source changes, new scheduled occurrences and retained recovery evidence SHALL NOT release a hold. It SHALL preserve original identity, unresolved evidence and any last confirmed provider schedule. Read-only source/state observation SHALL report an outstanding provider schedule without claiming that a local hold stops provider publication. A matching foreground-confirmed draft, schedule, cancellation or public verification SHALL resolve only its corresponding hold. The Content attention requires confirmed meaningful drift requirement SHALL additionally permit fresh complete anonymous evidence to clear a legacy unconfirmed presentation-only verification hold without resolving genuine content, identity or mutation holds.

#### Scenario: Repeated manual hold
- **GIVEN** an article requires human action
- **WHEN** two successive scheduled rounds inspect it
- **THEN** neither round attempts authenticated provider work or a provider mutation, and an unchanged attention result stays quiet

#### Scenario: Changed source or retained intent
- **GIVEN** a held article has a changed source version or unresolved intent
- **WHEN** background planning runs
- **THEN** the hold, original identity and unresolved evidence remain intact

#### Scenario: Explicit resolution
- **GIVEN** an operator verifies the current draft, schedule, cancellation or public article in a foreground reconciliation
- **WHEN** the persisted observation matches the current requested disposition
- **THEN** only that resolved hold is cleared and background observation resumes without creating or sending an article

#### Scenario: Local pause does not stop the provider
- **GIVEN** an armed provider schedule and a newly recorded local hold or pause
- **WHEN** background observation reports the article
- **THEN** it explicitly reports that provider publication is still armed until foreground cancellation is confirmed

---
### Requirement: Browser-free background execution

Anonymous observer background work SHALL read only fixed Git snapshots, durable operational state and anonymous public evidence. It SHALL NOT open, activate, navigate, reload, inspect or execute scripts in the user's Chrome, read authenticated provider drafts or mutate provider state. Without a separately qualified activated draft worker, foreground work SHALL prepare all drafts. Foreground work SHALL exclusively arm, revise, postpone and cancel schedules. A separate unattended-draft-sync-v1 worker SHALL perform only the draft operations specified by unattended-substack-drafts; it SHALL NOT grant the anonymous observer authenticated access or writes. Existing foreground source-edit and schedule policies SHALL remain in force outside that narrowly activated scope. A known armed identity SHALL be anonymously checked at or after its confirmed due time without requiring Pages availability; pre-due absence SHALL NOT be treated as publication failure. Content drift, cancellation requests and unknown operations SHALL produce foreground attention rather than a mutation fallback. Direct background execution SHALL enforce the same boundary under the target lock with fresh disposition checks.

#### Scenario: Unchanged verified article
- **GIVEN** an unchanged verified article with a known public URL and no unsettled intent
- **WHEN** background verification runs
- **THEN** it verifies the same identity using public evidence without a browser, login or article write

#### Scenario: Browser operation is required
- **GIVEN** a new article, changed source or draft outside a qualified activated draft-worker scope, or any unresolved schedule operation
- **WHEN** a scheduled round or direct background command evaluates it
- **THEN** it reports foreground work required before controlling a browser or writing an article

#### Scenario: Disposition changed after planning
- **GIVEN** a planned verification whose target now has an unresolved hold or schedule mutation
- **WHEN** execution rechecks current state under its lock
- **THEN** it preserves the current evidence and refuses provider mutation or authenticated access

#### Scenario: Armed article becomes due without a running controller
- **GIVEN** an unchanged confirmed schedule and an unavailable foreground controller
- **WHEN** Substack publishes at its due time and a later background round observes it
- **THEN** the round anonymously verifies the original identity and armed version while Pages and delivery observations remain separate

#### Scenario: Qualified worker shares orchestration

- **GIVEN** a separately activated qualified draft worker and the existing anonymous observer
- **WHEN** the single ordinary occurrence runs
- **THEN** only the worker uses its scoped authenticated draft port, the observer stays anonymous-only with zero provider writes, and both serialize with foreground writers

#### Scenario: Worker is disabled

- **GIVEN** the worker is unqualified or disabled
- **WHEN** an ordinary round sees a new draft or changed source
- **THEN** existing foreground preparation and reconciliation attention remains available without authenticated access or a new timer

---
### Requirement: Preserve evidence and scheduling

The synchronizer SHALL preserve pin validation, single-writer locks, source verification, unsettled-intent auditing and owned-source cleanup. Runtime cutover SHALL retain prior private configuration and credentials and SHALL distinguish local checks from real scheduled acceptance.

#### Scenario: Repeated held round
- **GIVEN** a matching runtime pin and existing held targets
- **WHEN** the system scheduler starts a round
- **THEN** it records the holds, preserves durable state, removes its owned source snapshot and leaves Chrome untouched

#### Scenario: Invalid pin or active writer
- **GIVEN** a changed runtime pin or another active writer
- **WHEN** the round begins
- **THEN** it stops without taking over the writer or accessing a browser

---
### Requirement: Hermes human-action notification

The synchronizer SHALL notify the owner through the existing Hermes Telegram home channel when a human-action issue set first appears or changes. An unchanged set SHALL stay quiet across rounds and process restarts. Existing held items SHALL be announced once when delivery is first activated, regardless of an older quiet-round marker. A confirmed clear round SHALL allow a later recurrence to notify again; source failures SHALL NOT silently clear held issues. The notification SHALL include affected articles, reasons and public source links without credentials or private source content.

#### Scenario: Current holds become visible
- **GIVEN** two existing held articles and an older quiet-round marker
- **WHEN** Hermes delivery is activated and consumes the completed round
- **THEN** it sends one combined attention message through the configured home channel and does not retry the article operations

#### Scenario: Repeated and recurring issues
- **GIVEN** the same attention set was already notified
- **WHEN** it is observed again after a sender restart
- **THEN** no additional message is sent
- **AND** a subsequent confirmed clear round followed by recurrence produces one new message

#### Scenario: Delivery outcome is unknown
- **GIVEN** an attention message was attempted and no definite acknowledgement was obtained
- **WHEN** the same issue set is observed again
- **THEN** no resend occurs, the unresolved delivery remains visible and human receipt remains unconfirmed

#### Scenario: Privileged activation is unavailable
- **GIVEN** the existing Hermes service account requires owner authentication
- **WHEN** an agent prepares notification support without that authentication
- **THEN** the safe existing synchronizer remains running and actual Hermes delivery is explicitly pending owner activation

---
### Requirement: Inert public identity format compatibility

The verifier SHALL accept a unique designated application/json identity record or a unique legacy inline JSON string without executing JavaScript. It SHALL reject malformed, duplicate, competing, off-publication or off-canonical identity evidence. Supporting the new representation SHALL NOT weaken full-content, source, original-ID or date checks.

#### Scenario: Current public data representation
- **GIVEN** an original public article exposes one valid designated JSON identity record
- **WHEN** anonymous verification reads it
- **THEN** it resolves the original article ID and exact public URL without executing scripts or opening a browser

#### Scenario: Conflicting or malformed identity
- **GIVEN** duplicate records, mixed old and new records, malformed data or a mismatched publication or URL
- **WHEN** verification reads the public article
- **THEN** it fails closed and does not create, modify or publish an article

#### Scenario: Explicit original-ID recovery
- **GIVEN** the two held original articles and current source receipts
- **WHEN** the operator explicitly verifies their identity, title, full body, links, images and original publication minute
- **THEN** only successful articles return to verified on their original IDs with zero article writes, zero Email/App delivery and no browser access

#### Scenario: Content still differs
- **GIVEN** identity parses correctly but meaningful current public content or date does not match the source
- **WHEN** the operator verifies the article
- **THEN** it stays blocked for human action on the original ID without attempting a write or loosening verification

---
### Requirement: Reviewed scheduler boundaries

Scheduler activation and execution SHALL require anonymous-only acceptance with zero browser access and zero article writes. Human-action snapshots SHALL include every durable manual hold, even when its source is missing or ineligible, and SHALL clear only after complete durable-state evidence. Background eligibility SHALL be enforced while owning the target lock; a genuine hold rejection SHALL preserve the current state and unresolved evidence without a public read. Reassessment of a legacy unconfirmed presentation-only verification hold SHALL follow Content attention requires confirmed meaningful drift and SHALL NOT resolve genuine mutation or identity holds.

#### Scenario: Legacy receipt is presented
- **GIVEN** a previously accepted native or profile receipt without anonymous-only evidence
- **WHEN** scheduler installation or runtime validation checks it
- **THEN** it rejects the receipt before a round starts

#### Scenario: Held source disappears
- **GIVEN** a durable held article whose source is deleted or ineligible
- **WHEN** a completed round omits that article from its execution results
- **THEN** the article remains in the Hermes attention snapshot without any retry

#### Scenario: Clear evidence is unavailable
- **GIVEN** an existing human-action snapshot
- **WHEN** a round omits the held article and a complete durable hold read is unavailable or fails
- **THEN** the previous snapshot is preserved

#### Scenario: Confirmed durable resolution
- **GIVEN** all durable holds have been explicitly resolved and current round results contain no attended blockers
- **WHEN** a complete successful round reads the durable hold set
- **THEN** it clears the active attention snapshot without a delivery

#### Scenario: Hold appears before lock acquisition
- **GIVEN** a background verification was planned and its target becomes held before it obtains the target lock
- **WHEN** the background verifier obtains the lock
- **THEN** it refuses verification, preserves the original hold and diagnostics, and releases its lock without public or browser access

---
### Requirement: Scheduled-source observation reuses existing attention

Background observation SHALL compare each tracked schedule against current finalized source eligibility, content version, slug and confirmed original-site slot using the existing attention channel. It SHALL include armed schedules even when the source is missing or ineligible. A requested change SHALL remain pending until foreground provider readback confirms it. Unchanged issues SHALL reuse existing deduplication rather than a new notification timer. A source or durable-state read failure SHALL preserve the prior attention and schedule evidence.

Existing public mirrors SHALL remain observable after their first publication. A new eligible source content version or anonymously confirmed meaningful public content divergence SHALL request same-ID foreground content synchronization; genuine public mismatches SHALL NOT be resolved merely by resetting verification status. Description/presentation-only differences for unchanged sources and incomplete reads SHALL follow Content attention requires confirmed meaningful drift. Private draft comparison and all editing SHALL remain foreground work.

#### Scenario: Published original changes
- **GIVEN** a tracked public mirror and a newer saved source content version
- **WHEN** background observation detects the difference
- **THEN** it requests foreground compare-and-edit of the same public article, preserves its delivery history, and does not access Chrome or declare the content synchronized

#### Scenario: Armed source is edited, delayed or removed
- **GIVEN** an armed schedule and a newer source version, replacement slot, return to draft or source deletion
- **WHEN** background observation completes
- **THEN** the existing attention channel reports the pending action and last confirmed provider time without changing Chrome or claiming the schedule was updated

#### Scenario: Repeated pending change
- **GIVEN** an unchanged pending change already reported through the existing attention channel
- **WHEN** the next background round observes it
- **THEN** no duplicate notification or provider write is initiated

#### Scenario: Schedule cannot be fully observed
- **GIVEN** a previous outstanding provider schedule and unavailable current source or operational evidence
- **WHEN** background observation fails
- **THEN** it preserves the previous schedule and attention and does not report cancellation or successful synchronization

---
### Requirement: Action-specific truthful attention reasons

The observer and existing Hermes producer/consumer SHALL preserve bounded pending-action reasons from the observed article through durable holds and notification rendering. New eligible series drafts SHALL be reported as foreground preparation work, content drift as same-ID content synchronization, postponement and cancellation as their respective pending operations, and an uncertain schedule intent as reconciliation. Routine preparation SHALL NOT be described as failed publication, an identity error or paused automatic retries. Unknown legacy errors SHALL remain generic manual review rather than an asserted identity mismatch. Durable fallback holds SHALL NOT replace a more specific current reason with a generic reason. An unchanged issue set SHALL remain quiet across rounds and sender restarts; real unresolved content, identity or schedule issues SHALL NOT be suppressed merely because another draft was added. Source/D1 read failure SHALL preserve prior attention evidence.

#### Scenario: Add a ready series draft
- **GIVEN** a finalized unpublished series article with no known Substack ID and no failed operation
- **WHEN** a background round and the existing attention sender process it
- **THEN** the message requests foreground draft preparation without claiming publication failed, identity is wrong or retries were paused

#### Scenario: Existing content mismatch remains distinct
- **GIVEN** a known article with a pending content comparison and a newly added series draft
- **WHEN** the notification snapshot also reads durable holds
- **THEN** it reports content synchronization for the existing ID and preparation for the new draft without converting either to an identity error

#### Scenario: Armed change or uncertain operation
- **GIVEN** a pending cancellation, postponement or unresolved schedule mutation
- **WHEN** the attention message is rendered
- **THEN** it names the pending operation and does not claim the provider schedule has already changed or stopped

#### Scenario: Repeated or incomplete observation
- **GIVEN** the same reasoned issue set was already notified
- **WHEN** another completed round or sender restart processes it
- **THEN** no duplicate message is sent and a failed source or state read cannot clear those issues

---
### Requirement: Content attention requires confirmed meaningful drift

For an unchanged authoritative source revision, background observation SHALL NOT notify content synchronization for a description-only presentation difference or the observed provider-only code wrappers and terminal empty-line artifacts. It SHALL still detect title, body structure, non-terminal code whitespace, links, images and alt-text changes. A changed authoritative source with changed supported content, including description, SHALL remain pending foreground synchronization. Strict foreground content verification SHALL remain unchanged; ignored presentation differences SHALL NOT qualify complete content synchronization.

A failed or incomplete anonymous read SHALL record verification as inconclusive, preserve prior verified evidence and unresolved genuine holds, and SHALL NOT infer content drift or initiate an edit. Fresh complete evidence SHALL reassess a legacy generic public-verification content hold; presentation-only differences SHALL clear that false hold without provider writes. Confirmed meaningful drift, identity mismatches, changes to a previously verified actual publication timestamp and unknown mutation intents SHALL remain actionable. A difference between confirmed schedule and actual first publication time alone SHALL NOT be treated as identity/content drift. During a partial round, notification publication SHALL retain prior issues for affected and unobserved articles without inferring content drift, while independent complete observations SHALL advance their own notification results.

#### Scenario: Existing public originals have presentation-only differences

- **GIVEN** three previously published originals retain their authoritative source versions and public identities
- **WHEN** complete public reads differ only in descriptions, nested code presentation or terminal editor-generated empty lines
- **THEN** no content-synchronization notification or provider mutation occurs, legacy unconfirmed verification holds are cleared, and presentation-only evidence does not claim full synchronization

#### Scenario: A real source or provider content change remains actionable

- **GIVEN** an existing public article with a known original identity
- **WHEN** its authoritative supported content changes, or a complete public read confirms a changed title, paragraph, structure, inner code spacing, link, image or alt text
- **THEN** the original identity remains pending foreground content synchronization without a background edit or newsletter send

#### Scenario: An anonymous read cannot establish the current content

- **GIVEN** retained verified content evidence and any existing genuine pending actions
- **WHEN** a public read fails, is incomplete, or lacks a confirmed publication minute
- **THEN** verification remains inconclusive, prior evidence and pending actions are retained, and no content change or completed synchronization is asserted

#### Scenario: Strict foreground verification remains strict

- **GIVEN** presentation-only differences do not trigger a background content notification
- **WHEN** an explicit foreground synchronization verifies the complete source-owned content
- **THEN** its existing description, structure, link, media and meaningful code-whitespace checks still apply


#### Scenario: Another article has complete current evidence
- **GIVEN** one public read is inconclusive and another original article has complete matching public identity and full content
- **WHEN** a partial round publishes its notification snapshot
- **THEN** affected and unobserved prior holds remain, while the independently verified publication remains eligible for a success notification without any provider mutation

---
### Requirement: Queue revisions do not imply provider postponement

Background schedule observation SHALL compare the tracked original article and the confirmed actual publication instant with the last confirmed provider time. A queue-version change or an equivalent UTC/Taipei timestamp representation SHALL NOT request postponement when the article and actual instant are unchanged. Fresh matching evidence SHALL clear a previously inferred postponement hold without changing the saved provider commitment, delivery history or schedule. Real time changes, lost eligibility or missing confirmed slots SHALL remain pending foreground work. Unresolved mutation intents and independent content/identity errors SHALL NOT be cleared by queue equivalence.

Foreground mutation approval and handoff SHALL continue requiring the exact current reservation/version/time commitment. The notification correction SHALL NOT authorize rearming, unscheduling, content editing, publication or subscriber delivery. Deployment SHALL retain the single existing read-only observer and existing Hermes consumer/ledger when their compatibility is unchanged.

#### Scenario: Queue version changes at the same publication instant

- **GIVEN** an original article is confirmed scheduled at 2026-10-22 07:00 Asia/Taipei and its queue version is 162
- **WHEN** the queue becomes version 165 with the same article and the same publication instant, expressed as either Taipei time or 2026-10-21T23:00:00Z
- **THEN** no postponement notification or provider operation occurs and the last confirmed provider time and delivery commitment remain unchanged

#### Scenario: An old version-only postponement notification is reassessed

- **GIVEN** a pending postponement inferred only from a queue revision and no unresolved mutation intent or independent error
- **WHEN** fresh confirmed source/queue evidence matches the original scheduled article and actual provider instant
- **THEN** only the false postponement hold is cleared and the existing attention snapshot clears quietly without resetting delivery history

#### Scenario: A real schedule change remains actionable

- **GIVEN** a tracked armed article with a last confirmed provider time
- **WHEN** its actual source time changes, its source becomes ineligible, or its confirmed slot disappears
- **THEN** postponement or cancellation remains pending foreground readback and the background never changes the provider schedule

#### Scenario: Version equivalence does not grant mutation approval

- **GIVEN** an earlier foreground mutation review and a newer queue version for the same actual time, or an unresolved mutation intent
- **WHEN** a mutation handoff or background observation rechecks it
- **THEN** stale mutation approval is rejected and unknown mutation evidence is retained without replay

---
### Requirement: Draft worker shares quiet attention without weakening evidence

The worker and observer SHALL reuse the existing timer, locks, attention producer/consumer and durable deduplication ledger. Equal content and repeated unchanged holds SHALL stay quiet. A failed/incomplete source, state or provider read SHALL preserve prior attention and evidence instead of inventing drift or clearing unresolved issues. Strict draft verification SHALL remain independent of unchanged-source presentation-only notification suppression. Equivalent actual publication times for the same article SHALL NOT request postponement merely because queueVersion or timezone text differs. Worker success SHALL clear only its confirmed resolved draft hold, never independent schedule/identity/unknown-intent holds.

#### Scenario: Equal or repeated worker result

- **GIVEN** an equal draft or unchanged human-action set was already observed
- **WHEN** ordinary rounds or sender restarts process it again
- **THEN** no repeated notification or second timer is introduced

#### Scenario: Full read is unavailable

- **GIVEN** prior evidence and genuine pending actions exist
- **WHEN** a source, state or saved-provider read fails or is incomplete
- **THEN** verification stays incomplete, previous attention persists and no inferred content-change notification or success is produced

#### Scenario: Existing content false positives remain suppressed

- **GIVEN** an unchanged authoritative public source differs only by description presentation or known platform code wrappers/terminal empty lines
- **WHEN** the anonymous observer runs with the new worker present
- **THEN** it sends no false content notification while strict draft body, description, code and media verification remains required

#### Scenario: Queue version changes at the same instant

- **GIVEN** the same article is committed at 2026-10-22 07:00 Asia/Taipei with version 162
- **WHEN** queue version becomes 165 at the equivalent 2026-10-21T23:00:00Z
- **THEN** no postponement is notified or schedule changed, while foreground exact-version approval and independent errors remain intact

#### Scenario: A genuine separate issue remains

- **GIVEN** draft content has been verified but an unknown schedule intent or identity hold remains
- **WHEN** a completed worker result updates attention
- **THEN** only the resolved draft issue clears and the independent unresolved issue remains visible through existing deduplication
