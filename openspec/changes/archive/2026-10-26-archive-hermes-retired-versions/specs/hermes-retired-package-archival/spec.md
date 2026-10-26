## Purpose
Preserve retired Hermes packages in a separately inventoried cold archive while retaining the existing managed update limits and active recovery state. Archival is a foreground operation with exact package identities and reversible relocation.

## ADDED Requirements

### Requirement: Exact retired package eligibility
The archive operation SHALL require explicit execution authorization and an exact allowlist. It SHALL reject active, gated, pending-update, recovery-dependent or leased packages and packages referenced by a runnable installed entry. Historical audit references SHALL remain preserved and linked to the archive inventory. Source package identity and complete contents SHALL be verified before relocation. Missing privileged evidence SHALL block eligibility rather than imply retirement.

#### Scenario: Verified retired package
- **GIVEN** an authorized exact package whose manifest and contents match and which has no operational reference
- **WHEN** archival preflight completes
- **THEN** only that package is eligible and its historical audit references remain available

#### Scenario: Active or operationally referenced package
- **GIVEN** a selected, leased or recovery-dependent package, or an installed runnable entry that still requires its original location
- **WHEN** archival is requested
- **THEN** archival is blocked before any package moves and the active service remains unchanged

#### Scenario: Changed or unreadable evidence
- **GIVEN** a package with mismatched contents or unavailable privileged reference evidence
- **WHEN** preflight checks its retirement
- **THEN** it is rejected with a specific diagnostic and no alternative package is selected automatically

### Requirement: Reversible cold archive preserves recovery material
The foreground archiver SHALL preserve every byte, relative symbolic link and owner, permission, ACL and extended metadata by same-filesystem atomic directory relocation into an exact root-owned private archive. It SHALL retain original manifests, approvals and receipts in the authority, preserve the original runtime backup, and record original and archive locations with content identities and relocation progress. It SHALL verify relocated contents and support idempotent continuation or restoration without overwriting a foreign destination. It SHALL NOT delete package contents or run archived programs.

#### Scenario: Archive and restore a retired package
- **GIVEN** verified source content and an empty exact destination on the same filesystem
- **WHEN** authorized archival completes and a later authorized restore completes
- **THEN** the content and metadata return to the exact original location, the service and notification history are unchanged, and both operations have receipts

#### Scenario: Interrupted relocation
- **GIVEN** an operation interrupted after a package moved
- **WHEN** the operator resumes using its exact recorded inventory
- **THEN** the system recognizes the verified source or destination without repeating a move or overwriting a foreign package

#### Scenario: Conflicting destination or failed verification
- **GIVEN** a foreign destination, different filesystem or failed post-relocation verification
- **WHEN** the archive operation checks or moves its allowlisted packages
- **THEN** it stops, restores completed moves when their exact identities permit restoration, and reports any unresolved recovery without touching the service or selecting another package

### Requirement: Preserve update capacity and external-effect boundaries
Archival SHALL leave the existing 4 GiB managed-authority update limit and the 4 GiB plus candidate free-space requirement unchanged. It SHALL report actual managed, archive and projected update bytes separately. The example allowlist releases 1,110,418,723 bytes from a measured authority of 4,823,534,781 bytes; adding the 373,645,288-byte candidate then projects 4,086,761,346 bytes. Fresh measurements SHALL replace this estimate at execution. Archival SHALL NOT adopt a runtime, restart a service, modify a job or notification ledger, or send a message. Restoring a previously over-budget state SHALL explicitly report that subsequent updates remain blocked by the unchanged limit.

#### Scenario: Planned capacity after archival
- **GIVEN** the measured authority and candidate sizes above and all three allowlisted packages remain eligible
- **WHEN** archival completes and usage is measured again
- **THEN** projected update usage is at most 4,294,967,296 bytes, cold archive usage is reported separately and runtime adoption still requires its existing managed flow

#### Scenario: Exact capacity boundary
- **GIVEN** a post-archive projected update of exactly 4,294,967,296 bytes or one byte more
- **WHEN** capacity readiness is evaluated
- **THEN** the exact boundary is eligible and one byte more is blocked without changing the limit or archiving another package

#### Scenario: Archived state needs restoration
- **GIVEN** a later authorized restore returns the authority to its original over-budget inventory
- **WHEN** restoration completes
- **THEN** original identities are preserved and the report explicitly states that managed updates remain blocked until capacity is resolved
