## Purpose

Provide protected, read-only indexing observations independently of Cloudflare management API credentials. Preserve the distinction between reported synchronization progress, independent provider verification, and search acceptance.

## ADDED Requirements

### Requirement: Independently authorized read-only observation

The service SHALL expose a dedicated read-only observation interface with an independent, expiring monitor credential. Missing, invalid, expired or write-trigger-equivalent monitor credentials MUST prevent observation before accessing protected data. Monitor credentials MUST NOT authorize synchronization or management operations.

#### Scenario: Authorized observation
- **GIVEN** an operator holds a valid monitor credential and the index is processing a batch
- **WHEN** the operator requests status
- **THEN** the operator receives a versioned progress snapshot without triggering indexing, inference, vector operations, quota creation or application data changes

#### Scenario: Missing or invalid authorization
- **GIVEN** authorization is missing, incorrect, overlong, expired or not configured
- **WHEN** status is requested
- **THEN** the service returns an empty 404 response without reading protected state

#### Scenario: Write authority remains isolated
- **GIVEN** valid but distinct monitor and synchronization credentials
- **WHEN** either credential is used for the other operation
- **THEN** access is refused and no synchronization or status data access occurs through the refused operation

### Requirement: Minimal coherent and bounded status

Each successful response SHALL represent one coherent observed state, identify its schema and deployed service version, and return only allowlisted progress, version alignment, waiting, evidence-expiry and receipt summaries. Responses SHALL prohibit caching and SHALL NOT include credentials, reader queries, IP addresses, vector values, pending payloads, free-form errors or raw policy. The service SHALL reject unsupported operations and invalid parameters without data access.

#### Scenario: Observation during natural continuation
- **GIVEN** a natural batch changes progress while status is requested
- **WHEN** the response is generated
- **THEN** every reported progress, pending and receipt field belongs to one coherent snapshot and active work is distinguishable from completed work

#### Scenario: Invalid pagination parameters
- **GIVEN** a request contains duplicate, unknown, negative, fractional or unsafe-integer parameters, or a page size outside 1 through 50
- **WHEN** status is requested
- **THEN** the service returns 400 without reading protected state

#### Scenario: Protected content is present in stored records
- **GIVEN** underlying records include a secret, an identifying value, a pending payload or a free-form diagnostic
- **WHEN** an authorized status request succeeds
- **THEN** none of those values appears in the response or monitoring evidence and the response disables caching

### Requirement: Observation failures remain explicit and non-mutating

Read failures, missing state and unsupported service schema SHALL produce explicit unavailability rather than fabricated progress. Monitoring SHALL NOT call Cloudflare management APIs, refresh credentials, replay indexing or retry automatically after an observation failure.

#### Scenario: State read fails
- **GIVEN** protected state cannot be read or the five-second operation budget expires
- **WHEN** an authorized status request is processed
- **THEN** the service returns 503 with a fixed safe failure reason and performs no repair or quota mutation

#### Scenario: Client receives invalid or unavailable status
- **GIVEN** the client has a previously validated checkpoint
- **WHEN** a request times out, redirects, returns a non-success status or returns malformed or incompatible data
- **THEN** the failed outcome is preserved, the checkpoint remains unchanged, and no management API fallback, credential expansion or automatic retry occurs

### Requirement: Incremental retained receipt continuity

Receipt pages SHALL be bounded, ordered and associated with an observed upper receipt identifier. Monitoring SHALL preserve its last validated global receipt cursor across public source changes and SHALL distinguish initial baseline, retention gaps and identifier resets from a complete receipt chain. A page checkpoint SHALL advance only after successful validation and durable evidence storage.

#### Scenario: Multiple pages of retained receipts
- **GIVEN** more retained receipts exist than fit in one page
- **WHEN** the client reads consecutive pages
- **THEN** it preserves ordered non-duplicated receipt evidence up to each observed upper bound and reports backlog until all required pages are validated

#### Scenario: Retention has removed required history
- **GIVEN** the saved cursor precedes the oldest available receipt by more than one identifier
- **WHEN** monitoring resumes
- **THEN** it reports a history gap and does not claim a complete chain or silently reset the checkpoint

#### Scenario: History reset or interrupted checkpoint storage
- **GIVEN** the saved cursor exceeds available history or checkpoint storage is interrupted
- **WHEN** the client resumes
- **THEN** it preserves the last valid checkpoint, reports the discontinuity or storage failure and does not certify completion

### Requirement: Public source alignment and honest progress

The monitor SHALL verify the current public manifest and source asset digests before establishing a passage total. It SHALL preserve reported progress separately from verified source membership and independent provider evidence. A changed public source SHALL invalidate completion assessment for the previous source without resetting receipt history.

