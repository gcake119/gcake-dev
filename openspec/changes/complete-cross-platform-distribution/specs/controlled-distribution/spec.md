> 歷史規格：此已完成變更的分發目標已由 remove-paragraph-sync 取代。不得依此文件啟動舊目標；現行操作以 Substack-only 同步文件及新規格為準。

## Purpose
Provide explicitly authorized, revision-bound cross-platform article distribution with safe recovery and public verification.
## ADDED Requirements
### Requirement: Controlled writes
The distributor SHALL load published Markdown from Git, require a reviewed dry run and an exact target/revision approval before writes, and SHALL never send newsletters.
#### Scenario: Approved article
- **GIVEN** a published article and matching target/revision approval
- **WHEN** the operator publishes
- **THEN** only that platform receives the prepared content without newsletter delivery
#### Scenario: Missing or stale approval
- **GIVEN** a missing approval or changed article
- **WHEN** the operator publishes
- **THEN** no external write occurs
#### Scenario: Unsupported source
- **GIVEN** an unpublished, future-dated, or nonportable article
- **WHEN** the operator prepares distribution
- **THEN** preparation fails before writes
### Requirement: Durable uncertain recovery
The distributor SHALL serialize each article/platform, persist intent before create and publish, preserve remote identity on failure, and prohibit repeated writes after an uncertain result until read-only reconciliation succeeds.
#### Scenario: Lost create response
- **GIVEN** a create request with an unknown result
- **WHEN** the operator retries after restart
- **THEN** no second article is created and manual reconciliation is requested
#### Scenario: Lost publish response
- **GIVEN** a persisted publish intent
- **WHEN** the operator retries
- **THEN** only public verification runs and no second publish is dispatched
#### Scenario: Concurrent attempts
- **GIVEN** an active attempt for one article/platform
- **WHEN** another attempt starts for that same platform
- **THEN** it fails without an external write while the other platform remains independent
### Requirement: Browser integration
Substack SHALL use an attended dedicated browser profile outside Git or an explicitly selected attended side-browser transport, and a reviewed versioned UI contract. The side-browser transport SHALL NOT export authentication or bypass durable intent. Login expiry, CAPTCHA, ambiguous controls, missing capabilities required by the selected canonical/date policy, and unsupported content SHALL require manual intervention before publishing.
#### Scenario: Draft update
- **GIVEN** a stored Substack draft identity
- **WHEN** a newer revision is prepared
- **THEN** the existing draft is updated and no second draft is created
#### Scenario: Unsafe UI
- **GIVEN** an expired login, CAPTCHA, or ambiguous control
- **WHEN** the browser attempts preparation
- **THEN** it stops with a bounded error without publishing
### Requirement: Public evidence
Verification SHALL require exact title, normalized complete content, images, links, the selected canonical policy, and original publication date from public read-back before recording verified. Fixture evidence SHALL be reported separately from live platform evidence.
#### Scenario: Complete public read
- **GIVEN** a known remote article with matching content, images, links, canonical, and date
- **WHEN** the operator verifies
- **THEN** the platform is recorded verified for that revision
#### Scenario: Evidence mismatch
- **GIVEN** any missing or mismatched public field
- **WHEN** the operator verifies
- **THEN** the platform remains unverified and other successful platforms retain their states

