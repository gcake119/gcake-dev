## Purpose

Automatically rebuild the public static site after article schedules become due. Preserve completed external content and existing deployment safety boundaries.

## ADDED Requirements

### Requirement: Automatic Pages rebuild triggers
Pages SHALL rebuild on pushes to main and every hour at minute 37, and SHALL retain manual deployment.

#### Scenario: Due article without a new commit
- **GIVEN** an article marked published with an explicit Taipei publication time has been committed to main
- **WHEN** its publication time passes and the next hourly deployment succeeds
- **THEN** it is publicly readable without an additional commit or manual dispatch

#### Scenario: Main push
- **GIVEN** main contains a valid content change
- **WHEN** the change is pushed to main
- **THEN** a Pages build and deployment run is triggered

### Requirement: No early publication
The existing publication-time visibility rules SHALL remain authoritative and draft or ready articles SHALL remain private.

#### Scenario: Before and at the scheduled instant
- **GIVEN** a published article scheduled for 2026-10-15 09:00 Asia/Taipei
- **WHEN** a build occurs before that instant
- **THEN** the article is absent from public reading surfaces
- **WHEN** a build occurs at or after that instant
- **THEN** the article is eligible for public reading surfaces

### Requirement: Preserve completed external snapshot
Deployment SHALL validate and reuse the completed 30-article external snapshot without source requests and SHALL reject corrupt or incomplete content without falling back to 19 articles.

#### Scenario: Corrupt completed snapshot
- **GIVEN** the saved completed snapshot contains corrupted article content
- **WHEN** deployment validates that snapshot
- **THEN** deployment fails and the existing public site remains intact without source requests

### Requirement: Preserve protected deployment boundaries
Automatic deployment SHALL target main only, retain stale-artifact rejection, and SHALL NOT invoke Secret acceptance, platform distribution, or newsletter delivery.

#### Scenario: Protected branch acceptance
- **GIVEN** a manual Secret acceptance request on its designated reviewed branch
- **WHEN** the workflow evaluates that request
- **THEN** only the existing read-only acceptance path is eligible and no Pages deployment occurs

#### Scenario: Failed build or stale source
- **GIVEN** a failed build or a source revision superseded on main
- **WHEN** deployment attempts to publish the artifact
- **THEN** no artifact from that failed or stale run becomes the public site

### Requirement: Deployment lag is disclosed
Scheduling documentation SHALL describe publication as due-time filtering followed by a successful deployment, without a punctual delivery guarantee.

#### Scenario: Scheduler delay
- **GIVEN** a publication time has passed but the hourly run is delayed
- **WHEN** the owner checks the publication process
- **THEN** documentation identifies deployment as pending and does not promise that the article is already public