#### Scenario: Verified source total
- **GIVEN** the current public source assets match their published digests
- **WHEN** reported progress is compared with that source
- **THEN** the monitor reports that source's passage total alongside reported progress without claiming current provider membership from a count alone

#### Scenario: Source unavailable or changed during observation
- **GIVEN** source assets cannot be verified or the public manifest changes during the observation
- **WHEN** progress is assessed
- **THEN** the total is unknown or the observation is source_changed, no completion percentage or completion certification is fabricated, and previous evidence is preserved

### Requirement: Waiting and blocking states remain distinguishable

Monitoring SHALL distinguish active work, scheduled waiting, disabled processing, expired evidence, unresolved inference and stale observation. A future persisted resumption time SHALL prevent a healthy wait from being classified as stalled. Monitor credential expiry SHALL stop observation without changing indexing configuration or extending any operational evidence.

#### Scenario: Quota or provider wait
- **GIVEN** the index has a future resumption time and no unresolved inference or expired operational evidence
- **WHEN** no new receipt arrives during that wait
- **THEN** monitoring reports waiting until the recorded time without claiming the Cron has stopped or replenishing quota

#### Scenario: Expired operational evidence or unresolved inference
- **GIVEN** unfinished indexing has expired capacity evidence, expired billing eligibility or unresolved inference without an active execution
- **WHEN** status is assessed
- **THEN** monitoring identifies the blocking condition without extending evidence, retrying inference or clearing pending work

#### Scenario: Observation stops progressing without an explained wait
- **GIVEN** there is no active execution or future resumption time and no receipt has advanced for fifteen minutes
- **WHEN** monitoring assesses freshness
- **THEN** it reports stale evidence requiring investigation rather than asserting that the cloud schedule is stopped

### Requirement: Completion candidate does not replace acceptance

The monitor SHALL label completion only as a candidate after current public, target and active versions align, the expected model namespace is active, reported completed passages equal the verified public total, pending work is empty, no execution is active, and two natural unchanged receipts for that source are at least sixty seconds apart. Independent full provider verification, real search API and browser checks, and human relevance acceptance SHALL remain separate evidence categories.

#### Scenario: Runtime reports full progress before activation
- **GIVEN** reported progress reaches the public passage total but pending work remains or the active version differs
- **WHEN** the monitor assesses completion
- **THEN** it does not report a completion candidate

#### Scenario: Stable completion candidate
- **GIVEN** all version, namespace, passage, pending and execution conditions hold
- **WHEN** the second natural unchanged receipt for the same public source is at least sixty seconds after the first and no history gap exists
- **THEN** the monitor reports a completion candidate and explicitly reports provider audit and search acceptance as separate pending evidence

#### Scenario: Independent provider audit is inaccessible
- **GIVEN** status reports a completion candidate but independent provider access is refused
- **WHEN** final acceptance is assessed
- **THEN** candidate progress remains recorded, provider verification is blocked, and neither complete provider verification nor healthy semantic search is certified

### Requirement: Bounded monitoring and safe credential lifecycle

The client SHALL obtain its monitor credential from protected local credential storage, send it only to the pinned HTTPS service origin, and exclude it from arguments, evidence and logs. Each scheduled observation SHALL have a thirty-second overall budget, at most ten additional receipt pages and no automatic retries. Existing fifteen-minute monitoring cadence SHALL be reused only after separately authorized production activation; no new indexing scheduler SHALL be installed.

#### Scenario: Healthy routine observation
- **GIVEN** the same source is progressing and no operator action is required
- **WHEN** the existing monitoring interval runs
- **THEN** safe local evidence is appended within the request budget and no routine user notification or indexing action is generated

#### Scenario: Credential unavailable or rotated
- **GIVEN** local protected storage is inaccessible or the service credential has been rotated
- **WHEN** monitoring runs
- **THEN** it preserves an explicit authorization-unavailable outcome without printing the credential, using a write credential, recreating credentials or changing the cloud schedule

#### Scenario: Receipt backlog exceeds one observation budget
- **GIVEN** more receipts remain after ten additional pages
- **WHEN** the observation budget ends
- **THEN** the client preserves the last validated cursor, reports backlog and continues in a later authorized observation without claiming complete continuity prematurely


### Requirement: Owner restricted admin observation

The existing publishing admin SHALL expose indexing status only to an authenticated, unexpired owner session. Its server SHALL retrieve an allowlisted snapshot from the pinned search service using the monitor credential without exposing that credential to the browser or accepting arbitrary upstream destinations. Reading admin status SHALL NOT start publishing, synchronization, inference, quota mutation or pending-work repair.

