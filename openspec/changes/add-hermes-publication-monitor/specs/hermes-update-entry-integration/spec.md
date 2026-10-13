## Purpose

Define an isolated update entry that separates installation authority from gateway execution and recovers interrupted supervisor transitions without replaying notifications. Qualify its production-oriented contract locally without operating production services.

## ADDED Requirements

### Requirement: Authority and runner permission separation
The entry SHALL permit only the installation authority to approve, seal, select or recover releases. The runner SHALL read non-secret identity and hold read-only shared invocation leases, without writing authority records or changing delivery authorization. Sealed release contents SHALL be immutable to the runner. Unsafe ownership, writable control paths, symlinks at control boundaries or altered approved contents SHALL block before execution. Actual root/hermes evidence SHALL be distinguished from same-UID fixtures.

#### Scenario: Runner reads but cannot change authority
- **GIVEN** an authority-owned release and read-only runner access
- **WHEN** the runner reads identity and attempts to change approval or active mode
- **THEN** reading succeeds and modification is denied
- **AND** the approved identity and mode remain unchanged

#### Scenario: Running invocation excludes maintenance
- **GIVEN** a runner invocation holding a shared lease
- **WHEN** an update attempts exclusive maintenance
- **THEN** the update is blocked without stopping the service
- **AND** the invocation and latest history remain intact

#### Scenario: Writable or redirected authority
- **GIVEN** a control boundary with wrong ownership, write permission or redirection
- **WHEN** the entry or runner checks eligibility
- **THEN** it refuses execution and leaves notification history untouched

### Requirement: Fixed isolated supervisor mapping
The adapter SHALL allow only the owned isolated test service and reviewed executable/working-directory/environment mapping. The renderer SHALL preserve hermes runner identity and explicit isolated HOME/HERMES_HOME. No production service label, path, arbitrary hook or shell command SHALL execute. Unknown releases SHALL retain one review item without supervisor calls. Duplicate supervisor instances or unresolved maintenance SHALL prevent gateway dispatch and platform loading.

#### Scenario: Unknown release preserves supervisor
- **GIVEN** a running release and an unapproved newer candidate
- **WHEN** scheduled and manual entries inspect it repeatedly
- **THEN** they keep the running release and retain one review item
- **AND** no stop or start is requested

#### Scenario: Unsafe supervisor target
- **GIVEN** a production label, foreign path or candidate-supplied command
- **WHEN** the adapter is constructed or installation begins
- **THEN** the request is refused before any supervisor operation

#### Scenario: Verified candidate starts once
- **GIVEN** a sealed approved candidate and a drained isolated supervisor
- **WHEN** the adapter starts the candidate in dry-run
- **THEN** exactly one expected runner starts with its pinned version and isolated home
- **AND** live mode requires independent explicit authorization

### Requirement: First entry backup and verified restoration
Before stopping the old service, the entry SHALL persist original entry/launcher/wrapper settings and their contents, ownership and mode. ACL metadata SHALL be preserved by the platform copy operation and checked in the owner drill. First-entry changes SHALL be journaled before each replacement. Failure SHALL restore the original settings and complete prior release, not a mixture. External latest jobs, configuration, execution ledger and notification history SHALL never be overwritten by software rollback.

#### Scenario: First replacement fails
- **GIVEN** original entry and wrapper settings with recoverable permissions
- **WHEN** any first replacement fails after stopping the service
- **THEN** their original bytes and permissions and the complete old release are restored
- **AND** only the old supervisor starts after verification
- **AND** latest sent and uncertain history remains without replay

### Requirement: Durable interrupted supervisor recovery
The entry SHALL write durable intent before stopping or selecting a release. A fresh entry SHALL recover unfinished work before accepting an update. A committed selection SHALL not be undone by receipt failure. Recovery failure SHALL persist a maintenance gate and stop the affected sender; subsequent updates SHALL refuse without retry loops. A launcher SHALL wait without loading platforms during unresolved maintenance, including a recreated volatile lock after reboot. Recovery SHALL validate target service and identity rather than kill a remembered or reused PID.

