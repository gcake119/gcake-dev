## Purpose
Connect approved editorial ordering to recoverable deployment attempts and verified public notifications while keeping production disabled until acceptance.
## ADDED Requirements
### Requirement: Complete manifest eligibility
The queue SHALL use full manifest order and SHALL persist first-observed readiness independently of file modification times.
#### Scenario: Partial series
- **GIVEN** a series has one ready chapter and one planned or missing chapter
- **WHEN** ingestion runs
- **THEN** no chapter of that series is scheduled
#### Scenario: Six finalized chapters
- **GIVEN** all six chapters of 2026 鐵人賽幕後 are ready
- **WHEN** ingestion repeats or body-only revisions are saved
- **THEN** one ordered group retains its original readiness time and all bodies remain unchanged
### Requirement: Priority and slots
The queue SHALL release at most one article per Monday/Thursday slot starting 07:00 Asia/Taipei, prioritize ready standalones in FIFO order, resume an active series before another series, and never backfill old missed slots.
#### Scenario: Standalone interruption
- **GIVEN** a series started Monday and two standalones became ready Tuesday then Wednesday
- **WHEN** the next three slots are selected
- **THEN** Thursday releases the first standalone, Monday the second and Thursday the next series chapter
#### Scenario: Late standalone
- **GIVEN** Monday's slot has a completed release
- **WHEN** a standalone arrives after that run
- **THEN** it waits until Thursday
#### Scenario: Missed windows
- **GIVEN** multiple release windows passed without a successful run
- **WHEN** the scheduler resumes
- **THEN** only the latest eligible slot has one reservation and older slots remain unpublished
### Requirement: Safe lifecycle and activation
The system SHALL keep production writes disabled by default, retain pending attempts across build/deployment failures, reject concurrent repository writes, and confirm consumption only after public RSS and canonical HTML verification.
#### Scenario: Disabled save or push
- **GIVEN** activation has not been accepted and ready content exists
- **WHEN** a CMS save or repository push triggers a build
- **THEN** ready content remains absent from public output
#### Scenario: Build failure and retry
- **GIVEN** a reserved article failed its build
- **WHEN** the next recovery runs
- **THEN** the same attempt is retried and no additional article consumes a slot
#### Scenario: Repository conflict
- **GIVEN** CMS changed the repository after release preparation
- **WHEN** the release writer attempts to advance the repository
- **THEN** it fails visibly without overwriting CMS changes
#### Scenario: Deleted or inconsistent pending content
- **GIVEN** a pending article is deleted or its publication metadata is inconsistent
- **WHEN** recovery runs
- **THEN** publication stops for operator repair without consuming another slot
### Requirement: Verified restart-safe notification
Hermes SHALL initialize historical feed entries silently, verify new local canonical HTML pages before notification, persist canonical identities, back off on failures and isolate dry-run state from live delivery.
#### Scenario: Initial baseline
- **GIVEN** Hermes has no stored feed baseline
- **WHEN** the first successful RSS check runs
- **THEN** historical articles produce no Telegram messages
#### Scenario: New article and restart
- **GIVEN** a new RSS article has a successfully fetched canonical page
- **WHEN** Hermes checks twice with a restart between checks
- **THEN** exactly one Telegram message contains title, URL and Taipei publication time
#### Scenario: Feed or page outage
- **GIVEN** RSS or the new article page is unavailable
- **WHEN** Hermes checks
- **THEN** no success message is sent and failures back off without claiming publication failure from a feed outage
#### Scenario: Ambiguous Telegram delivery
- **GIVEN** a send was attempted but its response is lost
- **WHEN** Hermes restarts
- **THEN** it reports an uncertain delivery for manual reconciliation and does not automatically resend
### Requirement: Controlled mock delivery
The system SHALL provide an explicit isolated notification test mode accepting only HTTP sites and simulated Telegram endpoints on numeric IPv4 loopback 127.0.0.1. It SHALL use synthetic credentials, an explicit separate state path, and preserve production site, endpoint and activation restrictions. State SHALL be bound to notification mode and canonical site.
#### Scenario: Isolated feed to simulated Telegram
- **GIVEN** a controlled loopback RSS site, canonical article pages and a simulated Telegram API
- **WHEN** the operator initializes a baseline, adds a new article and restarts the test monitor
- **THEN** historical articles produce zero requests, the verified new article produces exactly one simulated sendMessage request with title, URL and Taipei time, and repeated checks or GUID changes produce no additional requests
#### Scenario: Rejected page and lost simulated response
- **GIVEN** a new test article has an unavailable or mismatched canonical page
- **WHEN** the test monitor checks it
- **THEN** no simulated message is sent and the check backs off until the page is valid
- **GIVEN** the simulated API accepts a request but loses its response
- **WHEN** the monitor restarts
- **THEN** delivery remains uncertain and no automatic resend occurs
#### Scenario: Unsafe test configuration
- **GIVEN** a test configuration uses a non-loopback site or endpoint, mixes live delivery with testing, omits the explicit state path, or reuses state from another mode or site
- **WHEN** the operator runs the monitor
- **THEN** it fails without contacting an external Telegram API or enabling production delivery
#### Scenario: Redirect outside test boundary
- **GIVEN** the test site or simulated API returns a redirect
- **WHEN** the monitor requests it
- **THEN** the redirect is rejected without contacting the redirected destination
#### Scenario: Transport boundary remains gated
- **GIVEN** production notifications are disabled or a caller attempts to substitute a production sender into test mode
- **WHEN** delivery is invoked through the program interface
- **THEN** it fails before opening a real transport, and test delivery accepts only its fixed synthetic loopback destination and chat
#### Scenario: Production state stays untouched
- **GIVEN** a non-live run selects the default live state path or existing state belonging to another mode or site
- **WHEN** it polls or requests status
- **THEN** it fails before changing database contents or permissions, including when the default live file does not exist yet
- **GIVEN** a status request selects a missing state file
- **WHEN** it runs
- **THEN** no state file is created

