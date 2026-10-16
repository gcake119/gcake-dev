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
Production release SHALL require an explicit server gate and authenticated orchestration. Delivery SHALL compare revision and blob identities, update only publication frontmatter and the matching manifest status in one atomic Git commit, preserve bodies/order, and stop on conflicts. Editorial Actions SHALL remain gated and target Monday/Thursday after 07:00 Taipei. Worker deployment and ordinary Pages deployment SHALL require explicit manual dispatch on main; merging changes and hourly time passage alone SHALL NOT deploy or migrate production. Authorized editorial publication SHALL deploy only its newly committed publication revision through the gated editorial workflow. Failed builds SHALL NOT consume slots.

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

### Requirement: Publication conditioned Pages delivery
After explicit production authorization, the editorial workflow SHALL build and deploy exactly the newly committed publication revision returned by authenticated release execution. An empty or failed release request SHALL NOT start a Pages deployment. Publication failure SHALL retain the same release identity and require retrying the failed delivery jobs or manual reconciliation; hourly checks SHALL NOT repeatedly deploy pending verification. Deployment success alone SHALL NOT count as page/RSS verification. Worker deployment, database migrations, ordinary merge deployment and Hermes installation remain outside the editorial workflow.

#### Scenario: New publication revision
- **GIVEN** authorized production automation and one due finalized article
- **WHEN** release execution commits that article
- **THEN** Pages builds that committed revision and deploys it, preserving the article body and series order

#### Scenario: Empty hourly verification or ordinary merge
- **GIVEN** no newly committed publication
- **WHEN** an hourly check completes or an ordinary change is merged
- **THEN** no Pages deployment or Worker migration starts

#### Scenario: Failed or ambiguous delivery
- **GIVEN** publication committed but its build failed or the Git write result is unknown
- **WHEN** recovery runs
- **THEN** the same release identity remains, a failed delivery can retry its original build/deploy jobs, and an unknown write requires reconciliation without a new publication

#### Scenario: Disabled gate and invalid response
- **GIVEN** either production gate is disabled or orchestration returns a malformed publication identity
- **WHEN** the scheduled workflow attempts delivery
- **THEN** no Pages deployment starts and malformed responses fail visibly without disclosing credentials

#### Scenario: Unrelated manual deployment
- **GIVEN** a new editorial publication and an older manual Pages deployment for another revision
- **WHEN** public verification runs
- **THEN** the older deployment is not attached to this publication, and public page/RSS evidence remains independent


### Requirement: Deterministic public-only publication acceptance
The verifier SHALL use isolated read-only HTTPS Git fetch plus unauthenticated static HTTPS GET requests to the selected public repository and its configured GitHub Pages origin only. Git smart HTTP upload-pack transport is permitted; GitHub REST/GraphQL/internal JSON APIs are prohibited. It SHALL NOT publish, rerun workflows, invoke arbitrary commands, read credentials or modify existing repositories. Hermes SHALL only execute the fixed reviewed script and deliver its report; the already-completed job remains unchanged. Four structured criteria SHALL prove ready-to-published automatic commit, successful identical-SHA Pages deployment, canonical page identity and RSS identity. Polling SHALL use a monotonic deadline of at most twenty minutes.

#### Scenario: Complete automatic publication
- **GIVEN** an unchanged-body/order ready-to-published commit from the scheduled editorial workflow, successful same-SHA Pages deployment, and matching public page and RSS title, URL and date
- **WHEN** the verifier reads public evidence
- **THEN** all four criteria and overall result are passed only if every required provenance field is explicitly available; unsupported static deployment or job-time evidence remains unconfirmed

#### Scenario: Creation or manual publication is insufficient
- **GIVEN** an article creation commit or publication without scheduled editorial provenance
- **WHEN** automatic publication is checked
- **THEN** it does not pass and reports the missing evidence

#### Scenario: Waiting and bounded tracking
- **GIVEN** the earliest publication time passed but publication has not started, Actions is queued, Pages is running, or page/RSS is not yet visible
- **WHEN** the bounded read-only snapshot ends or reaches its deadline
- **THEN** it reports unconfirmed with progress, never a failure merely because time elapsed, and performs no publication or workflow rerun

#### Scenario: Explicit failure or contradictory content
- **GIVEN** a confirmed failed matching deployment or a successful page/RSS response contradicting the article identity
- **WHEN** evidence is evaluated
- **THEN** the affected criterion is failed with a concrete blocker

#### Scenario: Wrong SHA or unavailable evidence
- **GIVEN** deployment SHA differs, discovery is truncated or ambiguous, or public evidence is inaccessible or rate limited
- **WHEN** verification runs
- **THEN** missing criteria remain unconfirmed and the limitation is reported without using credentials

