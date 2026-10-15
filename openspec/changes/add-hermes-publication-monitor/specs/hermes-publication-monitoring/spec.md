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

### Requirement: Truthful delivery failure reporting
Live monitoring SHALL finish with a nonzero exit status if delivery is rejected, uncertain or interrupted, including unresolved historical notifications. It SHALL preserve bounded diagnostic types and successful acknowledgement identity without storing exception messages, token-bearing URLs or recipient identities. Successful transport acknowledgement SHALL NOT imply human receipt.

#### Scenario: Send response lost
- **GIVEN** a publicly verified article and a persisted notification intent
- **WHEN** Telegram delivery times out
- **THEN** monitoring exits unsuccessfully and retains uncertainty plus a timeout diagnostic without exposing secrets

#### Scenario: Later check of unresolved notification
- **GIVEN** a prior unresolved notification
- **WHEN** a later healthy observation or repeated occurrence runs
- **THEN** monitoring still reports unsuccessful delivery and performs no automatic resend of the uncertain event

#### Scenario: Rejection and confirmed send
- **GIVEN** Telegram explicitly rejects one notification and acknowledges another
- **WHEN** monitoring finishes
- **THEN** it reports failure for the unresolved event and records the confirmed acknowledgement independently of human receipt

### Requirement: Authorized single-event reconciliation
An explicit owner confirmation of non-receipt SHALL permit one additional send of exactly the authorized original event. Reconciliation SHALL require an existing uncertain article event, an exclusive sender lock, a consistent backup and a durable single-use operation identity committed before sending. It SHALL preserve unrelated events, original message and human receipt evidence. No scheduler observation or automatic retry SHALL be fabricated.

#### Scenario: Owner authorizes a missing notification
- **GIVEN** the owner confirms non-receipt and authorizes one resend of an uncertain article event
- **WHEN** reconciliation obtains exclusive access and Telegram acknowledges the resend
- **THEN** that original event becomes sent, a backup and acknowledgement receipt exist, and human receipt remains unconfirmed

#### Scenario: Repeated reconciliation or lost resend response
- **GIVEN** a consumed reconciliation operation, including one interrupted after intent
- **WHEN** reconciliation runs again with that operation identity
- **THEN** it sends no additional message and retains the recorded outcome or uncertainty

#### Scenario: State drift, lock contention or backup failure
- **GIVEN** the event is no longer uncertain, another sender holds the lock or a backup cannot be saved
- **WHEN** reconciliation starts
- **THEN** it refuses before changing delivery state or sending any message

#### Scenario: Distinguish local rejection from Telegram rejection
- **GIVEN** delivery is disabled, the configured token or recipient is invalid, or Telegram returns an explicit error code
- **WHEN** a delivery attempt is rejected
- **THEN** the journal identifies the local refusal or the numeric Telegram rejection without exposing credentials, destination values or raw response text

#### Scenario: Read-only comparison of owner and scheduled configuration
- **GIVEN** an owner reconciliation failed with an unspecified rejection
- **WHEN** the configuration diagnostic compares the owner environment with the scheduled wrapper configuration
- **THEN** it reports only readiness flags and refusal codes, sends no message and does not change notification state

#### Scenario: Read-only Telegram identity diagnosis
- **GIVEN** configuration format checks passed but the prior rejection lacks a numeric cause
- **WHEN** the owner runs the provider diagnostic
- **THEN** it performs at most one getMe and one getChat request to Telegram, exposes only numeric errors and bounded reason codes, sends no message, never polls updates or writes state, and does not claim successful reads prove message delivery or send permission

### Requirement: Explicit shared Gateway Bot credentials
On explicit owner selection of the Hermes Bot, notifications SHALL resolve the current Telegram token from the existing Gateway credential file for each send, rather than copy it into notification settings. The selected Bot identity SHALL be pinned; token renewal for that Bot SHALL work without another copy, while a different Bot identity SHALL fail closed. Legacy mode SHALL remain compatible. Missing, unsafe, ambiguous or unsupported Gateway configuration SHALL fail without fallback to the retired token. Other Gateway settings SHALL NOT be imported or executed. The original destination and notification switch SHALL remain authoritative.

#### Scenario: Shared source supersedes a retired token
- **GIVEN** the owner selected the Gateway Bot and the notification environment contains a retired token
- **WHEN** a notification is sent
- **THEN** the request uses the current credential of the pinned Gateway Bot and the existing destination

#### Scenario: Gateway token renewal and identity change
- **GIVEN** the shared credential is renewed for the pinned Bot
- **WHEN** a later notification is sent
- **THEN** the new credential is used without copying it into notification settings
- **AND** replacement with another Bot identity refuses delivery

