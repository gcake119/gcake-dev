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

---
### Requirement: Safe development bindings
Cloudflare development configuration SHALL bind local or preview resources separately from production resources, production SHALL bind dedicated D1 and R2 resources, and all external publication write flags SHALL default to disabled.

#### Scenario: Missing production secrets
- **WHEN** the Admin and Worker run in the documented local development environment without production secrets
- **THEN** foundation features and health checks work while provider write operations remain unavailable

#### Scenario: Production environment selected
- **WHEN** an operator deploys the Worker with the production environment
- **THEN** Wrangler selects dedicated production D1 and R2 bindings while Substack writes remain disabled

---
### Requirement: Public-site regression boundary

Introducing the Admin workspace and complete Series CRUD SHALL preserve existing public Astro content routes, filtering, search, RSS, theme behavior, and build output semantics. Renamed series SHALL generate only the new series route. Deleted-series posts SHALL remain in the general post collection without series navigation or broken series references.

#### Scenario: Existing Astro verification

- **WHEN** the Series CRUD changes are applied
- **THEN** the Astro test, check, content validation, and build commands pass without requiring Admin deployment

#### Scenario: Build after series rename

- **WHEN** a manifest identity changes from `old-series` to `new-series`
- **THEN** the public build emits the `new-series` route and emits no `old-series` route or navigation reference

#### Scenario: Build after populated series deletion

- **WHEN** a local series manifest is removed while its post Markdown remains
- **THEN** the public build succeeds, those posts remain in the general article list, and they render without series navigation


<!-- @trace
source: complete-series-crud
updated: 2026-10-16
code:
  - apps/admin-worker/src/release-queue.ts
  - apps/admin-worker/src/router.ts
  - src/lib/content/catalog.ts
  - apps/admin-worker/src/git-writes.ts
  - packages/admin-contract/src/index.ts
  - apps/admin-worker/src/release-delivery.ts
  - docs/worktree-closeout/2026-10-16/README.md
  - apps/admin/src/series-editor.ts
  - apps/admin-worker/src/series-validation.ts
  - src/lib/content/series-membership.ts
  - docs/publishing-cms-implementation-design.md
  - package.json
  - apps/admin/src/admin.css
  - apps/admin/src/App.vue
  - apps/admin-worker/src/github.ts
tests:
  - apps/admin-worker/src/release-queue.test.ts
  - packages/admin-contract/src/contract.test.ts
  - apps/admin-worker/src/git-writes.test.ts
  - apps/admin/src/series-editor.test.ts
  - src/lib/content/series-membership.test.ts
  - apps/admin-worker/src/series-validation.test.ts
  - apps/admin-worker/src/content-routes.test.ts
  - apps/admin/src/post-series.test.ts
  - scripts/workspace/public-visibility.test.ts
  - apps/admin-worker/src/github.test.ts
  - apps/admin-worker/src/save-routes.test.ts
  - apps/admin/src/foundation.test.ts
-->

---
### Requirement: Ollama remains outside hosted runtimes

The Cloudflare Worker and public Astro site SHALL NOT call or depend on Ollama; local slug generation SHALL run as a separately started loopback helper used only by the Publishing Admin.

#### Scenario: Build hosted runtimes without Ollama

- **WHEN** Admin, Worker, and public-site tests and builds run without Ollama
- **THEN** all hosted runtime verification succeeds and normal article editing remains available

#### Scenario: Public site serves content

- **WHEN** a visitor loads the public site while the local helper is stopped
- **THEN** public routes render without attempting any local AI request

---
### Requirement: Complete Series CRUD runtime

The Admin and Worker SHALL expose authenticated, CSRF-protected create, update, rename, and delete operations for repository-backed series manifests. The Admin SHALL use the existing visual tokens, responsive layout, focus behavior, and explicit labels.

#### Scenario: Use lifecycle operations from the Series workspace

- **WHEN** the authenticated owner opens the Series workspace
- **THEN** the owner can create a series, edit its name or slug, and start a clearly labeled delete flow without leaving the Admin

#### Scenario: Mutation lacks authentication or CSRF proof

- **WHEN** a caller invokes a Series mutation without an authenticated session or valid CSRF token
- **THEN** the Worker rejects the request before invoking a repository write

<!-- @trace
source: complete-series-crud
updated: 2026-10-16
code:
  - apps/admin-worker/src/release-queue.ts
  - apps/admin-worker/src/router.ts
  - src/lib/content/catalog.ts
  - apps/admin-worker/src/git-writes.ts
  - packages/admin-contract/src/index.ts
  - apps/admin-worker/src/release-delivery.ts
  - docs/worktree-closeout/2026-10-16/README.md
  - apps/admin/src/series-editor.ts
  - apps/admin-worker/src/series-validation.ts
  - src/lib/content/series-membership.ts
  - docs/publishing-cms-implementation-design.md
  - package.json
  - apps/admin/src/admin.css
  - apps/admin/src/App.vue
  - apps/admin-worker/src/github.ts
tests:
  - apps/admin-worker/src/release-queue.test.ts
  - packages/admin-contract/src/contract.test.ts
  - apps/admin-worker/src/git-writes.test.ts
  - apps/admin/src/series-editor.test.ts
  - src/lib/content/series-membership.test.ts
  - apps/admin-worker/src/series-validation.test.ts
  - apps/admin-worker/src/content-routes.test.ts
  - apps/admin/src/post-series.test.ts
  - scripts/workspace/public-visibility.test.ts
  - apps/admin-worker/src/github.test.ts
  - apps/admin-worker/src/save-routes.test.ts
  - apps/admin/src/foundation.test.ts
-->