#### Scenario: Unsafe requests are blocked
- **GIVEN** a redirect, unapproved origin, credential-bearing URL or timeout
- **WHEN** evidence is fetched
- **THEN** the request is blocked or bounded and no private source or write API is used


### Requirement: API-free deterministic publication acceptance
The verifier SHALL NOT request GitHub REST, GraphQL or internal JSON API endpoints. It SHALL use isolated public Git and static HTTPS web pages without credentials. It SHALL preserve the four evidence gates, independently report page/RSS when scheduled provenance or deployment is unavailable, and clean up its owned temporary Git snapshot. The completed Hermes job SHALL remain completed and disabled.

#### Scenario: API quota is exhausted
- **GIVEN** GitHub REST quota is exhausted but public Git and static pages remain available
- **WHEN** fixed verification runs
- **THEN** no API request occurs and available commit/page/RSS evidence is reported independently

#### Scenario: Partial public deployment provenance
- **GIVEN** a ready-to-published commit and matching page/RSS but no explicit full-SHA deployment record
- **WHEN** verification runs
- **THEN** deployment and overall status remain unconfirmed; a green workflow never substitutes for deployment provenance

#### Scenario: Isolation and cleanup
- **GIVEN** credential helpers, proxy settings or Git hooks exist in the host environment
- **WHEN** public Git evidence is acquired or fails
- **THEN** host settings are not inherited, no remote write occurs, and the temporary snapshot is removed

#### Scenario: Static evidence missing or ambiguous
- **GIVEN** scheduled job timestamps are unavailable, a page redirects or Git history is truncated
- **WHEN** evidence is checked
- **THEN** the affected criterion remains unconfirmed with the missing evidence stated; no repair or repeated publication occurs

### Requirement: Structured incomplete-response handling
The verifier SHALL discard incomplete HTTP bodies, record the requested public URL and source stage, retain completed independent evidence and emit structured unconfirmed results without retrying.

#### Scenario: Truncated public page or RSS
- **GIVEN** a public response ends before its body is complete
- **WHEN** the manual verifier reads that source
- **THEN** that criterion is unconfirmed, the failed URL and stage are reported, partial content is not treated as evidence, and other complete criteria remain available

#### Scenario: Truncated Actions evidence
- **GIVEN** page and RSS have complete matching evidence but the Actions response is incomplete
- **WHEN** the manual verifier finishes
- **THEN** it emits valid JSON preserving page/RSS evidence and recording the Actions URL without retrying or performing publication

### Requirement: Public provenance and accurate progress
The verifier SHALL mark publicly matching page/RSS as public_provenance_pending when automatic provenance or deployment SHA is incomplete. It SHALL expose the full parent SHA and observed article/manifest transitions. Scheduled provenance SHALL compare run head SHA to publication parent and require unique successful release timing. Pages provenance SHALL require same-run successful build/deploy and an explicit full checkout revision from public runtime evidence; mutable main checkout or run head alone SHALL NOT suffice.

#### Scenario: Published but provenance pending
- **GIVEN** page and RSS match while run/deployment provenance is incomplete
- **WHEN** the report is produced
- **THEN** progress is public_provenance_pending rather than not_public and missing provenance remains unconfirmed

#### Scenario: Scheduled parent linkage
- **GIVEN** a scheduled main run whose full head SHA equals the publication parent, with one successful release window containing the commit time
- **WHEN** complete public records are evaluated
- **THEN** automatic provenance passes and the report includes parent/run/job/time evidence

#### Scenario: Wrong or manual run
- **GIVEN** a manual run, unrelated parent SHA, missing times or ambiguous scheduled records
- **WHEN** publication provenance is evaluated
- **THEN** it remains unconfirmed without inferring a scheduled publication

#### Scenario: Exact deployed build revision
- **GIVEN** successful build/deploy with configured Pages link and public checkout evidence identifying the full publication SHA
- **WHEN** deployment is verified
- **THEN** Pages passes with source revision and run/job evidence

#### Scenario: Mutable checkout and inaccessible logs
- **GIVEN** a run starts at publication SHA but checks out mutable main and public checkout logs are inaccessible or identify another SHA
- **WHEN** deployment is verified
- **THEN** Pages remains unconfirmed and the actual missing or mismatched revision is reported without API fallback

#### Scenario: Recovered deployment history
- **GIVEN** the same proven source SHA has an older failed deployment and a later successful deployment with explicit job completion times
- **WHEN** deployment provenance is evaluated
- **THEN** the newer successful result is used, conflicting results at the same time remain unconfirmed, and build completion must precede deployment