### Requirement: Explicit Substack mirror policy
Substack full-text mirroring SHALL require a reviewed, approved full-mirror policy binding the platform canonical exception and after-publication original-date restoration. Pages SHALL retain its source canonical. Paragraph SHALL retain strict source-canonical verification. The Substack mirror SHALL link to the Pages original and its public HTML canonical SHALL identify that same Substack article.
#### Scenario: Mirror accepted
- **GIVEN** a reviewed full-text article and matching full-mirror approval
- **WHEN** its Substack mirror is publicly read back with correct original link, platform canonical and original date
- **THEN** it is verified under the mirror policy without claiming its canonical points to Pages
#### Scenario: Stale policy approval
- **GIVEN** an approval made before the canonical/date policy changed
- **WHEN** any remote write is requested
- **THEN** no remote write occurs
#### Scenario: Wrong original or platform canonical
- **GIVEN** a mirror missing the original Pages link or pointing canonical at a different article
- **WHEN** public verification runs
- **THEN** it remains unverified
### Requirement: Original date after publication
The approved Substack publish operation SHALL publish once without delivery, confirm the exact public article, restore its original date on that same article, and then verify all public evidence. A temporary current-date display is accepted only for this Substack policy. Date restoration intent SHALL survive process restart. An operator-authorized finalize operation SHALL only restore the original date on the existing public article. Retry and verify SHALL remain read-only.
#### Scenario: Date restored
- **GIVEN** an authorized full-mirror article
- **WHEN** web-only publication and date restoration succeed
- **THEN** the same public article shows the original date with zero newsletter deliveries
#### Scenario: Date save fails
- **GIVEN** publication succeeded but original-date saving failed
- **WHEN** the operation ends
- **THEN** the article identity is preserved and the mirror remains uncertain
#### Scenario: Read-only recovery
- **GIVEN** date restoration has an uncertain outcome
- **WHEN** the operator retries or verifies after restart
- **THEN** only public readback occurs with no publication or date write
#### Scenario: Authorized date-only recovery
- **GIVEN** an existing uncertain mirror with matching content and new finalize authorization
- **WHEN** the operator finalizes the original date
- **THEN** only that article's date is updated and no draft or publication is created
#### Scenario: Wrong article or revision during recovery
- **GIVEN** an uncertain mirror whose public content or source revision does not match the reviewed article
- **WHEN** finalize is requested
- **THEN** no date write or publication occurs

### Requirement: Publication-free setup
The operator SHALL prepare the dedicated Substack login without an eligible article, D1 credentials, approval, or platform writes. Database setup SHALL preserve existing data and migration history using a unique additive migration.
#### Scenario: Login before selecting an article
- **GIVEN** no eligible published article and a dedicated Substack configuration
- **WHEN** the operator starts login preparation
- **THEN** only the configured publication dashboard opens for human login and no article or publication state changes
#### Scenario: Login target is unsupported
- **GIVEN** a login request for another platform
- **WHEN** login preparation starts
- **THEN** it is rejected before opening a browser or accessing article content
#### Scenario: Existing database is configured
- **GIVEN** an existing database with publication records and applied migrations
- **WHEN** distribution setup is applied
- **THEN** existing records are preserved and new recovery tables are recorded under a unique migration name

### Requirement: Revision-scoped controlled trial
The distributor SHALL distinguish an explicitly enabled single-article controlled trial from generally verified production capability. Trial writes SHALL require matching publication, article revision, dry-run receipt and operation approval. A publish trial SHALL require a previously prepared draft of that revision. Trial execution SHALL NOT mark general production capabilities verified or send newsletters.
#### Scenario: Draft trial without general production capability
- **GIVEN** an exact article revision and prepare approval for the configured publication with trial writes explicitly enabled
- **WHEN** a draft trial is invoked
- **THEN** only that draft is prepared without publication and general production capability remains unverified
#### Scenario: Scope or identity mismatch
- **GIVEN** a trial with a different article, revision, operation, or publication identity
- **WHEN** an operation is invoked
- **THEN** no provider write occurs
#### Scenario: Publish before preparation
- **GIVEN** no saved prepared draft of the approved revision
- **WHEN** a publish trial is invoked
- **THEN** it stops without creating or publishing an article
#### Scenario: Trial remains disabled
- **GIVEN** a trial scope whose writes remain disabled
- **WHEN** a write operation is invoked
- **THEN** no external or publication-state write occurs