#### Scenario: Owner views status
- **GIVEN** the owner is logged in and the status service is available
- **WHEN** the owner opens publishing management
- **THEN** a search indexing panel displays the latest safe progress, pending count, waiting or blocking reason, observation time and evidence expiry without issuing a write operation

#### Scenario: Unauthorized admin access
- **GIVEN** a requester is not logged in, has an expired session or is not the authorized owner
- **WHEN** it requests indexing status
- **THEN** the admin server refuses access before contacting the search service and the browser does not retain a protected status panel after authorization is lost

#### Scenario: Missing server configuration or upstream failure
- **GIVEN** the server lacks its monitor credential or the pinned status service fails
- **WHEN** an authorized owner requests status
- **THEN** the owner receives a safe unavailable result without a leaked credential, alternate management API request or automatic repair

### Requirement: Honest and bounded admin progress display

The admin panel SHALL show progress against a digest-verified current public passage total, or explicitly show an unknown total. It SHALL distinguish last successful observation from current availability and completion candidates from verified semantic search. Automatic refresh SHALL run at most every five minutes only while the panel is visible; manual refresh SHALL have a ten-second minimum interval and one in-flight request. The panel SHALL remain usable on a 320-pixel viewport, by keyboard and in both existing themes.

#### Scenario: Public total is unavailable
- **GIVEN** reported progress is available but the public source total cannot be verified or belongs to a different version
- **WHEN** the owner views the panel
- **THEN** the panel shows reported passages with an unknown total or version-alignment notice and does not fabricate a percentage

#### Scenario: Refresh fails after a successful observation
- **GIVEN** a previous observation is displayed
- **WHEN** a new read fails
- **THEN** the panel marks the data as last-known, shows its actual successful observation time and says that it cannot currently update

#### Scenario: Panel becomes hidden or session ends
- **GIVEN** automatic refresh is active
- **WHEN** the owner leaves the panel, hides the page or logs out
- **THEN** automatic requests stop, pending requests are cancelled and an older response cannot overwrite a later state

#### Scenario: Completion without current search acceptance evidence
- **GIVEN** synchronization meets the completion-candidate conditions but the admin has no verifiable acceptance record bound to the current source and service version
- **WHEN** the owner views the panel
- **THEN** it shows a synchronization completion candidate and explicitly states that semantic search has no current-round acceptance result


### Requirement: Accessible graphical progress without fabricated completion

The admin SHALL present quantitative indexing progress as a labeled graphical progress bar with visible passage counts and percentage only for a verified, aligned, positive public total and a valid completed count within that total. It SHALL distinguish unknown, empty, inconsistent, waiting and last-known observations. The graphical view SHALL follow the existing admin design system and SHALL NOT equate a full bar with semantic search acceptance.

#### Scenario: Known progress remains below completion until all passages are counted
- **GIVEN** a fresh aligned source has 2995 passages and 304 have recorded verification
- **WHEN** the owner views indexing progress
- **THEN** a labeled progress bar exposes 304 of 2995 and visible text reports 10.1 percent
- **AND** 2994 of 2995 remains 99.9 percent rather than rounding to 100 percent

#### Scenario: Unknown or empty total
- **GIVEN** the total is unverified or the verified public set is empty
- **WHEN** the owner views progress
- **THEN** the graphical view explicitly reports unknown quantity or an empty public set without inventing a percentage or announcing successful search acceptance

#### Scenario: Invalid progress is not clamped to success
- **GIVEN** the completed count is negative, non-finite or greater than the verified total
- **WHEN** the owner views progress
- **THEN** the panel reports inconsistent status without presenting a quantitative success bar

#### Scenario: Full bar still awaiting final confirmation
- **GIVEN** the recorded passage count equals the public total but pending work or required completion evidence remains
- **WHEN** the owner views progress
- **THEN** the bar reports the recorded quantity while the state explicitly says that complete confirmation is pending and does not claim healthy semantic search

#### Scenario: Last-known graphical progress after read failure
- **GIVEN** valid progress from the same public version was displayed before the latest read failed
- **WHEN** the panel retains that view
- **THEN** it labels the bar as last-known progress with the actual prior observation time and a current update failure notice
- **AND** a newly confirmed public version invalidates the previous version's percentage

#### Scenario: Accessible progress across input and motion preferences
- **GIVEN** the owner uses a screen reader, keyboard, narrow viewport or reduced-motion preference
- **WHEN** progress updates or enters an unknown state
- **THEN** progress has an accessible name and honest known or unknown value, status remains understandable without color, focus stays in place and no continuous progress animation runs
