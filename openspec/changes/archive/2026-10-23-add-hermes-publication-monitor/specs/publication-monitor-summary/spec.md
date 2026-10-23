## Purpose

Expose the minimum authoritative publication schedule needed by an external observer. Keep D1 as the sole formal queue and Git as editorial authority without granting the observer publication permissions.

## ADDED Requirements

### Requirement: Complete authoritative observation
The summary SHALL cover all local series and standalone articles from one complete Git revision and one coherent formal queue observation. It SHALL distinguish confirmed commitments from estimates, unscheduled, paused and cancelled entries. Only active confirmed commitments SHALL provide overdue authority. Missing queue entries SHALL remain unconfirmed. Manifest order SHALL remain editorial context, never a computed commitment.

#### Scenario: All article types appear automatically
- **GIVEN** a complete editorial revision containing a new series, an existing series member and a standalone article
- **WHEN** the observer requests the summary
- **THEN** all three appear without per-article monitoring configuration and retain their editorial identity

#### Scenario: Estimate without commitment
- **GIVEN** a ready article with an estimated date but no formal commitment
- **WHEN** that estimate passes
- **THEN** the observation remains unconfirmed and provides no overdue authority

#### Scenario: Incomplete source observation
- **GIVEN** editorial enumeration is truncated or a formal queue observation is unavailable
- **WHEN** the observer requests the summary
- **THEN** the result reports unavailable or incomplete observation rather than a complete empty schedule

### Requirement: Pure read and restricted access
Summary access SHALL perform no queue ingestion, runtime updates, reservation, verification writes, Git changes, deployment or notification. The observer SHALL receive only reading authority for this summary and SHALL NOT require Cloudflare account credentials or the publishing automation credential. Responses and diagnostics SHALL exclude article bodies, provider secrets, leases, attempt details and Telegram destination identifiers.

#### Scenario: Repeated reads leave authorities unchanged
- **GIVEN** editorial and formal queue observations are available
- **WHEN** an authorized observer reads the summary repeatedly
- **THEN** formal queue state and editorial content remain unchanged and no publishing or deployment operation starts

#### Scenario: Missing reading authorization
- **GIVEN** the caller lacks valid summary-reading authorization
- **WHEN** it requests the summary
- **THEN** access is denied without disclosing schedule details or changing publication state

#### Scenario: Minimal disclosure
- **GIVEN** the formal queue contains operational diagnostics and the editorial source contains full article bodies
- **WHEN** the authorized observer receives a summary
- **THEN** only article identity, formal schedule classification, editorial revision and observation metadata required for monitoring are disclosed

### Requirement: Current observation and explicit amendments
Each successful response SHALL identify its generation time and source observations and SHALL disable response caching. The observer SHALL obtain a successful current-round response before using its schedule for overdue classification. A failed read SHALL NOT make the last successful response authoritative for a new overdue notification. A latest confirmed amendment, pause or cancellation SHALL supersede the prior active schedule; omission SHALL NOT imply cancellation.

#### Scenario: Changed or cancelled commitment
- **GIVEN** an article previously had an active confirmed commitment
- **WHEN** the latest complete observation explicitly reschedules, pauses or cancels it
- **THEN** the observer stops overdue classification against the superseded active time without sending a schedule-change notification

#### Scenario: Old response after read failure
- **GIVEN** a previous schedule response exists but the current read fails
- **WHEN** the old schedule crosses its overdue threshold
- **THEN** the observer records an unavailable schedule observation and sends no overdue notification based on the old response

### Requirement: Request-bound authority freshness
The production observer SHALL bind each authenticated summary request to a fresh unpredictable observation identity echoed by that response. A matching current identity SHALL permit at most five seconds of server/client clock difference when validating generation time. A missing or mismatched identity, a replayed response or a larger time difference SHALL remain unavailable authority. This handshake SHALL perform no state write and SHALL NOT change publication grace or consecutive-round criteria. Legacy fixture observations without a request identity SHALL retain their strict request-window time validation.

#### Scenario: Fresh response with small clock difference
- **GIVEN** the authenticated authority clock leads the observer by one second
- **WHEN** the authority echoes that request's unique observation identity with a complete current response
- **THEN** the observer accepts the current schedule observation
- **AND** publication grace and abnormal-round thresholds remain unchanged

#### Scenario: Response is replayed or clock difference exceeds the bound
- **GIVEN** a response with another request's observation identity or generation time more than five seconds outside the request window
- **WHEN** the observer evaluates it
- **THEN** the authority observation is unavailable and no overdue decision is made from that response

#### Scenario: Missing article is not cancellation
- **GIVEN** a previously observed commitment is absent from a current inconsistent observation
- **WHEN** the observer evaluates it
- **THEN** it records unknown status rather than silently cancelling the commitment
