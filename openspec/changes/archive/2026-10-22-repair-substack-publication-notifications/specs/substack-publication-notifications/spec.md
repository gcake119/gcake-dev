## Purpose

Verify public publication independently of timing variance and deliver bounded, durable Hermes notifications.

## ADDED Requirements

### Requirement: Independent verified publication notifications
The system SHALL notify the configured Hermes home channel when a scheduled original article is anonymously verified with matching ID, slug, canonical and full authoritative content. The notification SHALL contain exactly three logical lines: the existing verification-complete heading, the article title and its public URL. Confirmed and actual publication times, signed difference, Pages and subscriber evidence SHALL remain separately available in the read-only API and acceptance records. The message SHALL NOT append those details or claim human receipt.

#### Scenario: Verified late publication
- **GIVEN** the same original article is completely verified at 07:01:02.155 for a 07:00 commitment
- **WHEN** an ordinary round produces notifications
- **THEN** the success message contains only the verification-complete heading, article title and public URL, while the read-only record retains the 62.155 second delay and unknown subscriber receipt without re-publishing or re-sending to subscribers

#### Scenario: Unrelated draft failure
- **GIVEN** one article is verified and another draft cannot be read completely
- **WHEN** the notification snapshot is produced
- **THEN** the verified article is eligible for notification and the incomplete article cannot clear its earlier unresolved issue

#### Scenario: Unknown or duplicate acknowledgement
- **GIVEN** a success notification has a durable sent, intent or unknown outcome
- **WHEN** the same publication is observed again or the consumer restarts
- **THEN** that success is not sent again and an unknown outcome is not declared successful

#### Scenario: Invalid public evidence
- **GIVEN** the ID, slug, canonical or full content differs or publication time is absent
- **WHEN** the verifier reads the article
- **THEN** no success notification is emitted and unresolved evidence is preserved

### Requirement: Bounded permission diagnosis
The legacy local-feed consumer SHALL identify the failing feed, ledger, sender or receipt stage and errno without exposing credentials or private content. Repairs SHALL preserve the notification ledger and restrict changes to proven permission defects. Every replacement snapshot SHALL receive explicit read access for the existing Hermes account before becoming visible; inherited access alone SHALL NOT qualify a new snapshot. Failure to establish access SHALL retain the previous snapshot.

#### Scenario: Feed permission denied
- **GIVEN** the actual consumer account cannot read the feed
- **WHEN** consumption fails
- **THEN** a bounded feed-stage PermissionError is reported without sending or resetting the ledger

#### Scenario: Administrator authentication unavailable
- **GIVEN** protected consumer files require administrator authentication
- **WHEN** that authentication is unavailable
- **THEN** a reviewable repair command and incomplete production acceptance are reported without bypassing permissions


#### Scenario: Snapshot replacement preserves consumer access
- **GIVEN** a valid prior notification snapshot and a newly written replacement
- **WHEN** explicit reader access cannot be established before replacement
- **THEN** the prior snapshot remains byte-for-byte unchanged and the new snapshot is not exposed as queued

#### Scenario: Reader access is established before visibility
- **GIVEN** the consumer can read the prior snapshot
- **WHEN** explicit access for the same consumer is successfully established on a replacement
- **THEN** the complete replacement becomes visible atomically with reader access intact

### Requirement: Proven pretransport selection rejection
The consumer SHALL check the selected live Hermes release before creating a delivery intent and again before loading credentials. A proven selection rejection SHALL remain not sent. A historical unknown SHALL NOT be retried unless administrator reconciliation authenticates the exact pretransport consumer, unchanged mismatching selection predating the event, and an original event without an acknowledgement. Reconciliation SHALL preserve the original unknown row and append its proof. Genuine transport uncertainty SHALL never be automatically retried.

#### Scenario: Selected release changed before delivery
- **GIVEN** the notifier references a different release from the ready live selection
- **WHEN** it evaluates a natural notification event
- **THEN** no credentials or transport are loaded and no delivery intent is created

