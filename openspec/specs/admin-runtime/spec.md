# admin-runtime Specification

## Purpose

TBD - created by archiving change 'publishing-cms'. Update Purpose after archive.

## Requirements

### Requirement: Independent workspace builds
The workspace SHALL provide independent build and test entry points for the existing Astro site, the Vue Admin, and the Cloudflare Worker, plus a root command that verifies all three without requiring production credentials.

#### Scenario: Build each runtime locally
- **WHEN** a developer runs the documented build command for each runtime from a clean checkout
- **THEN** Astro, Admin, and Worker produce their own build outputs without invoking external provider writes

---
### Requirement: Typed Worker health endpoint
The Worker SHALL expose `GET /health` with a shared contract that returns HTTP 200 and a JSON payload identifying service health and contract version.

#### Scenario: Local health check
- **WHEN** the local Worker receives `GET /health`
- **THEN** it returns the typed healthy payload without GitHub, R2, D1 production, Paragraph, or Substack credentials

---
### Requirement: Safe development bindings
Cloudflare development configuration SHALL bind local or preview resources separately from production resources, and all external publication write flags SHALL default to disabled.

#### Scenario: Missing production secrets
- **WHEN** the Admin and Worker run in the documented local development environment without production secrets
- **THEN** foundation features and health checks work while provider write operations remain unavailable

---
### Requirement: Public-site regression boundary
Introducing the Admin workspace SHALL preserve existing public Astro content routes, filtering, search, RSS, series navigation, theme behavior, and build output semantics.

#### Scenario: Existing Astro verification
- **WHEN** Phase 0 workspace changes are applied
- **THEN** the pre-existing Astro test, check, content validation, and build commands pass without requiring Admin deployment

---
### Requirement: Ollama remains outside hosted runtimes

The Cloudflare Worker and public Astro site SHALL NOT call or depend on Ollama; local slug generation SHALL run as a separately started loopback helper used only by the Publishing Admin.

#### Scenario: Build hosted runtimes without Ollama

- **WHEN** Admin, Worker, and public-site tests and builds run without Ollama
- **THEN** all hosted runtime verification succeeds and normal article editing remains available

#### Scenario: Public site serves content

- **WHEN** a visitor loads the public site while the local helper is stopped
- **THEN** public routes render without attempting any local AI request
