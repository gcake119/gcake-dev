## Purpose

Provide a durable editorial release queue with explicit public evidence and disabled production activation. Preserve Git as editorial authority and D1 as operational authority.

## ADDED Requirements

### Requirement: Complete snapshot ingestion
The queue SHALL ingest all local posts and manifests from one Git revision, preserve first-ready timestamps, withhold incomplete or ambiguous series, classify legacy dates without converting them, and preserve manifest order. A started series SHALL resume ahead of other series; standalone FIFO SHALL take precedence at uncommitted slots.

#### Scenario: Full series and repeated ingestion
- **GIVEN** six finalized posts in manifest order and no production activation
- **WHEN** the snapshot is ingested twice and the next build runs
- **THEN** six ordered estimates exist with unchanged first-ready timestamps and no public articles

#### Scenario: Incomplete or conflicting snapshot
- **GIVEN** a missing file, draft member, ambiguous membership or mismatched status
- **WHEN** ingestion evaluates the series
- **THEN** the entire series is withheld with observable reasons

#### Scenario: Standalone interruption
- **GIVEN** a series has publicly verified its first two posts
- **WHEN** a standalone becomes ready before the next unlocked slot
- **THEN** it receives that slot and the series resumes from its third post before other series

#### Scenario: Legacy publication dates
- **GIVEN** historical published posts, future published posts and ready posts with dates
- **WHEN** ingestion runs
- **THEN** history remains unchanged, future publications reserve their date only when it is a Taipei Monday or Thursday, and ready dates require explicit operator adoption

#### Scenario: Off-calendar legacy publication
- **GIVEN** a published article dated Tuesday or Saturday and two ready standalone articles
- **WHEN** estimates are calculated before the next Monday
- **THEN** the ready articles retain Monday and Thursday estimates and the legacy publication date remains unchanged

#### Scenario: Taipei calendar boundary
- **GIVEN** a published article whose UTC Wednesday timestamp falls on Thursday in Taipei
- **WHEN** estimates are calculated
- **THEN** that Taipei Thursday is reserved without changing the publication timestamp

### Requirement: Unique durable commitments
The queue SHALL allow only one article per Taipei release date and one public release identity per article. Concurrent publishers SHALL use a fenced lease; failed and unknown attempts SHALL retain their identity and reservation. Expired write leases SHALL require verification before another write. Completed and locked slots SHALL NOT be replanned.

#### Scenario: Concurrent and expired publishers
- **GIVEN** two publishers targeting one due slot
- **WHEN** both reserve and an acquired write lease later expires
- **THEN** only one obtains the commitment and recovery verifies the existing release before permitting another write

#### Scenario: Late standalone
- **GIVEN** a consumed or locked slot
- **WHEN** a new standalone arrives
- **THEN** it is estimated at the next unconsumed unlocked slot

### Requirement: Disabled atomic delivery
Production release SHALL require an explicit server gate and authenticated orchestration. Delivery SHALL compare revision and blob identities, update only publication frontmatter and the matching manifest status in one atomic Git commit, preserve bodies/order, and stop on conflicts. Editorial Actions SHALL remain gated and target Monday/Thursday after 07:00 Taipei. Worker and Pages deployment SHALL require explicit manual dispatch on main; merging changes and hourly time passage SHALL NOT deploy or migrate production. Failed builds SHALL NOT consume slots.

#### Scenario: Disabled gate or stale Git revision
- **GIVEN** a disabled gate or concurrent editorial change
- **WHEN** release execution is requested
- **THEN** no publication commit is made and the operator sees the blocking reason

#### Scenario: Atomic publication
- **GIVEN** an enabled simulation with a due ready article
- **WHEN** release executes
- **THEN** the article and matching manifest become published in one commit with unchanged body and order, while the slot awaits public verification

#### Scenario: Merge and hourly passage cannot deploy
- **GIVEN** Worker and Pages deployment require manual authorization
- **WHEN** a pull request is merged or an hour passes
- **THEN** no Worker deployment, production migration or Pages deployment starts automatically

#### Scenario: Manual deployment from another branch
- **GIVEN** deployment workflows are manually dispatched from a branch other than main
- **WHEN** the workflows run
- **THEN** production migration and deployment are skipped

### Requirement: Independent public evidence
Only verified canonical page identity and matching RSS GUID SHALL consume a release slot. Page success without RSS SHALL remain awaiting verification. Unknown write results SHALL be reverified without unconditional publication. Git SHA, deployment run, URL, GUID, timestamps, errors and retry events SHALL be inspectable. Telegram success SHALL NOT advance publication status.

#### Scenario: RSS delay and unknown response
- **GIVEN** a publication write response was lost or the RSS feed is delayed
- **WHEN** reverify runs
- **THEN** the release retains its identity, page/RSS evidence remains distinct, and no duplicate publication occurs

### Requirement: Safe operator workflows
Authenticated owner routes SHALL expose estimates, history, intervention, detail, pause/resume for articles/series, explicit fixed-slot preview/confirm/cancel, reverify, deployment retry and confirmed unlock. Started series order edits SHALL be rejected unless safe conflict confirmation is completed. Editor SHALL offer explicit finalization and readonly estimates; Series SHALL show completeness and next release; errors SHALL be actionable in Traditional Chinese.

#### Scenario: Pause and reservation conflict
- **GIVEN** an authenticated owner and a conflicting fixed date
- **WHEN** the owner previews an override or pauses a series
- **THEN** the conflict and affected estimates are shown, and paused articles cannot be acquired

#### Scenario: Unsafe retries and anonymous changes
- **GIVEN** an unverified release or missing authentication/security token
- **WHEN** publication retry, unlock or queue mutation is requested
- **THEN** unsafe writes are refused with an observable reason

#### Scenario: Owner login returns to the initiating environment
- **GIVEN** the owner opens the production or preview CMS with configured login credentials
- **WHEN** GitHub authentication completes
- **THEN** the owner returns to the same CMS environment and production publication remains disabled

#### Scenario: Missing production login configuration
- **GIVEN** required owner login configuration is missing
- **WHEN** the owner requests login
- **THEN** login fails closed without issuing a CMS session

### Requirement: Restart-safe external monitoring
The Hermes runner SHALL baseline historical RSS silently, verify canonical pages before notification, persist canonical-article deduplication outside Git, use bounded backoff and a single process lock, and retain uncertain sends for manual resolution. CMS SHALL show external monitoring without claiming Telegram delivery until a verified report channel exists.

#### Scenario: Restart and uncertain send
- **GIVEN** a new RSS article and successful canonical page fetch
- **WHEN** notification succeeds, the process restarts, or a send response is lost
- **THEN** successful articles are not sent again and uncertain sends require manual resolution

#### Scenario: Feed outage
- **GIVEN** an unavailable feed or article page
- **WHEN** polling runs
- **THEN** no success notification is sent and retry backoff distinguishes feed failure from publication failure
