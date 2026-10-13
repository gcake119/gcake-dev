## Purpose

Observe every local series and standalone publication through one hourly Hermes job. Provide silent normal operation and durable, bounded notifications for new public articles, confirmed overdue publications and established anomaly recovery.

## ADDED Requirements

### Requirement: Universal discovery and silent baseline
One monitor SHALL automatically observe every local series and standalone article through complete editorial observations and the site RSS feed. It SHALL keep historical articles silent during first initialization, preserve existing sent and uncertain outcomes during transition, and commit a new baseline only after complete successful observation. An article discovered after initialization SHALL NOT be silently reclassified as baseline history merely because its series is new.

#### Scenario: New series and standalone after initialization
- **GIVEN** a completed baseline
- **WHEN** a new series and standalone article are added and later publicly verified
- **THEN** both are observed and eligible for one article notification without additional jobs or per-article settings

#### Scenario: Initial history and preserved notifications
- **GIVEN** existing public articles and pre-existing successful or uncertain notification outcomes
- **WHEN** monitoring initializes or transitions to the new version
- **THEN** historical articles produce no burst and existing outcomes are preserved

#### Scenario: Partial baseline
- **GIVEN** RSS or required historical page observations are incomplete
- **WHEN** initialization runs
- **THEN** no partial baseline is finalized and no historical notification burst occurs on retry

### Requirement: Hourly quiet operation and verified article notification
Checks SHALL occur once per 60-minute scheduled round. Within-round retries SHALL count as one observation round. Normal checks SHALL send no message. A new article SHALL be notified in the first round that verifies matching RSS identity and canonical article page metadata. Mere HTTP success, editorial published status or deployment success SHALL NOT prove public identity. Updates of the same canonical article SHALL NOT create another publication notification.

#### Scenario: Normal hourly check
- **GIVEN** healthy sources and no new publication, overdue event or established anomaly recovery
- **WHEN** an hourly check completes
- **THEN** no Telegram message is sent

#### Scenario: New public article and later update
- **GIVEN** an unnotified article with matching RSS identity and canonical page metadata
- **WHEN** the check completes and a later check observes updated content at the same canonical identity
- **THEN** one article notification contains its title, canonical link and Taipei publication time and the update produces no duplicate

#### Scenario: Wrong page or future article
- **GIVEN** an RSS entry pointing to a homepage, another article or a publication timestamp still in the future
- **WHEN** the page is fetched successfully
- **THEN** no article notification is sent and the evidence mismatch is recorded

### Requirement: Confirmed overdue publication after grace
The monitor SHALL send one overdue notification per active commitment episode when a successful current-round schedule observation confirms an active commitment, current time is at least 60 minutes after its formal timestamp, and successful current-round public observations confirm that its canonical article is absent. It SHALL NOT require two additional abnormal rounds. Missing authority, fetch errors and estimated schedules SHALL produce unknown classification rather than publication failure. A verified page with delayed RSS SHALL be treated as evidence inconsistency, not absence. The message SHALL include article identity, formal time and check time in Taipei time.

#### Scenario: Grace boundary
- **GIVEN** a confirmed publication at 2026-10-15 07:00 Taipei and readable public sources confirming absence
- **WHEN** checks occur at 07:59:59 and 08:00:00 Taipei
- **THEN** the first check sends no overdue notification and the second sends one

#### Scenario: Unaligned check and repeated overdue state
- **GIVEN** the same confirmed publication and checks at 07:40, 08:40 and 09:40 Taipei confirming absence
- **WHEN** these rounds complete
- **THEN** only the 08:40 round sends the overdue notification

#### Scenario: Unavailable source or estimate
- **GIVEN** a failed current schedule or public fetch, or only an estimated publication time
- **WHEN** a prior or estimated time passes its grace
- **THEN** overdue status remains unknown and no overdue notification is sent

#### Scenario: Page visible before RSS
- **GIVEN** the canonical article page is verified but RSS has not included it
- **WHEN** its confirmed time passes the grace
- **THEN** no overdue-unpublished notification is sent and public evidence inconsistency is recorded

### Requirement: Consecutive anomaly and recovery rounds
Each independent monitored source or article evidence check SHALL establish an anomaly after two consecutive abnormal scheduled rounds. Established anomalies SHALL be recorded without onset notifications. Recovery SHALL require two consecutive healthy scheduled rounds for that same item and send one recovery notification per anomaly episode. A healthy round SHALL reset pending abnormal streaks; an abnormal round SHALL reset recovery streaks. Skipped rounds and within-round retries SHALL NOT supply successful or abnormal observations or establish consecutive evidence across a missed scheduled round.

#### Scenario: Transient failure
- **GIVEN** one failed round followed by one healthy round
- **WHEN** the second round completes
- **THEN** the transient failure is recorded and no recovery notification is sent

#### Scenario: Sustained failure and recovery
- **GIVEN** RSS fails at 09:00 and 10:00 and is healthy at 11:00 and 12:00
- **WHEN** each round completes
- **THEN** the 10:00 round establishes a silent anomaly and only the 12:00 round sends its recovery notification

#### Scenario: Flapping source
- **GIVEN** an established anomaly followed by healthy, abnormal, healthy and healthy rounds
- **WHEN** the rounds complete
- **THEN** only the final round confirms recovery and sends one recovery notification

#### Scenario: Retry and independent source isolation
- **GIVEN** RSS fails three retries in one round and the schedule source fails in the next round while RSS is healthy
- **WHEN** the second round completes
- **THEN** neither source has two consecutive abnormal rounds and no established anomaly is inferred by combining sources

#### Scenario: Missed scheduled round
- **GIVEN** an established anomaly and one healthy round followed by a missed scheduled round
- **WHEN** monitoring next observes one healthy round
- **THEN** it retains the anomaly but requires another consecutive healthy round before recovery notification

