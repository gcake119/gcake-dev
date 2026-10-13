## Purpose

Protect approved Hermes monitor runtime identity across local update and recovery without replacing notification history or touching production.

## ADDED Requirements

### Requirement: Approved immutable release identity
The local update manager SHALL accept a release only when its immutable manifest digest is explicitly approved and its entire program/runtime/wrapper payload matches the manifest. The manifest SHALL bind source identity, patch identity, Python version, dependency lock identity, runtime files and verification provenance, and contain no credentials or notification history. Unknown releases SHALL be skipped and retained once for review without stopping the active gateway. Unsafe paths, external links, corrupted manifests or altered approved payloads SHALL be blocked without execution or installation.

#### Scenario: Unknown release
- **GIVEN** a working active release and an unapproved candidate
- **WHEN** the scheduled update guard evaluates the candidate twice
- **THEN** the active service and notification history remain unchanged
- **AND** one review record is retained and no candidate program runs

#### Scenario: Approved release altered
- **GIVEN** approval for an exact release and a subsequently altered runtime file or unsafe payload path
- **WHEN** the guard checks eligibility
- **THEN** it blocks before stopping the active service or installing the candidate

### Requirement: Exclusive bounded update lifecycle
The manager SHALL serialize update, recovery and activation, check its owned workspace and disk budget, and require a successful drain before stopping a service. It SHALL avoid overlapping senders and preserve unrelated files. All testing SHALL use an isolated owned root; production roots and arbitrary manifest-supplied commands SHALL be rejected. Insufficient space, existing maintenance or failed drain SHALL preserve the active release. Temporary resources SHALL be owned, bounded and cleaned on success, failure, timeout and ordinary interruption, with failures reported.

#### Scenario: Maintenance overlaps or drain fails
- **GIVEN** another maintenance operation or an invocation that cannot drain
- **WHEN** a new update is requested
- **THEN** it does not kill the sender, remove another operation's lock or start a second sender

#### Scenario: Insufficient disk budget or forbidden destination
- **GIVEN** insufficient permitted space or a destination outside the isolated owned workspace
- **WHEN** a release update is requested
- **THEN** the update is blocked without changing active runtime or notification history

### Requirement: Verified installation and activation
The manager SHALL stage a verified payload and record durable recovery intent before switching the active runtime. It SHALL validate the exact installed release through the real gateway dispatch, execution occurrence context and a dry-run wrapper before activation. Initial live activation and restoration of previous live mode SHALL require explicit authority. Each managed monitor invocation SHALL reject a changed release, unresolved recovery or non-enabled mode with visible local failure, preserving notification history and performing no delivery. It SHALL not guess metadata or silently fall back to an unguarded sender.

#### Scenario: Verified release succeeds
- **GIVEN** an approved candidate with passing isolated tests and authorized activation policy
- **WHEN** its installed gateway and natural scheduled dry-run match the approved release
- **THEN** the requested allowed activation mode is recorded for that release only
- **AND** a success receipt is written after verification

#### Scenario: Live authority absent
- **GIVEN** an approved candidate without authority to restore live mode
- **WHEN** the update verification succeeds
- **THEN** its mode remains dry-run and no live activation is inferred from source approval

#### Scenario: Runtime drifts after activation
- **GIVEN** the active release is changed outside the approved update path
- **WHEN** the next managed wrapper starts
- **THEN** it returns a visible failure before observation or delivery and preserves notification state

### Requirement: Complete runtime recovery without history rollback
Failure after the old service is stopped SHALL restore its complete prior program, interpreter, dependencies and wrapper as one verified release, using durable recovery intent to avoid mixed versions. Latest job configuration, private environment, notification state and execution history SHALL remain outside the version payload and SHALL not be replaced by old backups. Restart shall verify the recovered release. A recovered update SHALL be reported as rolled back, not successful. An incompatible prior release or failed recovery SHALL leave the affected sender stopped and report recovery failure without unbounded restart or replay. Legacy recovery SHALL report its reduced monitoring capabilities.

#### Scenario: Candidate verification fails
- **GIVEN** a working prior release and candidate verification failure after installation
- **WHEN** the manager recovers
- **THEN** the prior interpreter, dependencies, program and wrapper are restored and verified
- **AND** newest sent and ambiguous delivery records remain without resend
- **AND** a later authorized new article can still be handled

#### Scenario: Interrupted switch is resumed
- **GIVEN** durable recovery intent and an interrupted partial runtime switch
- **WHEN** recovery is requested after the manager restarts
- **THEN** it restores a known complete release instead of starting mixed files
- **AND** preserves the current notification and job history

#### Scenario: Recovery fails
- **GIVEN** the prior release cannot be restored or verified
- **WHEN** recovery fails
- **THEN** the affected sender remains stopped and a recovery-failed receipt is retained
- **AND** it neither rebuilds notification history nor repeatedly restarts

### Requirement: Isolated evidence and teardown
The accepted local recovery evidence SHALL use Python 3.11.15, a self-contained interpreter and locked dependencies, full actual Hermes gateway/ticker dispatch, the managed wrapper and shared synthetic history. It SHALL include unknown skip, successful update, failed verification, interruption/recovery and failed recovery, with real runtime/dependency corruption detection. No production credential, job, state or platform connection SHALL be used. All owned gateway processes SHALL be reaped and disposable roots removed with evidence saved; retained release fixtures SHALL have explicit ownership and expiry.

#### Scenario: Successful or failed drill ends
- **GIVEN** owned isolated runtime and transport fixtures
- **WHEN** success, failure, timeout or interruption ends the drill
- **THEN** evidence identifies the outcome and all owned processes are reaped
- **AND** disposable runtime trees are removed with no production operation performed