### Requirement: Attended side-browser handoff
The existing coordinator SHALL own publication state and checkpoints when the operator selects the side browser. Each handoff SHALL bind a unique request, article revision, operation, and existing remote identity. Provider writes SHALL be requested only after durable intent exists. Draft completion SHALL require complete saved-content evidence; published completion SHALL additionally require independent anonymous verification. Unanswered, stale, malformed or mismatched responses SHALL stop and preserve uncertainty without replay.
#### Scenario: Approved side-browser draft
- **GIVEN** a matching prepare approval and an authenticated side browser
- **WHEN** the operator completes the requested draft action
- **THEN** the same draft identity and matching saved content are recorded through the shared publication flow
#### Scenario: Intent before browser write
- **GIVEN** an approved browser write
- **WHEN** a write handoff becomes available
- **THEN** its durable intent already exists and the other platform remains independent
#### Scenario: Stale reply or lost acknowledgement
- **GIVEN** an unanswered write or a reply for a different request, revision or remote article
- **WHEN** the operation resumes or times out
- **THEN** it remains uncertain and no replacement article or repeated publication is requested
#### Scenario: False public completion
- **GIVEN** a browser reply claiming success but anonymous public content does not match
- **WHEN** public verification runs
- **THEN** the existing article remains unverified without a second publish

### Requirement: Pages-first unattended synchronization
The distributor SHALL synchronize only after the current Markdown is published, its date has arrived, and an anonymous Pages read matches the exact source body, title, canonical, date, links and images. Codex scheduled execution SHALL use the authenticated side browser and shared durable coordinator. The accepted unattended policy SHALL replace repeated per-article confirmation, while requiring configured writes and preserving provider capability limits. A withdrawn or unpublished original SHALL NOT be republished or synchronized using a historical receipt.
#### Scenario: Public original precedes synchronization
- **GIVEN** an eligible source and a matching anonymous Pages article
- **WHEN** the configured unattended synchronization runs
- **THEN** each platform synchronizes the same version independently without sending newsletters or asking for another article approval
#### Scenario: Original is withdrawn or deployment is stale
- **GIVEN** an unpublished source, missing public page, or mismatched public version
- **WHEN** synchronization runs
- **THEN** neither platform is changed and historical deployment evidence does not enable publication
#### Scenario: Uncertain platform outcome
- **GIVEN** one platform succeeded and another has an unanswered write
- **WHEN** the scheduled synchronization runs again
- **THEN** the successful platform is preserved and the uncertain platform is only reconciled without creating or publishing again
#### Scenario: Background browser unavailable
- **GIVEN** Codex cannot access the authenticated side browser or an essential platform control cannot be verified
- **WHEN** synchronization runs
- **THEN** that platform stops safely and the missing operational requirement is reported

### Requirement: All-article fixed-source discovery
The distributor SHALL inventory every article from one clean fixed remote main commit of gcake119/gcake-dev. Formal Markdown SHALL be the only distributable source. MDX, interactive summaries, malformed sources, duplicate slugs and external aggregate entries SHALL be explicitly reported as blocked unless the complete formal body is portable and verifiable. Only published, due sources with matching anonymous Pages evidence SHALL become eligible. Scanning SHALL perform zero provider writes and SHALL continue reporting independent candidate failures.
#### Scenario: First article and additional articles
- **GIVEN** two published due formal articles and one ready article at one source version
- **WHEN** the inventory runs
- **THEN** both public matching articles are eligible and the ready article is reported excluded without external writes
#### Scenario: Future and unavailable originals
- **GIVEN** a future article and a due article whose public body, title, date, canonical, links or images differ
- **WHEN** the inventory runs
- **THEN** neither becomes eligible and each blocking reason is reported
#### Scenario: Non-authoritative or partial content
- **GIVEN** an external aggregate article, an MDX article and an interactive-summary article
- **WHEN** the inventory runs
- **THEN** each is listed explicitly as blocked and no summary is represented as full content
#### Scenario: Empty inventory and ambiguous identity
- **GIVEN** no formal articles or two files with the same article slug
- **WHEN** the inventory runs
- **THEN** the empty inventory produces no operations and duplicate identities block synchronization

