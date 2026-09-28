## Why

The existing Git-backed blog has durable content, series, scheduling, and provider-neutral publishing foundations, but routine publishing still requires direct repository work and lacks browser-based media, preview, conflict, and operational-state workflows. A personal Publishing CMS is needed now to make those workflows practical without weakening the repository, R2, and D1 ownership boundaries already approved.

## What Changes

- Add independently buildable Vue Admin and Cloudflare Worker packages with shared, versioned contracts and a local test harness.
- Add owner-only GitHub authentication and read-only repository/deployment access before enabling any content write operation.
- Add a source-oriented Markdown/MDX editor with one-button Markdown → Rendered → Split cycling, browser recovery, formal Git saves, and fail-closed optimistic concurrency.
- Add R2-backed media upload and management while keeping article references in Markdown and D1 metadata non-canonical.
- Add direct series-manifest editing and offset-aware `publishedAt` scheduling while preserving legacy date-only behavior.
- Add ephemeral formal Astro previews that never mutate `main` or canonical content.
- Move publication runtime state from transitional JSON to D1 without long-term dual writes, and expose revision-aware, failure-isolated target state.
- Keep Paragraph and Substack production writes disabled until their separate production gates are explicitly approved; Phase 7 may enable Paragraph only after that approval and provider verification.

## Capabilities

### New Capabilities

- `admin-runtime`: Independently buildable Admin and Worker foundations, shared contracts, health checks, Cloudflare bindings, and production-write feature gates.
- `github-owner-access`: Owner-only GitHub authentication, sessions, repository content reads, deployment observation, and least-privilege GitHub App behavior.
- `safe-content-editor`: Article creation/editing, one-button view cycling, immediate rendering, browser autosave, frontmatter editing, optimistic concurrency, coherent Git commits, and conflict recovery.
- `media-library`: R2 media upload, stable object URLs, metadata indexing, usage inspection, insertion, replacement, and guarded deletion.
- `series-scheduling`: Series-manifest editing, coherent multi-file writes, explicit Taipei date-time scheduling, and backward-compatible visibility semantics.
- `formal-astro-preview`: Expiring real-Astro previews of uncommitted drafts without writes to canonical production content.
- `publishing-operations`: D1-owned publication runs and target state, migration away from JSON, GitHub Pages observation, provider prepare/retry/verify workflows, and production gates.

### Modified Capabilities

(none)

## Impact

- Affected specs: `admin-runtime`, `github-owner-access`, `safe-content-editor`, `media-library`, `series-scheduling`, `formal-astro-preview`, `publishing-operations`
- Affected code:
  - New: `apps/admin/`, `apps/admin-worker/`, `packages/admin-contract/`, `packages/publishing-contract/`, `openspec/specs/`
  - Modified: `package.json`, `pnpm-lock.yaml`, `src/content.config.ts`, `src/lib/content/`, `src/lib/publishing/`, `scripts/publishing/`, `.github/workflows/`, `docs/`
  - Removed: `src/data/publishing/publication-state.json` only after the Phase 6 D1 migration acceptance gate
- External systems: GitHub OAuth/App/API, GitHub Actions/Pages, Cloudflare Pages/Workers/D1/R2, Paragraph, and Substack.
- Security and migration risk: authentication, repository writes, media validation, date-time visibility, runtime-state cutover, and irreversible provider/newsletter actions require fail-closed tests and explicit gates.