### Requirement: Unattended release preparation
The system SHALL support release writes using a dedicated repository-scoped GitHub App without a fallback write identity. The system SHALL provide a read-only audit that distinguishes configuration evidence from permission, deployment and human acceptance. Production SHALL remain disabled until separately accepted.
#### Scenario: Missing identity or wrong destination
- **GIVEN** production is disabled, the branch is not main, unattended release credentials are missing or the Git destination differs from gcake119/gcake-dev
- **WHEN** a release push is requested
- **THEN** no authenticated push occurs and the operation fails without exposing credentials
#### Scenario: Scoped release writer
- **GIVEN** an accepted dedicated App identity for gcake119/gcake-dev and a validated release commit
- **WHEN** the release writer pushes
- **THEN** only main is advanced without force and the temporary credential is not saved in the checkout
#### Scenario: Configuration inspection
- **GIVEN** production is disabled and unattended environment, identity or main protection settings are missing
- **WHEN** the owner runs the configuration audit
- **THEN** missing requirements are reported without creating settings, tokens, publication commits or messages
#### Scenario: Configuration is not activation acceptance
- **GIVEN** configuration requirements have been satisfied
- **WHEN** the audit completes
- **THEN** provider-write, Pages, content and Telegram acceptance remain explicit separate gates, and production remains disabled
#### Scenario: Preserve the approved CMS save workflow
- **GIVEN** the owner approved retaining direct CMS saves and a separate editorial release App
- **WHEN** the main protection configuration is inspected
- **THEN** only the identified CMS App and editorial App may bypass the PR and CI rule, while neither may bypass force-push or branch-deletion protection
#### Scenario: Missing or additional writer exceptions
- **GIVEN** either approved App exception is missing, an App identity differs, or another actor has a bypass
- **WHEN** the main protection configuration is inspected
- **THEN** configuration is reported incomplete and production stays disabled

### Requirement: Read-only Actions Secret acceptance
The system SHALL offer manually selected Secret acceptance on the exact reviewed feature revision, independent of production activation. It SHALL require both release automation flags false or unset, mint only repository-scoped contents-read access, validate the dedicated App installation and selected repository, and revoke the token on job completion. It SHALL perform no content, queue, database, deployment or Telegram writes, and SHALL NOT print credentials. Temporary environment branch permission SHALL require explicit owner approval and be removed after acceptance.
#### Scenario: Valid reviewed Secret
- **GIVEN** the owner has allowed the reviewed feature branch and both release flags are disabled
- **WHEN** manual Secret acceptance runs for that exact revision
- **THEN** the stored environment key produces only scoped read access for the expected App and repository, identity acceptance is reported, and no publication or deployment occurs
#### Scenario: Wrong revision or enabled production
- **GIVEN** the supplied revision differs, a release flag is enabled, or a non-approved branch invokes acceptance
- **WHEN** acceptance is requested
- **THEN** it stops before accessing the environment key and no publication job runs
#### Scenario: Wrong identity or invalid Secret
- **GIVEN** the environment key is invalid, App installation differs, or the token can write or access another repository
- **WHEN** acceptance checks it
- **THEN** it fails without revealing credentials and production remains disabled

### Requirement: Reproducible isolated rehearsal
The rehearsal SHALL remain independent of current manuscript publication status, preserve source bodies and reading order, and use disposable local artifacts only.
#### Scenario: A source chapter is already published
- **GIVEN** the source series contains a published chapter
- **WHEN** the local release rehearsal runs
- **THEN** it exercises the fixed unpublished baseline and one new verified article in its disposable copy, without changing source files or contacting Telegram

