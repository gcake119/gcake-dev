## MODIFIED Requirements

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

### Requirement: Browser-free background execution

Anonymous observer background work SHALL read only fixed Git snapshots, durable operational state and anonymous public evidence. It SHALL NOT open, activate, navigate, reload, inspect or execute scripts in the user's Chrome, read authenticated provider drafts or mutate provider state. Without a separately qualified activated draft worker, foreground work SHALL prepare all drafts. Foreground work SHALL exclusively arm, revise, postpone and cancel schedules. A separate unattended-draft-sync-v1 worker SHALL perform only the draft operations specified by unattended-substack-drafts; it SHALL NOT grant the anonymous observer authenticated access or writes. Existing foreground source-edit and schedule policies SHALL remain in force outside that narrowly activated scope. A known armed identity SHALL be anonymously checked at or after its confirmed due time without requiring Pages availability; pre-due absence SHALL NOT be treated as publication failure. Content drift, cancellation requests and unknown operations SHALL produce foreground attention rather than a mutation fallback. Direct background execution SHALL enforce the same boundary under the target lock with fresh disposition checks.

Scheduled-round and direct-background checks in the anonymous-observer scenarios below SHALL retain the observer-only boundary regardless of draft-worker activation. Only scenarios explicitly addressing the separately qualified worker SHALL exercise its existing scoped draft authority.

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

#### Scenario: Anonymous observer requires foreground browser work
- **GIVEN** a new article, changed source, draft or unresolved schedule operation
- **WHEN** a scheduled round or direct background command evaluates it
- **THEN** it reports foreground work required before controlling a browser or writing an article

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

### Requirement: Content attention requires confirmed meaningful drift

For an unchanged authoritative source revision, background observation SHALL NOT notify content synchronization for a description-only presentation difference or the observed provider-only code wrappers and terminal empty-line artifacts. It SHALL still detect title, body structure, non-terminal code whitespace, links, images and alt-text changes. A changed authoritative source with changed supported content, including description, SHALL remain pending foreground synchronization. Strict foreground content verification SHALL remain unchanged; ignored presentation differences SHALL NOT qualify complete content synchronization.

A failed or incomplete anonymous read SHALL record verification as inconclusive, preserve prior verified evidence and unresolved genuine holds, and SHALL NOT infer content drift or initiate an edit. Fresh complete evidence SHALL reassess a legacy generic public-verification content hold; presentation-only differences SHALL clear that false hold without provider writes. Confirmed meaningful drift, identity/time mismatches and unknown mutation intents SHALL remain actionable. Notification publication SHALL retain the previous attention snapshot during an inconclusive read rather than send newly inferred content issues or clear unresolved attention.

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