### Requirement: General policy with exact operations
A general unattended policy SHALL bind gcake119/gcake-dev main, gcake Paragraph publication, gcakedev Substack origin, full-mirror exception and zero email or App delivery. It SHALL derive exact article/version/target/operation authorization only after Pages proof. General capability flags SHALL remain unchanged. Target planning SHALL preserve existing identities, checkpoint versions and independent failures. Unknown intent SHALL allow only retry, verify or metadata finalization on the original identity; mismatched intent versions and active locks SHALL block writes. Historical remote lookup SHALL cover every page and draft, published and scheduled states before creation.
#### Scenario: Multiple exact scopes
- **GIVEN** two eligible articles under the configured all-article policy
- **WHEN** execution scopes are prepared
- **THEN** each scope authorizes only its article version and configured platform operations without general capability promotion
#### Scenario: Wrong source or publication
- **GIVEN** a policy for another repository, branch or publication
- **WHEN** planning starts
- **THEN** no executable authorization is produced
#### Scenario: Unknown response and partial success
- **GIVEN** one verified platform and another with an unknown publication response
- **WHEN** planning runs again
- **THEN** the verified platform is checked without writes and the uncertain platform only reconciles its existing intent
#### Scenario: Incomplete historical scan
- **GIVEN** a matching historical article on a later page or an incomplete remote listing
- **WHEN** first synchronization runs
- **THEN** the existing article is reconciled or synchronization stops without a duplicate

### Requirement: Published revision update without republication
A previously verified remote article SHALL receive a new eligible formal revision on its existing identity with no publication or delivery action. Saved content SHALL be reloaded and anonymously verified before the new revision is verified. Unknown update intent SHALL preserve the same identity and version and SHALL reconcile without rewriting. Untracked historical public articles SHALL require exact complete reconciliation before adoption; conflicting content SHALL block instead of creating replacements.
#### Scenario: New version of an existing mirror
- **GIVEN** a verified public mirror and a new formal version whose Pages body is verified
- **WHEN** synchronization prepares that version
- **THEN** the existing mirror is updated, anonymously verified and retains its identity with zero publish or delivery actions
#### Scenario: Repeated verified version
- **GIVEN** the exact version is already verified
- **WHEN** synchronization repeats
- **THEN** only verification runs with no create, update or publish
#### Scenario: Interrupted update
- **GIVEN** an unanswered update of an existing public mirror
- **WHEN** synchronization retries
- **THEN** only same-identity readback runs and a replacement or second update is never dispatched

### Requirement: Single-writer runtime handover
The general runtime SHALL remain a separate candidate until full local gates and the all-candidate dry run are reviewed. Handover SHALL check all active locks and unsettled intents, preserve the old runtime pin, stop the old heartbeat before enabling its replacement, and retain rollback configuration without replaying writes. The first live acceptance SHALL be explicitly bounded to the already-public first article. Historical bulk publication SHALL remain disabled during this acceptance.
#### Scenario: Candidate is ready for review
- **GIVEN** a passing isolated runtime candidate and a complete inventory
- **WHEN** the handover is prepared
- **THEN** the candidate pin, policy, first-article plan and remaining operational requirements are reviewable while the old writer remains unchanged
#### Scenario: In-flight handover
- **GIVEN** an active writer lock or unresolved intent
- **WHEN** runtime switching is attempted
- **THEN** activation stops and the existing identity is preserved

### Requirement: Explicit Substack minute precision
The user-approved full-mirror policy SHALL permit Substack alone to display the source publication instant truncated to its minute. The formal source, Pages and Paragraph SHALL retain exact seconds. Precision SHALL be bound into reviewed receipts and approvals; old approvals SHALL NOT authorize this exception. The default remains exact precision. Metadata recovery SHALL preserve the existing public identity and durable attempt, with zero email or App delivery.
#### Scenario: Approved minute display
- **GIVEN** an approved Substack minute policy and source time 11:56:38
- **WHEN** the same public article is updated and anonymously read back
- **THEN** Substack shows the 11:56 minute (provider sub-minute values are outside its display precision) and the other sources retain 11:56:38
#### Scenario: Wrong minute or stale approval
- **GIVEN** a 11:56:38 source and a public time of 11:57:00 or an approval without the minute policy
- **WHEN** verification or a metadata write is requested
- **THEN** verification or authorization fails without creating another article
#### Scenario: Recovery without delivery
- **GIVEN** an interrupted date restoration on an existing public article
- **WHEN** the approved minute policy finalizes the same durable attempt
- **THEN** only that article is updated with email and App delivery disabled

