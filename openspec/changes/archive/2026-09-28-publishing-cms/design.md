## Context

`gcake-dev` is an Astro static site whose Markdown/MDX posts, frontmatter, and YAML series manifests are the editorial source of truth. Existing code already provides published-only catalog filtering, Taipei calendar-day scheduling, a provider-neutral portable publication transform, disabled Paragraph/Substack adapters, and transitional target state in `src/data/publishing/publication-state.json`. The approved CMS adds a Vue Admin and Cloudflare Worker while preserving public-site behavior and allowing Codex or direct Git edits to continue in parallel.

The change crosses browser UI, Worker APIs, GitHub App/OAuth, GitHub Contents/Actions APIs, D1 migrations, R2 media, Astro preview builds, repository scheduling logic, and provider adapters. Repository content, R2 binaries, and D1 runtime state have separate ownership and SHALL NOT be copied into competing editable stores.

## Goals / Non-Goals

**Goals:**

- Deliver the approved Phase 0 through Phase 7 implementation in acceptance-gated increments.
- Preserve Git as the article/frontmatter/series SSOT, R2 as media SSOT, and D1 as operational/runtime SSOT.
- Provide source-oriented editing, exact preview, media, scheduling, safe Git commits, and target-state operations from a browser.
- Fail closed when repository revisions change and expose actionable conflict information.
- Preserve legacy date-only publication behavior while adding offset-aware publication instants.
- Keep Git save, Pages deployment, provider publication, verification, and newsletter delivery as distinct states and intents.

**Non-Goals:**

- Multi-user roles, a second editorial database, full WYSIWYG editing, analytics, comments, or built-in AI writing.
- Automatic Git merge in the first version.
- Preview commits on `main`.
- Substack production automation without a separately approved stable interface.
- Paragraph writes, test email, newsletter delivery, or other external irreversible operations before the Phase 7 production gate.

## Decisions

### Monorepo runtime separation and shared contracts

Create `apps/admin` for the Vue SPA, `apps/admin-worker` for the Worker API, and shared packages for API and publishing contracts. Root scripts orchestrate independent builds and tests while the existing Astro build remains independently executable. This keeps the public reading surface isolated from Admin runtime dependencies. A single mixed Astro/Worker runtime was rejected because it couples canonical static-site deployment to authenticated operational APIs.

### Explicit source-of-truth adapters

Repository reads and writes pass through a GitHub boundary, media binaries through an R2 boundary, and runtime state through D1 repositories. Shared contracts carry references and derived metadata, not editable duplicate article bodies. A D1 article-content table was rejected because it creates an ambiguous editorial owner.

### Owner-only authentication and least privilege

GitHub OAuth establishes identity; the Worker compares the immutable GitHub user ID with an allowlist and creates an HttpOnly, Secure, SameSite session. GitHub App installation tokens remain server-side and request Metadata Read, Contents Read/Write, and Actions Read only. Actions Write remains absent until workflow dispatch is explicitly implemented.

### SHA-based optimistic concurrency and coherent Git transactions

Post and series reads return blob and commit SHAs. Every formal write includes the expected blob SHA; multi-file operations build one tree and commit against an expected base commit. A mismatch returns a stable 409 error without writing. Automatic merge was rejected because silent or heuristic resolution can overwrite concurrent Codex changes.

### Source editor state and one-button view cycle

The Editor maintains repository base, browser working draft, and last committed version as distinct states. One control cycles `markdown → rendered → split → markdown`; split ratio and synchronized scrolling are preferences. Browser autosave keys include repository, slug, and base revision so recovery cannot be mistaken for a Git save. Three independent view tabs were rejected by the approved interaction contract.

### Immediate render versus formal Astro preview

Immediate preview uses the portable Markdown rendering path and shared content styles. Unsupported MDX constructs surface a limitation instead of a misleading approximation. Formal preview packages the working draft with its base revision into an isolated expiring build and never mutates canonical production content. Building Astro on every keystroke was rejected for latency and cost.

### Immutable R2 objects and non-canonical media index

Media keys use `posts/<slug>/<yyyy>/<mm>/<asset-id>-<sanitized-name>.<ext>`. Replacements create new objects; deletion requires a usage check. D1 stores searchable operational metadata and last-used alt/caption defaults, while Markdown remains authoritative for prose and URLs. Overwriting stable keys was rejected because caches and historical Git revisions would become ambiguous.

### Publication-time compatibility model

New CMS schedules serialize offset-aware ISO timestamps in Asia/Taipei. Parsing preserves whether the source was date-only: legacy dates become visible at Taipei calendar-day start, while date-times become visible at their exact instant. All public routes, catalogs, series, topics, RSS, search, and navigation consume one shared visibility predicate. Treating all parsed dates as UTC instants was rejected because it breaks existing date-only content.

### D1 publication-state cutover without dual writes

