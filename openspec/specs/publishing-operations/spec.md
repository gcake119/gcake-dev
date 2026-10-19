# publishing-operations Specification

## Purpose

Define current Git-owned editorial data and D1-owned publication operations for Pages and Substack, preserving historical destination evidence without execution.

## Requirements

### Requirement: D1 owns publication runtime state
D1 SHALL be the sole long-term owner of publication runs, attempts, latest target state, remote IDs/URLs, retry state, verification timestamps, and newsletter state; article status and `publishedAt` SHALL remain in Git frontmatter.

#### Scenario: Read target status
- **WHEN** the Publishing Center loads an article
- **THEN** editorial metadata comes from Git and operational target state comes from D1 without an editable article-body copy in D1

---
### Requirement: One-time JSON migration without dual writes
The migration SHALL import non-empty `src/data/publishing/publication-state.json` data once or read it compatibly until D1 acceptance, SHALL NOT write new state to both stores, and SHALL remove the JSON owner and compatibility path in the accepted cutover.

#### Scenario: Cutover completes
- **WHEN** D1 migration and repository tests pass the Phase 6 acceptance gate
- **THEN** all new publication runtime writes target D1 only and the JSON state file is removed in the same migration

---
### Requirement: Revision-aware independent target states
Each Substack target SHALL retain its own state and source revision; a newer Git source SHALL mark older remote state stale without automatically publishing it.

#### Scenario: Article changes after verification
- **WHEN** a target is verified for revision `abc123` and the current article becomes `def456`
- **THEN** the target displays `stale` while other targets retain their independent states

---
### Requirement: Explicit publication operations
Prepare, publish, verify, retry, and newsletter intent SHALL be explicit operations that name target(s); saving Git content SHALL NOT implicitly invoke an external provider write.

#### Scenario: Save article only
- **WHEN** the owner commits an article from the Editor
- **THEN** no Substack publish, email, or newsletter operation starts automatically

---
### Requirement: Failure isolation
A failure for GitHub Pages observation or Substack SHALL NOT corrupt article content or roll back a successful independent target.

#### Scenario: Substack unavailable
- **GIVEN** GitHub Pages is verified
- **WHEN** Substack is unavailable
- **THEN** Pages remains verified and Substack reports its own failure state

---
### Requirement: Disabled Substack production path
The first complete version SHALL represent Substack as `manual_required` or `not_configured` and SHALL NOT use brittle browser or internal API publication automation without separate approval.

#### Scenario: User requests Substack publish
- **WHEN** no separately approved stable write integration exists
- **THEN** the CMS provides manual recovery guidance and performs no external Substack write

---
### Requirement: Newsletter idempotency boundary

Newsletter and App delivery SHALL be explicit irreversible intent tied to the first authorized provider publication of the original article. An armed scheduled-publication commitment SHALL authorize that first provider-controlled delivery even when Pages fails. Ordinary source edits, verification, revision reconciliation, postponement, cancellation and retry SHALL NOT authorize an additional delivery. Previously published website-only articles SHALL NOT receive delivery backfill merely because the new policy is enabled. Provider submission, reported delivery and individual human receipt SHALL remain distinct evidence.

#### Scenario: Retry verified article update
- **GIVEN** a publication has already initiated its authorized delivery
- **WHEN** an article update or retry is requested
- **THEN** only the original article is updated or verified and no additional email or App notification is initiated

#### Scenario: Existing website-only article remains quiet
- **GIVEN** a prior article was published with delivery disabled
- **WHEN** the new scheduled-delivery policy is enabled
- **THEN** that article is not re-published or sent retroactively

#### Scenario: Delivery outcome is unknown
- **GIVEN** a first scheduled publication has occurred and delivery acknowledgement is unavailable
- **WHEN** the verifier revisits the article
- **THEN** it retains unknown delivery evidence without sending again or claiming individual receipt

---
### Requirement: Auditable safe operations
The CMS SHALL record significant auth, Git commit, series, media, preview, conflict, and publication operation events without storing secrets or complete article source by default.

#### Scenario: Provider failure audit
- **WHEN** a provider publish or verification attempt fails
- **THEN** D1 records bounded diagnostic metadata and error code without access tokens, private keys, or full article body

---
### Requirement: Substack mirrors preserve the source slug

Every Substack mirror SHALL use exactly the slug of its authoritative Git original, with public URL shaped as `https://gcakedev.substack.com/p/<source-slug>`. Under the scheduled-delivery policy the Git original SHALL be finalized and revision-pinned without requiring a public Pages route. Under the legacy policy Pages verification SHALL remain required. The publication workflow SHALL set and persist the source slug on the existing draft before first publication and SHALL NOT derive another slug from the title, accept a platform substitute or append a collision suffix. The platform canonical SHALL identify that exact Substack URL. Complete public evidence SHALL match the armed source version and confirmed publication minute before public verification is recorded; original-site availability SHALL be reported independently.

After a verified foreground content correction, complete public evidence SHALL match that corrected authoritative source version at the original publication minute; the initial armed version and delivery history SHALL remain separately preserved.

#### Scenario: First publication uses the original slug
- **GIVEN** a finalized original with slug `ithome-2026-astro-choice` and an authorized Substack draft
- **WHEN** the operator prepares and schedules the mirror
- **THEN** the persisted draft slug and eventual public canonical use `ithome-2026-astro-choice`, and the mirror is publicly verified only after complete evidence matches that same article

#### Scenario: Slug cannot be saved or is already occupied
- **GIVEN** the source slug cannot be persisted, is changed by the platform, or belongs to another Substack article
- **WHEN** preparation checks the saved slug
- **THEN** scheduling stops with the existing identity and diagnostics preserved, without creating another article or choosing a substitute slug

#### Scenario: A public mirror has the wrong slug
- **GIVEN** a mirror has matching content but a different public canonical slug from its authoritative source
- **WHEN** public verification evaluates the mirror
- **THEN** it is not accepted as verified even if the old URL redirects successfully

#### Scenario: Existing mirror URL is corrected
- **GIVEN** an existing public mirror has a different slug and no unresolved operation or competing writer
- **WHEN** an authorized foreground operation changes the URL and verifies complete evidence at the source-slug URL
- **THEN** its ID, content, publication minute and delivery history remain unchanged, its durable remote URL records the verified new address, and no article is recreated, republished or redelivered

#### Scenario: Background work encounters a slug mismatch
- **GIVEN** a scheduled mirror requires a slug correction
- **WHEN** background work evaluates the correction
- **THEN** it preserves the original identity and defers the correction to foreground handling without accessing Chrome or mutating the article