#### Scenario: Unsafe or unavailable credential source
- **GIVEN** the shared source is missing, linked, accessible to other users, has duplicate token assignments or requires unsupported interpolation
- **WHEN** a notification attempts credential resolution
- **THEN** it refuses before a delivery request and does not use the retired token

### Requirement: Owner-authorized continuation after a definite rejection
After the owner explicitly changes the sending Bot, the system SHALL permit at most one authorized continuation linked to the original rejected reconciliation for that event. It SHALL preserve the original operation, its status, backup and attempt records; acquire the existing sender lock; back up current state; and commit a unique continuation intent before sending. Unknown or interrupted preceding delivery SHALL NOT qualify. The continuation SHALL be consumed by success, rejection, ambiguity or interruption and SHALL NOT be automatically repeated. Human receipt remains separate.

#### Scenario: Continue the rejected original operation
- **GIVEN** the named original operation for this event remains recorded and its latest delivery was definitely rejected
- **WHEN** the authorized Hermes Bot continuation is acknowledged
- **THEN** the same article event becomes sent, the new operation links to the unchanged original operation, and both histories and backups remain

#### Scenario: Ambiguous predecessor or repeated continuation
- **GIVEN** a previous delivery outcome is unknown, or a continuation already exists
- **WHEN** another continuation is requested
- **THEN** no message is sent and no existing operation is reset or deleted

### Requirement: Exact owner-side successor delivery
The approved notification repair SHALL be delivered as a complete fixed proposal with an exact manifest digest, existing Telegram SDK capability proof, unchanged Gateway code/runtime, pinned control script and one administrator terminal entry. The entry SHALL verify the baseline, installed controls, payload and native offline proof before creating a root-owned proposal, approving its exact digest and creating the fixed next-candidate record. It SHALL call the existing managed updater for stop, qualification, selector and rollback, without modifying privilege policy or overwriting installed libraries.

#### Scenario: Complete approved successor
- **GIVEN** the selected baseline and an exact verified successor containing only the approved notification changes
- **WHEN** the owner executes the pinned administrator entry
- **THEN** the proposal, approval and next-candidate identify that exact successor and the existing updater performs its controlled qualification before any live activation

#### Scenario: Payload, baseline or pending candidate drift
- **GIVEN** an altered package, changed active baseline, existing foreign successor or pending update recovery
- **WHEN** owner staging begins
- **THEN** it refuses before approving or replacing that successor and leaves Gateway running

#### Scenario: Repeated owner staging
- **GIVEN** this exact proposal is already staged and approved
- **WHEN** the owner repeats staging
- **THEN** it reconciles the same digest rather than creating a different candidate or restarting an already completed update

#### Scenario: Dry qualification and live restoration
- **GIVEN** the existing updater has qualified the candidate in dry-run using a real natural scheduled occurrence
- **WHEN** the operator verifies current Gateway health, shared credential identity, destination and unchanged job
- **THEN** only the existing selected digest changes back to live policy, a durable receipt records it, and no manual job or Telegram send is performed by the owner adoption entry

#### Scenario: Rollback or unknown adoption
- **GIVEN** updater qualification fails or the owner entry is interrupted
- **WHEN** the existing updater reports rollback or recovery state
- **THEN** that state is preserved and reported rather than retrying a restart, claiming live restoration or performing the notification continuation

### Requirement: Durable repository saveback
The repair SHALL retain canonical source, completed acceptance evidence and consumed operational artifacts in the repository without depending on the disposable repair directory for source inputs. Missing source or test evidence SHALL block preparation before output creation. Saveback SHALL preserve unrelated local work and all production backups, and SHALL NOT send notifications or mutate production.

#### Scenario: Relocated source checkout
- **GIVEN** the repaired source and historical evidence are copied to another checkout without the original repair directory
- **WHEN** preparation resolves its required inputs
- **THEN** every input resolves inside that checkout and matches its preserved evidence

#### Scenario: Missing historical input
- **GIVEN** a relocated checkout lacks the consumed continuation or bound test evidence
- **WHEN** preparation begins
- **THEN** it refuses before creating an output package and does not fall back to the temporary repair directory

#### Scenario: Existing local work and completed delivery
- **GIVEN** unrelated uncommitted files and a completed, human-confirmed notification
- **WHEN** verified repair files are saved back and the isolated validation worktree is removed
- **THEN** unrelated contents and production backups remain unchanged and no new notification or delivery operation is created