Phase 6 introduces D1 migrations and a one-time importer/compatibility reader for non-empty JSON state. Once the acceptance gate passes, publishing code reads and writes only D1 and the JSON file is removed in the same migration. A prolonged dual-write period was rejected because it creates two operational owners.

### Independent provider states and explicit production gates

Publication state is keyed by article, target, and source revision. Prepare, publish, verify, retry, and newsletter intent remain separate operations. Substack stays `manual_required` or `not_configured`. Paragraph production writes remain feature-gated off through Phase 6; Phase 7 requires explicit approval, pinned interface verification, dry run, idempotency protection by remote ID plus source revision, and public verification.

## Implementation Contract

### Phase delivery contract

Implementation proceeds in numbered phases. Each phase begins with failing tests for its observable contract, then implementation, then affected unit/integration/E2E checks, root `pnpm check`, root `pnpm build`, and applicable UI/design QA. A phase report SHALL distinguish local, Git, push, deployment, provider, human, and production evidence. Work SHALL stop after each phase report until the user continues.

### API and errors

The Worker exposes `/api/v1` JSON routes described by the approved implementation design. Success shapes use shared TypeScript schemas. Failures use `{ error: { code, message, details?, retryable? } }`, with stable codes including `UNAUTHENTICATED`, `FORBIDDEN`, `ARTICLE_CONFLICT`, `SERIES_CONFLICT`, `INVALID_FRONTMATTER`, `INVALID_SERIES`, `MEDIA_TOO_LARGE`, `MEDIA_TYPE_NOT_ALLOWED`, `PREVIEW_BUILD_FAILED`, and provider operation failures. User-facing messages are Traditional Chinese; provider diagnostics remain optional technical details.

### Phase 0 foundation

Root commands SHALL build the Astro site, Admin, and Worker independently and as a workspace. The Worker `/health` endpoint SHALL return a typed success payload locally without requiring production credentials. Local bindings SHALL use development resources, and provider-write feature flags SHALL default to disabled. Existing Astro tests and generated public behavior SHALL remain unchanged.

### Git, media, and runtime ownership

Formal content writes SHALL target only allowlisted repository paths and require expected SHAs. R2 SHALL contain media binaries addressed by stable public URLs. D1 SHALL contain sessions, preferences, media index metadata, preview jobs, synchronization observations, publication state, and audit events; it SHALL NOT be required to reconstruct article bodies, frontmatter, series order, or publication dates.

### Verification targets

Automated verification SHALL include unit tests for contracts and state logic, fake-boundary integration tests for GitHub/D1/R2/preview/provider orchestration, and browser E2E for approved user flows. UI QA SHALL cover desktop, mobile, light, dark, keyboard navigation, long Markdown, wide code, tables, images, dialogs, and split editing when those surfaces exist. External provider success SHALL require provider/public evidence and SHALL NOT be inferred from local tests.

## Risks / Trade-offs

- [Monorepo tooling changes break Astro] → Keep independent root scripts and compare existing Astro test/build behavior at every phase.
- [Concurrent CMS and Codex writes lose work] → Require blob/base revisions, return 409, and preserve browser drafts for manual recovery.
- [Date coercion erases legacy semantics] → Parse source representation explicitly and test Taipei boundary cases before changing consumers.
- [D1 becomes a hidden content store] → Limit schemas and API repositories to operational fields; add contract tests that content writes flow only through GitHub.
- [R2 deletion breaks historical articles] → Scan repository usage, warn/block used assets, and avoid automatic deletion during article removal.
- [Preview infrastructure mutates production] → Use ephemeral source packages/revisions, expiry, and cleanup; prohibit `main` preview commits.
- [Provider retry duplicates posts or newsletters] → Persist remote ID/source revision, separate newsletter intent, and fail closed when idempotency evidence is incomplete.
- [Substack automation is brittle] → Keep its adapter disabled/manual and independent of canonical or Paragraph publication.

## Migration Plan

1. Establish Phase 0 workspace, contracts, local bindings, health endpoint, and tests with all production writes disabled.
2. Add read-only auth/content/deployment access, then safe Git writes, media, scheduling, and preview in separate acceptance gates.
3. Add D1 publication tables and import existing non-empty JSON state without writing back to JSON.
4. Validate D1 reads/writes and remove JSON plus compatibility code in one Phase 6 cutover.
5. Keep provider writes off through Phase 6. Enable Paragraph in Phase 7 only after explicit approval and recorded provider verification.
6. Roll back any pre-provider phase by reverting its application commits and Cloudflare migration deployment independently. After D1 cutover, retain an export/backup of imported operational state for rollback; do not reintroduce dual writes.

## Open Questions

- The exact formal-preview execution provider is selected during Phase 5 from the approved priority order after a local feasibility spike; this does not change the preview contract.
- Paragraph production interface version and canonical/date/Arweave behavior remain Phase 7 gate evidence, not assumptions in earlier phases.