#### Scenario: Interval phase drift
- **GIVEN** a sixty-minute interval job with consecutive checks separated by sixty minutes plus dispatch or completion delay
- **WHEN** two abnormal checks are followed by two healthy checks without a missing hourly check
- **THEN** the final healthy check sends one recovery notification despite the changing clock phase

### Requirement: Explicit scheduler context
The scheduler SHALL provide the script with the owning job identity, execution identity and original scheduled time for its invocation. Scheduled time SHALL retain its meaning during delayed execution and retries. The monitor SHALL reject missing, malformed, future or conflicting context before observing sources or modifying state. Manual invocations without an original scheduled time SHALL NOT invent one. Different execution identities for the same scheduled occurrence SHALL count as one round. Context from another job SHALL NOT extend existing observation streaks.

#### Scenario: Delayed script launch
- **GIVEN** a check originally scheduled at 07:00 Taipei that starts at 07:03
- **WHEN** the scheduler launches the monitoring script
- **THEN** the script receives the owning job and execution identities and the original 07:00 time

#### Scenario: Missing or conflicting context
- **GIVEN** missing original schedule context or conflicting invocation times
- **WHEN** the monitoring script starts
- **THEN** it fails before source reads, state changes or notifications instead of substituting the current time

#### Scenario: Retry and job isolation
- **GIVEN** a completed observation round
- **WHEN** another execution retries the same scheduled occurrence or a different job uses the same state
- **THEN** the retry supplies no extra streak evidence and the different job is rejected without modifying that state

#### Scenario: Isolated gateway dispatch
- **GIVEN** a complete isolated Hermes gateway with no messaging platforms and a test job
- **WHEN** its scheduler dispatches a delayed invocation
- **THEN** the monitoring script receives exactly the job and execution identities and original time recorded for that invocation, without connecting to production Telegram

#### Scenario: Gateway test teardown
- **GIVEN** an isolated gateway verification that succeeds, fails, times out or is interrupted
- **WHEN** verification ends
- **THEN** its evidence is saved and its owned gateway, child processes and disposable state are removed while existing jobs and services remain unchanged

### Requirement: Wrapper cutover and rollback compatibility
The candidate wrapper SHALL load the existing private notification configuration and the dedicated summary configuration without replacing scheduler metadata. It SHALL run the monitor through the selected isolated Python interpreter and trusted library location. Dry-run SHALL preserve the source database and make no delivery request. Cutover and rollback SHALL use the same existing notification history without resetting initialization. Historical sent, uncertain and baseline records SHALL remain suppressed, including newly confirmed or uncertain deliveries created before rollback.

#### Scenario: Isolated wrapper launch
- **GIVEN** valid scheduler context and private fixture configuration
- **WHEN** the actual shell wrapper launches the monitor in Python isolated mode
- **THEN** the monitor imports its dependencies, uses that invocation context and completes without exposing private configuration

#### Scenario: Configuration replaces invocation context
- **GIVEN** a private configuration that overwrites scheduler metadata or a wrapper invoked by another job
- **WHEN** the wrapper starts
- **THEN** it fails before observation, state mutation or delivery

#### Scenario: Live cutover and rollback
- **GIVEN** preserved sent, uncertain and baseline records and a completed initialization
- **WHEN** the new wrapper runs, its transport confirms one new delivery and loses another response, then the old wrapper is restored
- **THEN** both versions suppress the historical records, the old version does not resend either new outcome and initialization is preserved

### Requirement: Combined late publication and truthful recovery
An overdue article that later satisfies public verification SHALL produce one article notification stating that the overdue condition has cleared, without waiting for two healthy rounds or producing another recovery notification for that article's cleared condition. Independent source anomalies SHALL retain their own recovery rules. Recovery text SHALL report observed checks rather than claiming uninterrupted health between them. Cancellation SHALL NOT produce a publication-recovery message.

#### Scenario: Late article appears
- **GIVEN** a sent overdue notification for an unpublished article
- **WHEN** its canonical page and RSS are subsequently verified
- **THEN** one article notification includes overdue recovery and no additional recovery notification for the same cleared condition is sent

#### Scenario: Cancellation instead of publication
- **GIVEN** an overdue commitment that is explicitly cancelled
- **WHEN** the latest formal observation is read
- **THEN** the old overdue episode closes silently without claiming the article was published

### Requirement: Restart-safe notification uncertainty and exclusive execution
The monitor SHALL persist event identity and send intent before requesting Telegram delivery, retain confirmed sends and uncertain outcomes across restart, and prevent overlapping instances from sending the same event. A definite pre-delivery failure SHALL remain retryable; ambiguous delivery SHALL remain pending human reconciliation without automatic resend. Successful Telegram API acknowledgement SHALL be recorded separately from human receipt confirmation. Dry runs SHALL use isolated state and send no real Telegram message.

#### Scenario: Restart or overlapping checks
- **GIVEN** a successful notification and two overlapping monitor invocations
- **WHEN** checks run and the monitor restarts
- **THEN** the same event is not sent again and only one invocation performs event delivery

#### Scenario: Lost send response
- **GIVEN** a persisted send intent and a lost Telegram response
- **WHEN** a later check or restart runs
- **THEN** the event remains uncertain and is not automatically resent or reported as confirmed delivery

#### Scenario: Definite failure and human evidence
- **GIVEN** a notification definitely rejected before delivery
- **WHEN** a later scheduled attempt is acknowledged by Telegram
- **THEN** system send success is recorded while human receipt remains unconfirmed

#### Scenario: Dry-run isolation
- **GIVEN** live notification history and a dry-run invocation
- **WHEN** simulated events are evaluated
- **THEN** live history remains unchanged and no real Telegram delivery occurs
