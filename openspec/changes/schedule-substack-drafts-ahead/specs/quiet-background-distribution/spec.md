## MODIFIED Requirements

### Requirement: Durable manual hold

The scheduled synchronizer SHALL skip article mutations requiring human action until explicit foreground reconciliation changes the persisted disposition. Source changes, new scheduled occurrences and retained recovery evidence SHALL NOT release a hold. It SHALL preserve original identity, unresolved evidence and any last confirmed provider schedule. Read-only source/state observation SHALL report an outstanding provider schedule without claiming that a local hold stops provider publication. A matching foreground-confirmed draft, schedule, cancellation or public verification SHALL resolve only its corresponding hold.

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

Background work SHALL read only fixed Git snapshots, durable operational state and anonymous public evidence. It SHALL NOT open, activate, navigate, reload, inspect or execute scripts in the user's Chrome, read authenticated provider drafts or mutate provider state. Foreground work SHALL prepare, arm, revise, postpone and cancel schedules. A known armed identity SHALL be anonymously checked at or after its confirmed due time without requiring Pages availability; pre-due absence SHALL NOT be treated as publication failure. Content drift, cancellation requests and unknown operations SHALL produce foreground attention rather than a mutation fallback. Direct background execution SHALL enforce the same boundary under the target lock with fresh disposition checks.

#### Scenario: Unchanged verified article
- **GIVEN** an unchanged verified article with a known public URL and no unsettled intent
- **WHEN** background verification runs
- **THEN** it verifies the same identity using public evidence without a browser, login or article write

#### Scenario: Browser operation is required
- **GIVEN** a new article, changed source, draft or unresolved schedule operation
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

## ADDED Requirements

### Requirement: Scheduled-source observation reuses existing attention

Background observation SHALL compare each tracked schedule against current finalized source eligibility, content version, slug and confirmed original-site slot using the existing attention channel. It SHALL include armed schedules even when the source is missing or ineligible. A requested change SHALL remain pending until foreground provider readback confirms it. Unchanged issues SHALL reuse existing deduplication rather than a new notification timer. A source or durable-state read failure SHALL preserve the prior attention and schedule evidence.

Existing public mirrors SHALL remain observable after their first publication. A new eligible source content version or anonymously detected public content divergence SHALL request same-ID foreground content synchronization; public mismatches SHALL NOT be resolved merely by resetting verification status. Private draft comparison and all editing SHALL remain foreground work.

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
