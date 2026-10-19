## MODIFIED Requirements

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


## ADDED Requirements

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
