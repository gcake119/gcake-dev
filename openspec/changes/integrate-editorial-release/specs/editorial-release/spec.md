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
