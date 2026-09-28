# github-owner-access Specification

## Purpose

TBD - created by archiving change 'publishing-cms'. Update Purpose after archive.

## Requirements

### Requirement: Immutable owner allowlist
The Worker SHALL authenticate through GitHub OAuth, compare the returned immutable GitHub user ID against the configured owner allowlist, and reject every other identity.

#### Scenario: Unauthorized GitHub user
- **WHEN** an authenticated GitHub user ID is not in the owner allowlist
- **THEN** the Worker returns `FORBIDDEN`, creates no authorized CMS session, and the Admin does not reveal repository content

---
### Requirement: Secure CMS sessions
Authorized login SHALL create a server-managed session whose cookie is HttpOnly, Secure, and SameSite, with OAuth state and state-changing request protection.

#### Scenario: Owner session
- **WHEN** the allowed owner completes a valid OAuth callback
- **THEN** the Worker creates a bounded session and `/api/v1/auth/session` returns the owner identity without exposing GitHub installation credentials

---
### Requirement: Least-privilege GitHub App boundary
The GitHub App SHALL be restricted to `gcake119/gcake-dev` and SHALL initially use Metadata Read, Contents Read/Write, and Actions Read; browser JavaScript SHALL NOT receive installation tokens.

#### Scenario: Read-only UI phase
- **WHEN** Phase 1 reads posts, series, or deployment state
- **THEN** the UI performs no content write and requires no Actions Write permission

---
### Requirement: Repository-derived content browsing
The content and series APIs SHALL read current files from GitHub and return source plus blob/commit revision metadata without storing an editable article copy in D1.

#### Scenario: Owner browses current content
- **WHEN** the authorized owner opens the article list and an article
- **THEN** the Admin displays repository-derived metadata/source and the response includes base SHAs for later concurrency checks

---
### Requirement: Deployment observation is not publication proof
The CMS SHALL display GitHub Actions/Pages run status, commit SHA, timestamps, URL, and failure state separately from content-save state.

#### Scenario: Commit exists while deployment runs
- **WHEN** Git contains a saved revision whose Pages workflow is pending
- **THEN** the UI reports “saved to Git” and deployment pending without claiming the article is publicly deployed
