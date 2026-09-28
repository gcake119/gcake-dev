## ADDED Requirements

### Requirement: D1 owns publication runtime state
D1 SHALL be the sole long-term owner of publication runs, attempts, latest target state, remote IDs/URLs, retry state, verification timestamps, and newsletter state; article status and `publishedAt` SHALL remain in Git frontmatter.

#### Scenario: Read target status
- **WHEN** the Publishing Center loads an article
- **THEN** editorial metadata comes from Git and operational target state comes from D1 without an editable article-body copy in D1

### Requirement: One-time JSON migration without dual writes
The migration SHALL import non-empty `src/data/publishing/publication-state.json` data once or read it compatibly until D1 acceptance, SHALL NOT write new state to both stores, and SHALL remove the JSON owner and compatibility path in the accepted cutover.

#### Scenario: Cutover completes
- **WHEN** D1 migration and repository tests pass the Phase 6 acceptance gate
- **THEN** all new publication runtime writes target D1 only and the JSON state file is removed in the same migration

### Requirement: Revision-aware independent target states
Each Paragraph or Substack target SHALL retain its own state and source revision; a newer Git source SHALL mark older remote state stale without automatically publishing it.

#### Scenario: Article changes after verification
- **WHEN** a target is verified for revision `abc123` and the current article becomes `def456`
- **THEN** the target displays `stale` while other targets retain their independent states

### Requirement: Explicit publication operations
Prepare, publish, verify, retry, and newsletter intent SHALL be explicit operations that name target(s); saving Git content SHALL NOT implicitly invoke an external provider write.

#### Scenario: Save article only
- **WHEN** the owner commits an article from the Editor
- **THEN** no Paragraph/Substack publish, email, or newsletter operation starts automatically

### Requirement: Failure isolation
A failure for GitHub Pages observation, Paragraph, or Substack SHALL NOT corrupt article content or roll back a successful independent target.

#### Scenario: Substack unavailable
- **WHEN** GitHub Pages and Paragraph are verified while Substack is unavailable
- **THEN** the first two states remain successful and Substack reports `manual_required` or its own failure state

### Requirement: Disabled Substack production path
The first complete version SHALL represent Substack as `manual_required` or `not_configured` and SHALL NOT use brittle browser or internal API publication automation without separate approval.

#### Scenario: User requests Substack publish
- **WHEN** no separately approved stable write integration exists
- **THEN** the CMS provides manual recovery guidance and performs no external Substack write

### Requirement: Paragraph production gate
Paragraph write operations SHALL remain disabled until explicit approval, a pinned supported interface, verified create/update/publish/canonical/date behavior, retry protection, and public verification are recorded.

#### Scenario: Gate not approved
- **WHEN** any Paragraph production-gate condition is missing
- **THEN** prepare/dry-run remains available but publish and newsletter delivery fail closed without a provider write

### Requirement: Newsletter idempotency boundary
Newsletter delivery SHALL be a separate irreversible intent and SHALL NOT be repeated by ordinary article update or retry operations.

#### Scenario: Retry verified article update
- **WHEN** an article update retry occurs after a newsletter was already sent
- **THEN** the system updates or verifies the remote article without sending another newsletter unless a new explicit newsletter intent is separately authorized

### Requirement: Auditable safe operations
The CMS SHALL record significant auth, Git commit, series, media, preview, conflict, and publication operation events without storing secrets or complete article source by default.

#### Scenario: Provider failure audit
- **WHEN** a provider publish or verification attempt fails
- **THEN** D1 records bounded diagnostic metadata and error code without access tokens, private keys, or full article body