#### Scenario: Interrupted at a switch boundary
- **GIVEN** an abrupt interruption before or after each entry replacement, stop, selection or verification boundary
- **WHEN** a fresh controller opens the saved maintenance state
- **THEN** it restores and verifies the old complete release and original settings
- **AND** no mixed release or second sender starts

#### Scenario: Recovery itself fails
- **GIVEN** both candidate and old release verification fail
- **WHEN** recovery is attempted
- **THEN** the sender remains stopped and recovery failure is durable
- **AND** a later update performs no restart or notification replay

#### Scenario: Receipt fails after commit
- **GIVEN** a verified release already committed
- **WHEN** recording the completion receipt fails
- **THEN** the active verified selection remains committed
- **AND** the entry reports a receipt error without claiming rollback

### Requirement: Privileged isolated drill and teardown
The owner-run drill SHALL use a unique root-owned temporary workspace, existing hermes UID, dedicated test service label, isolated home, secret-free probes and a network-denying sandbox. It SHALL not change accounts or production plists/jobs, execute the production updater, read production credentials or contact Telegram. Evidence SHALL include real write denials, shared-lock behavior, actual isolated launchd start/stop and fresh-process recovery. One lifecycle driver SHALL preserve evidence and remove only its owned service and temporary files on success, failure, timeout and ordinary interruption; incomplete cleanup SHALL report failure. Pending owner execution SHALL not be reported as passed.

#### Scenario: Owner drill completes or fails
- **GIVEN** the owner launches the hash-bound isolated drill
- **WHEN** success, failure, timeout or ordinary interruption occurs
- **THEN** necessary sanitized evidence is saved
- **AND** the owned test service and disposable workspace are removed or cleanup failure is reported
- **AND** production services and files remain unchanged

### Requirement: Combined privileged full gateway qualification
The combined drill SHALL launch the actual self-contained Python 3.11.15 Hermes CLI through its owned test LaunchDaemon as the existing hermes user, with root-owned approved immutable releases and runner-owned isolated state. It SHALL use the same guarded wrapper, naturally dispatched test job and durable occurrence history across update and recovery. Version, actual UID, interpreter location, supervisor identity and original scheduled time SHALL agree for each verified round. TCP and production home access SHALL remain denied; notification transport SHALL be fixture-only. Separate probe results SHALL not substitute for this combined evidence.

#### Scenario: Full gateway and wrapper share the approved context
- **GIVEN** a complete approved isolated runtime and a due test schedule
- **WHEN** root starts the test LaunchDaemon and hermes dispatches the wrapper
- **THEN** the running gateway uses Python 3.11.15 and the approved release
- **AND** its actual user, supervisor identity and original scheduled time match the completed test round
- **AND** dry-run leaves notification history unchanged

#### Scenario: Software recovery preserves notification uncertainty
- **GIVEN** the isolated old state contains sent, uncertain and baseline articles plus a lost notification acknowledgement
- **WHEN** the full privileged gateway updates, is interrupted and recovers in a new controller process
- **THEN** those notification outcomes remain and no prior article is resent
- **AND** one later new article is handled once through fixture transport

#### Scenario: Exclusive verification permits only read-only work
- **GIVEN** root holds exclusive maintenance while verifying the new release
- **WHEN** its real hermes wrapper runs a scheduled dry-run
- **THEN** it completes against the selected approved release without modifying state
- **AND** live work, a wrong selection or an abandoned verification permit is refused

#### Scenario: Full gateway fails or cannot recover
- **GIVEN** failed candidate verification or interruption at a stopped, selected or verified boundary
- **WHEN** a fresh controller recovers the saved transaction
- **THEN** it starts only the verified old complete runtime and preserves latest state
- **AND** failed recovery keeps the sender stopped with durable evidence

#### Scenario: Combined drill ends
- **GIVEN** the root-owned controller and hermes-owned full gateway are isolated
- **WHEN** success, failure, timeout or ordinary interruption ends verification
- **THEN** sanitized evidence is saved and owned controller children, launchd service and disposable runtime are removed
- **AND** cleanup failures are visible without touching production

