## ADDED Requirements

### Requirement: Exact uncommitted Astro preview
Formal preview SHALL render the current working draft through the real Astro site configuration without first committing the draft to `main`.

#### Scenario: Preview unsaved MDX
- **WHEN** the owner requests Formal Astro Preview for an unsaved MDX draft
- **THEN** the resulting preview includes real site CSS, MDX behavior, responsive layout, TOC, and series navigation while `main` remains unchanged

### Requirement: Revision-bound isolated source
Every preview request SHALL identify the repository base revision and draft hash and SHALL build from an isolated ephemeral source package or revision.

#### Scenario: Base revision no longer current
- **WHEN** preview orchestration detects that required repository inputs cannot be reconstructed from the requested base
- **THEN** the preview fails with an actionable `PREVIEW_BUILD_FAILED` diagnostic and does not substitute current production content silently

### Requirement: D1 preview lifecycle
D1 SHALL track preview status as `queued`, `running`, `ready`, `failed`, or `expired`, including source revision, URL, error, timestamps, and expiry.

#### Scenario: Successful lifecycle
- **WHEN** a preview build progresses successfully
- **THEN** its D1 state transitions from queued to running to ready with an expiring preview URL

### Requirement: Expiry and cleanup
Preview URLs and artifacts SHALL expire and cleanup SHALL remove temporary build material without deleting canonical repository or R2 content.

#### Scenario: Expired preview
- **WHEN** the configured preview lifetime ends
- **THEN** the preview becomes unavailable, its state is `expired`, and temporary artifacts are eligible for cleanup

### Requirement: No canonical preview mutation
Formal preview SHALL NOT create commits on `main`; any temporary branch SHALL be namespaced, automatically cleaned up, and excluded from editorial ownership.

#### Scenario: Inspect repository after preview
- **WHEN** a formal preview completes or fails
- **THEN** the canonical branch contains no preview commit and content history is unchanged
