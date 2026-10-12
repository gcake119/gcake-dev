## Purpose

Safely deliver articles through the existing editorial scheduler while preserving the completed 30-article snapshot and exact deployment provenance. The former push/hourly candidate is withdrawn legacy evidence in ../../legacy/.

## ADDED Requirements

### Requirement: Existing release scheduler preserved
The editorial scheduler SHALL retain its Monday/Thursday Taipei 07:00 eligibility, hourly recovery checks, existing gates, article order and unique release identity. Ordinary Pages SHALL remain manual only; the legacy push/minute-37 candidate SHALL NOT execute.

#### Scenario: Due release and repeated checks
- **GIVEN** five ready articles in the existing series and an eligible release slot
- **WHEN** the existing scheduler commits one eligible article and subsequently checks the same slot
- **THEN** only that committed revision is automatically built and deployed and repeated checks create no second publication or automatic delivery path

#### Scenario: Before the eligible slot
- **GIVEN** a ready article whose next slot is 2026-10-15 07:00 Asia/Taipei
- **WHEN** a build runs before that slot
- **THEN** the article remains absent from public reading surfaces

### Requirement: Strict completed snapshot restoration
Every Pages delivery SHALL use the saved completed 30-article snapshot with a fixed revision and independently pinned per-article SHA-256. Validation SHALL precede atomic replacement and build. Any unavailable, invalid, active, incomplete or mismatched snapshot SHALL stop deployment, preserve the existing website, and make no retired-source request or 19-article fallback.

#### Scenario: Valid completed snapshot
- **GIVEN** the saved completed snapshot matches the fixed revision and all 30 pinned article hashes
- **WHEN** either existing Pages delivery builds an artifact
- **THEN** all 30 articles are restored together without requesting the retired source

#### Scenario: Invalid snapshot or unavailable saved site
- **GIVEN** an unavailable saved snapshot, changed revision, active 19-article snapshot, missing article, corrupt body or changed body and accompanying hash
- **WHEN** delivery prepares external content
- **THEN** preparation fails, the previous local snapshot remains intact, and no public deployment follows

### Requirement: SHA-specific CMS verification
CMS SHALL observe both approved Pages delivery workflows by actual artifact revision, exclude skipped and unrelated runs, and require successful deployment before reporting deployed. Public verification SHALL continue to require matching page identity, publication source and RSS independently of Actions state.

#### Scenario: Editorial trigger precedes publication commit
- **GIVEN** a scheduled run was triggered before it committed the publication revision and a newer unrelated run exists
- **WHEN** CMS verifies the committed release
- **THEN** CMS associates only the delivery of that publication revision and retains independent public verification

#### Scenario: No-op or failed build
- **GIVEN** a successful scheduler check without deployment or a matching delivery whose build failed
- **WHEN** CMS observes delivery
- **THEN** a no-op check is not reported as deployed and the failed build is reported as failed

#### Scenario: Exact failed-run recovery
- **GIVEN** a release has a known failed delivery and a newer unrelated run exists
- **WHEN** the owner requests authorized recovery
- **THEN** only failed jobs in the matching delivery run are retried, with no new publication or replay of successful deployment jobs

#### Scenario: Missing provenance or successful delivery
- **GIVEN** no matching delivery can be proven or the matching delivery already succeeded
- **WHEN** recovery is requested
- **THEN** no workflow is dispatched or retried and reconciliation is required

### Requirement: Protected local qualification
Implementation SHALL preserve manual Secret acceptance isolation, stale-artifact rejection, failed-build deployment blocking and public time filtering. Local qualification SHALL NOT send platform content, email, push Git or deploy production.

#### Scenario: Secret acceptance and stale artifact
- **GIVEN** a Secret acceptance request, failed snapshot check, failed build or artifact superseded on main
- **WHEN** delivery evaluates eligibility
- **THEN** no public deployment from that request or artifact occurs
