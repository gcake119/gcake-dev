## Purpose

Keep scheduled Substack verification silent and independent of the user's Chrome activity. Preserve durable human-action holds without replaying failed or uncertain work.

## ADDED Requirements

### Requirement: Durable manual hold

The scheduled synchronizer SHALL skip an article target requiring human action until explicit attended resolution changes its persisted disposition. Source changes, new scheduled occurrences and retained recovery evidence SHALL NOT release that hold. It SHALL preserve original identity and unresolved evidence.

#### Scenario: Repeated manual hold
- **GIVEN** an article requires human action
- **WHEN** two successive scheduled rounds inspect it
- **THEN** neither round attempts verification, preparation, publication or recovery for it and the repeated result stays quiet

#### Scenario: Changed source or retained intent
- **GIVEN** a held article has a changed source version or unresolved intent
- **WHEN** background planning runs
- **THEN** it remains held and the original article identity and intent remain intact

#### Scenario: Explicit resolution
- **GIVEN** an operator resolves the held article in an explicit foreground operation
- **WHEN** its persisted disposition becomes verified for the current source
- **THEN** the next scheduled occurrence can verify its public article anonymously

### Requirement: Browser-free background execution

The synchronizer SHALL perform background work solely through anonymous public verification of an unchanged known public article without unsettled intent. It SHALL NOT open, activate, navigate, reload, inspect or execute scripts in the user's Chrome. New articles, changed sources, drafts and metadata recovery SHALL be deferred for attended work. Direct background execution SHALL enforce the same rule even with stale plans or approvals.

#### Scenario: Unchanged verified article
- **GIVEN** an unchanged verified article with a known public URL and no unsettled intent
- **WHEN** background verification runs
- **THEN** it verifies the same identity using public evidence without a browser, login or article write

#### Scenario: Browser operation is required
- **GIVEN** a new article, changed source, prepared draft or unresolved metadata operation
- **WHEN** a scheduled round or direct background command evaluates it
- **THEN** it reports attended work required before controlling a browser or writing an article

#### Scenario: Disposition changed after planning
- **GIVEN** a planned verification whose target now requires human action
- **WHEN** background execution rechecks current state
- **THEN** it stops before public verification or browser access

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
- **GIVEN** identity parses correctly but current public content or date does not match the source
- **WHEN** the operator verifies the article
- **THEN** it stays blocked for human action on the original ID without attempting a write or loosening verification
