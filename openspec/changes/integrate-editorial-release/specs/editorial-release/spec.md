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