### Requirement: Scripted synchronization round
One command SHALL verify the runtime pin and accepted policy, acquire an exclusive round lock, audit all durable intent, obtain one fresh fixed main snapshot, inventory sources and run the existing exact per-target plans. Planning SHALL perform zero article writes. Execution SHALL preserve independent target outcomes and never automatically replay a failed operation. Every round SHALL save secret-free evidence and remove only its owned source snapshot after all operations settle; unresolved side-browser requests SHALL preserve their source and identity. Locks SHALL NOT be stolen by age. No unchanged-state notification SHALL be generated.
#### Scenario: Existing verified article
- **GIVEN** one eligible unchanged article verified on both platforms
- **WHEN** the execution command runs
- **THEN** both mirrors are read back, zero articles or notifications are sent, evidence is saved and the owned snapshot is removed
#### Scenario: Independent platform failure
- **GIVEN** one eligible article and Paragraph returns a rate limit
- **WHEN** the round executes
- **THEN** Paragraph records a bounded failure once, Substack continues independently and no operation is automatically retried
#### Scenario: Concurrent or changed runtime
- **GIVEN** another round owns the lock or a pinned file changed
- **WHEN** a round starts
- **THEN** it stops before source or platform operations and does not rewrite the pin or steal the lock
#### Scenario: Uncertain prepare
- **GIVEN** preparation returns an uncertain outcome
- **WHEN** the remaining plan includes publication
- **THEN** publication is skipped and the original identity and durable intent are preserved

### Requirement: Scripted side-browser handoff
A reusable command SHALL inspect an exact live request and submit complete observed evidence without exporting authentication or driving a background browser. It SHALL bind request identity, configured source commit, current source body, remote identity, expiry and matching durable write intent, prove Pages before each requested write, and create a reply exclusively with private permissions. Full text SHALL be compared directly; an expected body SHALL NOT be substituted for missing observed text. Existing zero email, App and scheduling constraints SHALL remain mandatory.
#### Scenario: Valid saved draft
- **GIVEN** an unexpired request matching the fixed source and durable intent
- **WHEN** complete saved browser evidence is submitted
- **THEN** one bound reply is saved and the original coordinator continues
#### Scenario: Stale or incomplete evidence
- **GIVEN** an expired request, changed source, wrong remote identity or incomplete observed body
- **WHEN** a reply is submitted
- **THEN** submission fails without a reply or repeated browser action

### Requirement: Independent dedicated browser transport
When explicitly selected, the optional profile transport SHALL replace the Codex side-browser dependency with a dedicated persistent browser profile outside Git. The current selected transport is Existing Chrome system transport. The owner SHALL sign in directly; authentication SHALL NOT be exported from Codex or another browser. The profile transport SHALL remain bound to current-source trial authorization, zero delivery and existing D1 identity/recovery. The approved transport SHALL be part of the review digest. Missing login, ambiguous UI, incomplete discovery or expired controls SHALL stop that platform without replay.
#### Scenario: Owner profile is ready
- **GIVEN** a directly authenticated dedicated profile and one eligible source
- **WHEN** standalone synchronization runs
- **THEN** it completes without an attended file request or Codex session, preserving remote identity and zero delivery
#### Scenario: Authentication expires
- **GIVEN** the dedicated profile requires sign-in
- **WHEN** a write is considered
- **THEN** the platform stops with an actionable login error and no creation or publication
#### Scenario: Transport changes
- **GIVEN** a receipt for the previous side-browser transport
- **WHEN** a dedicated-profile write is requested
- **THEN** the stale receipt is rejected before any write

### Requirement: macOS scheduled script cutover
A user LaunchAgent SHALL invoke the pinned synchronization script every 15 minutes using absolute executable, runtime and private policy paths, without Codex or inherited shell initialization. Credentials SHALL only be loaded from the existing private environment file. Installer output SHALL contain no secret values and private logs SHALL remain outside Git. Cutover SHALL require local gates, approved browser transport readiness, a real same-version read-only round and zero in-flight writers; the old heartbeat SHALL be disabled before activating the system scheduler. Rollback SHALL stop the scheduler and preserve all identities and configuration.
#### Scenario: Scheduled unchanged round
- **GIVEN** an installed agent and unchanged verified articles
- **WHEN** the system starts the job
- **THEN** Substack is verified with no article or notification writes and owned source cleanup
#### Scenario: Preflight is incomplete
- **GIVEN** the selected transport or runtime acceptance is missing
- **WHEN** installation or activation is requested
- **THEN** activation is rejected and the working heartbeat is preserved
#### Scenario: Cutover has succeeded
- **GIVEN** the standalone Substack verification and all runtime gates passed with no active writer
- **WHEN** the LaunchAgent is activated
- **THEN** the Codex heartbeat is disabled and only the system scheduler owns execution

