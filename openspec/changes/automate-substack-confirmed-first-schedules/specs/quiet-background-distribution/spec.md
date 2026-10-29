## MODIFIED Requirements

### Requirement: Browser-free background execution

Anonymous observer background work SHALL read only fixed Git snapshots, durable operational state and anonymous public evidence. It SHALL NOT open, activate, navigate, reload, inspect or execute scripts in the user's Chrome, read authenticated provider drafts or mutate provider state. Without a separately qualified activated draft worker, foreground work SHALL prepare all drafts. Foreground work SHALL exclusively revise, postpone and cancel schedules. Initial preparation and first arming SHALL additionally be permitted only to the separately qualified activated worker defined by automatic-substack-first-schedules. Without that worker, foreground work SHALL exclusively arm schedules. A separate unattended-draft-sync-v1 worker SHALL perform only the draft operations specified by unattended-substack-drafts; it SHALL NOT grant the anonymous observer authenticated access or writes. Existing foreground source-edit and schedule policies SHALL remain in force outside that narrowly activated scope. A known armed identity SHALL be anonymously checked at or after its confirmed due time without requiring Pages availability; pre-due absence SHALL NOT be treated as publication failure. Content drift, cancellation requests and unknown operations SHALL produce foreground attention rather than a mutation fallback. Direct background execution SHALL enforce the same boundary under the target lock with fresh disposition checks.

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

#### Scenario: Qualified first-schedule worker shares orchestration
- **GIVEN** a separately qualified activated first-schedule worker and the existing anonymous observer
- **WHEN** the same ordinary occurrence evaluates a confirmed future original
- **THEN** only the scoped worker prepares and first-arms that original under existing serialization while the observer remains browser-free and zero-write
