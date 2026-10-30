## Purpose
Provide independent cloud observation and safe owner notifications without changing indexing authority.

## ADDED Requirements
### Requirement: Independent bounded cloud observation
The existing Admin backend SHALL observe the fixed read-only search endpoint every fifteen minutes when enabled and configured, independently of browser and local computer activity. It SHALL preserve the original index schedule, model, quotas and expiry policy. Each round SHALL have a thirty-second network deadline, five-second status reads, at most eleven pages of fifty receipts, no automatic request retry and no semantic or management API calls.
#### Scenario: Healthy off-page observation
- **GIVEN** a qualified seed, valid configuration and no open admin page
- **WHEN** a scheduled observation runs
- **THEN** it advances a contiguous checkpoint, records its observation time and performs no indexing or inference.
#### Scenario: Invalid or disabled configuration
- **GIVEN** observation is disabled or required credentials or seed are invalid
- **WHEN** the background handler is invoked
- **THEN** it performs no external request or send and does not claim healthy monitoring.
#### Scenario: Concurrent invocation
- **GIVEN** another round holds an unexpired observation lease
- **WHEN** a second invocation starts
- **THEN** only the owning round SHALL advance the checkpoint or attempt delivery.
### Requirement: Evidence-preserving classifications
Observation SHALL validate the pinned search runtime, complete receipt continuity and verified public source membership before evaluating completion. Ordinary progress, legitimate source changes, valid waiting and the accepted baseline SHALL stay quiet. Completion SHALL remain a candidate, distinct from provider audit, search functionality and human relevance.
#### Scenario: New completed corpus
- **GIVEN** a new public corpus is aligned with the active index, no pending work or lease exists, and two natural no-change receipts are at least sixty seconds apart
- **WHEN** complete observation reaches the receipt high-water mark
- **THEN** one completion-candidate event is recorded without claiming search or human acceptance.
#### Scenario: Accepted baseline and bounded backlog
- **GIVEN** the corpus is already accepted or a round has not reached the receipt high-water mark
- **WHEN** it is observed
- **THEN** it produces no new completion notification and preserves its qualified checkpoint for the next round.
#### Scenario: Source transition and provider waiting
- **GIVEN** public content is changing or a qualified future retry time explains waiting
- **WHEN** observation evaluates the status
- **THEN** it reports waiting or source alignment without inventing a failure.
### Requirement: Actionable stops and expiry
A stale observation without a valid wait or lease, explicit block, read failure, runtime change, history gap or unknown inference SHALL create one actionable incident and pause cloud observation. Reaching the configured capacity, billing or monitoring-credential expiry SHALL alert and pause before further observation; evidence SHALL NOT be renewed automatically.
#### Scenario: Unavailable or untrusted observation
- **GIVEN** a status request fails, runtime changes or receipt continuity breaks
- **WHEN** the observer cannot validate the round
- **THEN** it preserves the last qualified checkpoint, records a safe incident and stops dependent requests without retry.
#### Scenario: Expiry boundary
- **GIVEN** a required evidence expiry equals the current time
- **WHEN** a scheduled invocation runs
- **THEN** it makes zero status or source requests, records the expiry and pauses without renewal.
### Requirement: Durable Telegram intent and deduplication
Alerts SHALL target only the verified owner Telegram destination. Intent SHALL be durably recorded before sending, and a unique runtime/corpus/reason identity SHALL suppress duplicate sends across overlapping invocations, repeated observations and restarts. Delivery states SHALL distinguish sent, rejected, unknown and not-configured. A successful provider acknowledgement is not proof of owner reading.
#### Scenario: Acknowledged alert
- **GIVEN** a new actionable incident and verified Telegram configuration
- **WHEN** Telegram acknowledges the expected chat and message identifier
- **THEN** the history records sent and subsequent observations send no duplicate for that incident.
#### Scenario: Unknown delivery and crash recovery
- **GIVEN** delivery times out, acknowledgement is invalid, or a previous send intent has no final receipt after its lease expires
- **WHEN** the observer resumes
- **THEN** it records unknown delivery, pauses and never automatically resends the uncertain intent.
#### Scenario: Rejected or missing delivery configuration
- **GIVEN** Telegram rejects a send or qualified notification credentials are absent
- **WHEN** an alert is prepared
- **THEN** history distinguishes rejected or not-configured, exposes no secrets and requires operator intervention.
### Requirement: Owner-only safe notification history
The backend SHALL expose only safe monitor health and the twenty most recent alert records to a valid owner session. It SHALL reject anonymous, non-owner, expired-session, non-GET and malformed requests before accessing the history. Reads SHALL not trigger observation, Telegram delivery, publication or indexing.
#### Scenario: Authorized history read
- **GIVEN** an owner has a valid session
- **WHEN** the owner reads notification history
- **THEN** the response is no-store, includes observation and delivery times with safe states, and contains no token, chat identifier, raw provider body, query or IP.
#### Scenario: Unauthorized or mutating request
- **GIVEN** a missing, expired or non-owner session, or a non-GET request
- **WHEN** history is requested
- **THEN** access is denied with no history read, observation or delivery.
### Requirement: Honest history in the existing admin
The index area SHALL show background health, last observation and expiry separately from page refresh, and a read-only notification history using existing typography, spacing, controls and both themes. Manual refresh SHALL be bounded, keyboard accessible and disabled while pending. Empty, unavailable and uncertain states SHALL remain explicit; authentication failure SHALL clear protected records.
#### Scenario: History and delivery uncertainty
- **GIVEN** sent, rejected or unknown records exist
- **WHEN** the owner opens the index area
- **THEN** the owner sees readable localized times and distinct delivery labels, without an automatic retry control or implied search-quality approval.
#### Scenario: Narrow layout, error and empty history
- **GIVEN** a 320px viewport, empty history or a failed history read
- **WHEN** the panel is rendered or refreshed
- **THEN** controls remain reachable without horizontal overflow, empty and error messages are distinct, and old data is marked with its original observation time.
### Requirement: Qualified cutover and rollback
The current heartbeat SHALL remain available until a qualified cloud candidate passes real provider delivery, owner browser acceptance and two natural scheduled observations. Production secrets, migration, schedule installation and test delivery SHALL be reviewed against the exact candidate and owner destination before activation. Local tests alone SHALL not authorize reporting production success.
#### Scenario: Cloud cutover
- **GIVEN** exact candidate checks, seed provenance, owner delivery, browser and two scheduled observation receipts pass
- **WHEN** handoff is performed
- **THEN** the existing heartbeat is paused, the cloud journal remains intact and the original index schedule and limits are unchanged.
#### Scenario: Incomplete acceptance or rollback
- **GIVEN** any cutover evidence is missing or cloud monitoring must be disabled
- **WHEN** status is reported or rollback occurs
- **THEN** missing evidence stays explicit, heartbeat is retained or restored within its original expiry, and no uncertain notification is replayed.
