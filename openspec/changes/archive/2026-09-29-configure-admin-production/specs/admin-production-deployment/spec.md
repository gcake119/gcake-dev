## ADDED Requirements

### Requirement: Production resources are isolated

The Admin Worker SHALL use a production D1 database and production R2 bucket that are distinct from preview resources.

#### Scenario: Deploy production Worker

- **GIVEN** the preview resources remain configured
- **WHEN** an operator deploys the production environment
- **THEN** the Worker binds only the production D1 database and production R2 bucket

### Requirement: Production schema precedes runtime deployment

The deployment process MUST apply every committed Admin Worker D1 migration before deploying production code.

#### Scenario: Migration succeeds

- **WHEN** all production migrations apply successfully
- **THEN** deployment continues to build and publish the Worker

#### Scenario: Migration fails

- **WHEN** any production migration fails
- **THEN** deployment stops before publishing a new Worker version

### Requirement: Production deployment is credential-safe

Cloudflare deployment credentials and the GitHub App private key MUST remain outside tracked repository files.

#### Scenario: CI credential missing

- **WHEN** a required Cloudflare GitHub Actions secret is absent
- **THEN** the workflow fails without attempting a production deployment

### Requirement: Production health is verified

The deployment process SHALL verify the deployed Worker health endpoint after publication.

#### Scenario: Healthy deployment

- **WHEN** production deployment completes
- **THEN** `GET /health` returns HTTP 200 and identifies `gcake-admin-worker`

#### Scenario: Admin deployment fails

- **WHEN** the Admin Worker deployment or health verification fails
- **THEN** the independent public-site deployment remains available