### Requirement: D1 sole release authority
D1 SHALL be the only operational release queue. Git SHALL retain article/manifest authority. Legacy Git-journal publication paths SHALL fail closed regardless of legacy activation flags, and existing journal evidence SHALL require explicit reconciliation rather than automatic replay or deletion. All production publication and real notifications SHALL remain disabled during consolidation.
#### Scenario: Retired writer and legacy evidence
- **GIVEN** the legacy write flag is enabled or an old journal exists
- **WHEN** an old release command or new D1 delivery is requested
- **THEN** the old command makes no writes or network requests and an existing journal blocks new delivery for explicit reconciliation without deleting history
#### Scenario: Continuous readiness and membership
- **GIVEN** articles return from draft to ready between checks, or an unstarted complete series changes membership
- **WHEN** D1 ingests the current Git revision
- **THEN** renewed eligibility receives its new FIFO position, while body-only edits retain position and manifest reading order stays authoritative
#### Scenario: Latest due window and late readiness
- **GIVEN** D1 first observed eligible content before a release window and several windows were missed
- **WHEN** recovery runs after the latest Monday or Thursday 07:00
- **THEN** at most one article eligible at that latest window receives it, no older windows are backfilled, and articles arriving later wait for the next window
#### Scenario: Started series reconciliation
- **GIVEN** multiple series were manually started without a stored active choice, or the active series is deleted or inconsistent
- **WHEN** D1 considers another release
- **THEN** acquisition stops visibly for reconciliation without silently selecting another series or changing reading order
#### Scenario: Public source and pending identity
- **GIVEN** a release has a retained publication identity and its public page is stale or its pending Git source was changed
- **WHEN** public confirmation runs
- **THEN** the release stays unconfirmed and no second publication occurs; only matching source revision, canonical page, publication metadata and RSS can confirm it
#### Scenario: D1 static rehearsal
- **GIVEN** a disposable D1-compatible database, content copy and loopback site
- **WHEN** build failure recovery and RSS notification rehearsal run
- **THEN** the same release identity survives, six bodies and order remain unchanged, one verified new article is observed once across restart, and production receives no writes or messages

### Requirement: Owner-confirmed immediate publication
An authenticated owner MAY preview and explicitly confirm an immediate publication after separate publication authorization. The operation SHALL use the same D1 release identities, unchanged current-main body, atomic article/manifest update and public verification as scheduled publication. It SHALL record the actual manual time and distinguish manual intent without backdating readiness or treating it as a missed scheduled window.
#### Scenario: Preview then confirmed first chapter
- **GIVEN** a complete ready series and no conflicting release or retained date commitment
- **WHEN** the owner previews its next unread chapter and confirms that same source and queue version
- **THEN** preview makes no writes and confirmation records one manual identity at the actual time, preserving body and reading order for subsequent scheduled chapters
#### Scenario: Wrong chapter or incomplete eligibility
- **GIVEN** an earlier chapter is not yet public, the series is incomplete or held, or a release remains unconfirmed
- **WHEN** immediate publication is requested
- **THEN** it stops without a Git write, new identity or change to existing commitments
#### Scenario: Stale source or owner denial
- **GIVEN** confirmation was denied, the source or queue changed, or owner security checks fail
- **WHEN** immediate publication is submitted
- **THEN** it makes no publication write and reports the conflict without overwriting current content
#### Scenario: Lost response and retained manual identity
- **GIVEN** a confirmed manual intent already has a release identity
- **WHEN** the same intent is requested again or its delivery result is unknown
- **THEN** it reports the retained identity without creating or sending another publication; public confirmation still requires matching source, page and RSS

### Requirement: Safe release failure diagnostics
Authenticated operators SHALL receive stable release failure categories and provider/runtime diagnostics SHALL exclude credentials, article bodies and raw provider messages.
#### Scenario: Provider history is rejected
- **GIVEN** history cannot be safely resolved
- **WHEN** the queue read stops
- **THEN** the operator can distinguish history rejection from ordinary eligibility while no credential or raw private response is disclosed and no publication is performed

### Requirement: Verified release attention
The CMS SHALL distinguish completed public releases from unresolved candidate date commitments. Suppressing a completed article's old-date prompt SHALL preserve its actual publication time, release evidence, next chapter estimate and existing operational records.
#### Scenario: Verified public chapter is not a legacy candidate
- **GIVEN** a chapter is marked published and its retained release has been publicly verified
- **WHEN** the owner views its queue and Needs attention tab
- **THEN** it is absent from the old-date attention list, its verified timeline remains available, and the next chapter retains its original estimate without a new publication or record change
#### Scenario: Real legacy date still needs adoption
- **GIVEN** a ready article retains a legacy date without adoption or an override
- **WHEN** the owner views Needs attention
- **THEN** the old-date prompt remains visible and the article is not silently scheduled
#### Scenario: Incomplete verification remains visible
- **GIVEN** a published article has an awaiting, unknown, failed or unlocked release, or the article is ready again
- **WHEN** the owner reviews the queue
- **THEN** the repair does not hide its unresolved date warning or clear existing failure evidence