#### Scenario: Authenticated historical pretransport rejection
- **GIVEN** an unknown event and authenticated unchanged code and selection prove rejection before transport
- **WHEN** the administrator repairs only the existing file-event notifier
- **THEN** the original unknown is retained, a not-sent reconciliation is appended, and delivery waits for the next natural snapshot without restarting the publication timer

#### Scenario: Unproven historical unknown
- **GIVEN** a transport timeout or evidence that cannot prove rejection before transport
- **WHEN** reconciliation is requested
- **THEN** no retry is enabled and the original ledger is preserved

#### Scenario: Qualification uses the installed production reader
- **GIVEN** a permission diagnostic and the pinned installed reader disagree on the same unchanged snapshot
- **WHEN** the actual service account is qualified
- **THEN** qualification invokes the installed pinned read-only reader once, retains any earlier failure evidence, and does not call delivery or relax permissions

#### Scenario: Reader pin or snapshot validation fails
- **GIVEN** the installed reader changes or the snapshot violates its production read contract
- **WHEN** qualification runs
- **THEN** the failing stage is retained and no ledger reconciliation, service update or notification is allowed

### Requirement: Shared original-site Hermes notification flow
The system SHALL deliver verified Substack success through the existing original-site Hermes private-message flow, credential source, scheduler identity and private notification ledger. It SHALL use the existing authenticated read-only authority with independently complete Substack evidence and SHALL NOT require a cross-account local feed, dedicated group, new timer or provider mutation for success delivery. The authority SHALL disclose only public identity, revision, title and timing from fresh complete verification.

#### Scenario: Shared private-message delivery
- **GIVEN** the original-site notification flow is active and the original Substack article has fresh complete matching identity and content evidence
- **WHEN** the existing Hermes job runs at its natural scheduled occurrence
- **THEN** it sends one three-line private success message with only the verification heading, article title and public URL, preserving the original ID and slug and keeping detailed times in the read-only record

#### Scenario: Other observations fail independently
- **GIVEN** a Substack publication is completely verified while another draft is inconclusive and the Pages RSS read fails
- **WHEN** the existing notification round evaluates the fresh authority
- **THEN** the Substack success remains eligible and each failed observation retains its separate unresolved state

#### Scenario: Stale or inconsistent Substack authority
- **GIVEN** Substack evidence is older than one hour, over five seconds in the future, changes while enumerated, or lacks matching identity/content markers
- **WHEN** the shared monitor evaluates the response
- **THEN** it emits no success for that evidence, preserves notification history, and retains original-site observation behavior

#### Scenario: Legacy unknown is not delivery authorization
- **GIVEN** a legacy publication has sent, intent or unknown delivery history without authenticated proof of non-delivery
- **WHEN** success delivery migrates to the original-site private-message flow
- **THEN** the original history is retained and the publication cannot be sent again

#### Scenario: Proven legacy non-delivery is migrated
- **GIVEN** unchanged authenticated legacy code and selection prove event 6 failed before credentials and transport with no acknowledgement
- **WHEN** the reviewed migration is installed
- **THEN** the original unknown row is preserved, its non-delivery proof is appended, and only the next naturally verified occurrence is eligible for one success message

#### Scenario: Duplicate occurrence or uncertain acknowledgement
- **GIVEN** the shared flow has a durable sent, intent or unknown publication outcome
- **WHEN** an occurrence repeats, a worker restarts, or the same article is observed in another round
- **THEN** it sends no duplicate and only a positive numeric transport acknowledgement qualifies as sent

#### Scenario: Dry-run and installation preserve operations
- **GIVEN** a candidate shared monitor is being qualified or installed
- **WHEN** local dry-run or installation validation fails
- **THEN** no live message or provider operation occurs, the original cron schedule and notification history remain intact, and failed installation restores the owned controls

#### Scenario: Message format changes after delivery
- **GIVEN** an article already has a confirmed private-message acknowledgement using the earlier longer message
- **WHEN** the three-line format is installed and the article is observed again
- **THEN** no additional message is sent and the original acknowledgement and stored message remain unchanged