### Requirement: Authorized fixed production rollout
The production installer SHALL operate only the explicitly authorized existing gateway, update entry and monitor wrapper using fixed paths and labels. It SHALL compare fresh source, runtime, slot and permission identities before any service stop. It SHALL keep isolated adapters restricted to their test roots. Root SHALL execute only pinned installation controls; candidate gateway and monitor code SHALL execute as hermes. The installer SHALL reject drift, writable authority boundaries, unknown releases and insufficient disk space without stopping the current gateway.

#### Scenario: Reviewed baseline is current
- **GIVEN** explicit production rollout authority and a fresh matching baseline
- **WHEN** the installer prepares the approved release
- **THEN** the release is sealed read-only to hermes and only the existing gateway is selected for maintenance
- **AND** private configuration and notification history remain outside the release

#### Scenario: Production baseline drifted
- **GIVEN** the reviewed baseline differs from a current file, runtime, permission or supervisor
- **WHEN** installation is requested
- **THEN** installation is blocked before stopping the current gateway
- **AND** no production slot or notification state is replaced

#### Scenario: Reviewed interpreter alias retains the same version
- **GIVEN** the freshly reviewed interpreter alias points to the approved Python 3.11.15 runtime under the existing hermes account
- **WHEN** the owner prepares installation and preserves the original runtime
- **THEN** the approved alias is accepted and the complete runtime and original alias identity are retained for recovery
- **AND** a different version, changed target or unsafe permission blocks installation before stopping the gateway

### Requirement: Durable first production installation recovery
Before changing production slots, the installer SHALL preserve exact originals and their ownership, modes, ACLs and hashes in a root-private first-install backup. The original runtime SHALL remain usable at its original absolute path. Maintenance SHALL exclude concurrent updater and sender work and stop only the existing supervisor after bounded drain. Each replacement SHALL have durable recovery intent. Recovery SHALL restore original slots or the previous complete managed runtime, retain latest notification history and validate before restarting. Failed recovery SHALL stop the affected sender and retain a visible recovery-required receipt.

#### Scenario: First installation is interrupted
- **GIVEN** preserved originals and a partially applied first installation
- **WHEN** the owner invokes recovery after interruption
- **THEN** original entry, launcher, supervisor and wrapper are restored with matching identities
- **AND** the latest sent and uncertain notification outcomes remain unchanged

#### Scenario: Recovery cannot be verified
- **GIVEN** installation failed and the previous runtime cannot pass verification
- **WHEN** recovery is attempted
- **THEN** the sender remains stopped and recovery failure is reported without repeated restarts

### Requirement: Production verification before job activation
The new production monitor SHALL remain dry-run until its authenticated read-only summary, preserved state, original scheduled context and managed runtime are verified through the existing gateway. Missing or invalid summary configuration SHALL block activation without inventing commitment times or erasing history. Production qualification SHALL not send a Telegram test message. The existing monitor job SHALL be modified only after verification, retaining its identity and hourly interval. Commit and push SHALL follow passing required checks and verified operation, and SHALL exclude secrets, private backups and runtime payloads.

#### Scenario: Production dry-run qualifies
- **GIVEN** a verified release, valid restricted summary configuration and the existing monitor job
- **WHEN** the restarted gateway naturally dispatches its dry-run wrapper
- **THEN** the original scheduled context matches that execution and notification state is unchanged
- **AND** the qualification receipt permits the subsequent authorized existing-job update

#### Scenario: Summary configuration is missing
- **GIVEN** the new monitor lacks its summary URL or restricted read credential
- **WHEN** production activation is requested
- **THEN** activation is blocked with a visible prerequisite error
- **AND** no test notification, invented commitment or history reset occurs

#### Scenario: Unknown version reaches the update entry
- **GIVEN** an unapproved candidate or no approved successor
- **WHEN** the existing update schedule runs
- **THEN** the current gateway remains running and the unknown candidate is retained once for review
- **AND** no update from a moving branch is executed