### Requirement: Existing Chrome system transport
The accepted macOS transport SHALL use Chrome's Apple Events interface on one uniquely identified tab of gcakedev.substack.com. Every operation SHALL check the bound tab identity and origin; unexpected navigation, multiple candidates, missing permissions or changed source SHALL stop without browser writes. It SHALL preserve exact revision authorization, D1 intent, same-ID updates, zero delivery and independent anonymous public verification. It SHALL NOT export authentication, use remote debugging, close unrelated tabs or enable permissions automatically.
#### Scenario: Existing authenticated tab
- **GIVEN** one authorized authenticated Chrome tab and owner-enabled automation permissions
- **WHEN** the system performs an exact approved operation
- **THEN** the existing login is reused without Codex or authentication export and the same durable identity is retained
#### Scenario: Ambiguous or unauthorized tab
- **GIVEN** multiple matching tabs or the bound tab navigated outside the authorized publication
- **WHEN** an operation is considered
- **THEN** execution stops before any page write and other tabs remain untouched
#### Scenario: Permissions missing
- **GIVEN** Chrome or macOS denies automation
- **WHEN** preflight runs
- **THEN** it reports a bounded permission error without enabling settings, requesting login or publishing
#### Scenario: Source changes before a write
- **GIVEN** a bound authorized tab and a source whose Pages content changed
- **WHEN** a page mutation is requested
- **THEN** it stops before the mutation and preserves the original intent

### Requirement: Anonymous Substack post identity
For the explicit native identity policy, the system SHALL match the bound editor article ID, durable original ID, anonymous public article ID, configured publication ID and exact platform canonical before an existing article mutation. It SHALL parse public HTML data without executing scripts or using authenticated APIs. Newly published IDs SHALL resolve through the public archive and independent article readback. Missing, conflicting, malformed or off-publication evidence SHALL stop before a write and preserve the original identity. Full text, original link, images, date and zero delivery checks SHALL remain required.
#### Scenario: Editor has no public link
- **GIVEN** the original published ID and an editor without a public href
- **WHEN** anonymous public identity and the bound editor identify the same article
- **THEN** a precisely approved same-ID update can proceed with delivery off and full anonymous readback
#### Scenario: Public identity conflicts
- **GIVEN** anonymous evidence identifies a different article or publication
- **WHEN** an update is requested
- **THEN** no draft content changes and the original ID remains preserved
#### Scenario: Publication result is not discoverable
- **GIVEN** a website publication was attempted on the original ID
- **WHEN** the anonymous archive lacks one unambiguous matching public article
- **THEN** the outcome remains unresolved and no second publication or replacement article is created
#### Scenario: Public script data is invalid
- **GIVEN** missing, malformed or multiple public identity records
- **WHEN** identity verification runs
- **THEN** it stops without executing page scripts or trusting a title match

### Requirement: Revoked platform authorization
The active system entry SHALL execute only targets allowed by the current policy. After Paragraph authorization is revoked, its existing articles, remote IDs and durable in-flight identity SHALL be retained without replay or platform calls. Historical approvals SHALL NOT override current target authorization.
#### Scenario: Old approval targets revoked platform
- **GIVEN** current policy allows only Substack and an older approval allows Paragraph
- **WHEN** execution is requested
- **THEN** it stops before provider access and preserves existing identity
#### Scenario: Substack-only scheduled round
- **GIVEN** current policy allows only Substack and no in-flight operations exist
- **WHEN** the independent schedule runs
- **THEN** only Substack is verified or synchronized and Paragraph remains untouched
