## 0. Phase 0 — Repository preparation

- [x] 0.1 Implement **Monorepo runtime separation and shared contracts** plus **Independent workspace builds** by adding the Admin, Worker, and shared-contract workspace skeletons with root orchestration; verify with package-level tests and independent Admin/Worker/Astro build commands.
- [x] 0.2 Test-drive the **Typed Worker health endpoint** and shared response schema so local `GET /health` returns HTTP 200 without production credentials; verify with Worker unit/integration tests and a local request assertion.
- [x] 0.3 Configure **Safe development bindings**, **Explicit source-of-truth adapters**, and the **Phase 0 foundation** so local D1/R2 stubs are separate from production and Paragraph/Substack write flags default off; verify configuration tests and a failed-closed provider-write assertion.
- [x] 0.4 Enforce the **Public-site regression boundary**, **Phase delivery contract**, and **Verification targets** by running the existing full `pnpm test`, `pnpm check`, `pnpm build`, content validation, and `git diff --check`, then record that no external write, deployment, or provider acceptance occurred.

## 1. Phase 1 — GitHub authentication and read-only content

- [x] 1.1 Test-drive **Immutable owner allowlist**, **Secure CMS sessions**, and **Owner-only authentication and least privilege** with OAuth-state, cookie, CSRF, authorized-owner, and rejected-user tests; verify mocked OAuth integration and unauthorized browser E2E.
- [x] 1.2 Implement the **Least-privilege GitHub App boundary** with server-only installation tokens and the approved repository/permission scope; verify contract tests prove browser responses contain no token and read-only UI paths invoke no write API.
- [x] 1.3 Implement **Repository-derived content browsing** for posts and series with blob/commit SHAs and no D1 article copy; verify fake-GitHub integration tests and owner article-list/source E2E.
- [x] 1.4 Implement **Deployment observation is not publication proof** for Actions/Pages state; verify UI E2E distinguishes saved Git, pending/building, deployed, and failed states.
- [x] 1.5 Apply the shared **API and errors** contract to Phase 1 routes with stable codes and Traditional Chinese user messages; verify response-schema tests, `pnpm check`, `pnpm build`, and desktop/mobile light/dark keyboard QA.

## 2. Phase 2 — Editor and safe Git writes

- [x] 2.1 Test-drive **Source editor state and one-button view cycle** plus **Single cyclic view control** so Markdown → Rendered → Split → Markdown preserves source and position; verify component tests and browser E2E covering one full cycle.
- [x] 2.2 Implement **Resizable synchronized split view** with a default 50/50 keyboard-operable divider, persisted ratio, default sync scroll, and opt-out; verify component tests and pointer/keyboard E2E.
- [x] 2.3 Implement **Honest immediate rendering** and the immediate side of **Immediate render versus formal Astro preview** with shared public content styles and explicit MDX limitations; verify Markdown fixture tests plus long-text, wide-code, table, image, light/dark visual QA.
- [x] 2.4 Test-drive **Revision-keyed browser recovery** for repository base, working draft, and last committed state; verify refresh recovery and changed-base conflict E2E prove autosave is never presented as Git save.
- [x] 2.5 Implement **SHA-based optimistic concurrency and coherent Git transactions**, **Optimistic concurrency on formal saves**, and **Coherent repository commits** with expected SHA/base commit checks; verify fake-GitHub tests return 409 without writes and multi-file success produces one commit.
- [x] 2.6 Implement conflict diff/reload/copy/manual recovery and **Guarded destructive deletion**; verify article-conflict, series-conflict, referenced-delete, and explicit-confirmation E2E.
- [x] 2.7 Complete Phase 2 regression and UI gates with affected unit/integration/E2E suites, `pnpm check`, `pnpm build`, and desktop/mobile light/dark keyboard Editor QA.

## 3. Phase 3 — Media

- [x] 3.1 Test-drive **Immutable R2 objects and non-canonical media index**, **R2 media ownership**, and **Immutable replacement** with deterministic unique keys and stable URLs; verify key-generation, replacement, and historical-URL tests.
- [x] 3.2 Implement the **Validated upload path** for paste, drag, and picker flows with client processing plus Worker auth/MIME/size/key validation; verify allowed WebP/PNG/SVG cases and rejected type/oversize integration tests without partial R2/D1 writes.
- [x] 3.3 Implement **Operational media index** under the **Git, media, and runtime ownership** boundary; verify D1 tests persist only operational metadata and Markdown remains authoritative for article alt/caption text.
- [x] 3.4 Implement **Usage-aware media management** for search, preview, insert, copy URL, replace, usage scan, unused detection, and guarded deletion; verify used/unused asset integration tests and Media Library E2E.
- [x] 3.5 Complete Phase 3 gates with affected tests, `pnpm check`, `pnpm build`, and desktop/mobile light/dark keyboard QA of paste/upload/grid/dialog/Markdown insertion flows.

## 4. Phase 4 — Series and scheduling

- [x] 4.1 Test-drive **Series manifests remain canonical** and **Series validation before commit** with drag ordering as uncommitted UI state and YAML-only canonical writes; verify duplicate IDs/posts, missing Markdown, invalid pointers, and successful reorder tests.
- [x] 4.2 Implement **Publication-time compatibility model**, **Offset-aware CMS scheduling**, and **Legacy date-only compatibility** with representation-aware parsing and explicit `+08:00` serialization; verify before/exact/after, Taipei midnight, DST independence, invalid date, and undated cases.
- [x] 4.3 Migrate every public consumer to the **Shared public visibility predicate** without changing unrelated rendering; verify article route, catalog, series, topics, RSS, search, and navigation tests exclude one future timed fixture consistently.
- [x] 4.4 Implement **Deployment-lag disclosure** in scheduling UI and coherent article-plus-series saves; verify E2E distinguishes scheduled, due-awaiting-build, and deployed-visible states.
- [x] 4.5 Complete Phase 4 gates with affected tests, `pnpm check`, `pnpm build`, and desktop/mobile light/dark keyboard Series/Scheduling QA.

## 5. Phase 5 — Formal Astro preview

- [x] 5.1 Run a bounded feasibility spike for the formal-preview execution provider and record the approved priority-order choice without changing the **Exact uncommitted Astro preview** contract; verify the spike builds an unsaved fixture through real Astro without touching `main`.
- [x] 5.2 Implement **Revision-bound isolated source** and **No canonical preview mutation** with base revision, draft hash, isolated source material, and namespaced cleanup; verify Git assertions show no canonical commit on success or failure.
- [x] 5.3 Implement **D1 preview lifecycle** plus **Expiry and cleanup** for queued/running/ready/failed/expired states and expiring URLs; verify state-transition integration tests and expiry cleanup tests.
- [x] 5.4 Complete the formal side of **Immediate render versus formal Astro preview** with actionable failure UI; verify MDX/Vue/site-CSS/TOC/series-navigation E2E and failed-build recovery.
- [x] 5.5 Complete Phase 5 gates with affected tests, `pnpm check`, `pnpm build`, preview cleanup evidence, and desktop/mobile light/dark keyboard QA.

## 6. Phase 6 — Publishing Center and D1 migration

- [x] 6.1 Test-drive **D1 publication-state cutover without dual writes**, **D1 owns publication runtime state**, and migrations for runs/attempts/targets; verify migration/repository tests and an assertion that article/frontmatter fields are absent from D1 ownership.
- [x] 6.2 Implement **One-time JSON migration without dual writes** by importing non-empty legacy state, accepting D1, then removing `src/data/publishing/publication-state.json` and compatibility code together; verify fixture import, idempotent rerun, D1-only write, and removed-file tests.
- [x] 6.3 Implement **Independent provider states and explicit production gates**, **Revision-aware independent target states**, **Explicit publication operations**, and **Failure isolation**; verify state-machine tests for stale revisions and per-target prepare/publish/verify/retry failures.
- [x] 6.4 Implement **Disabled Substack production path** and Paragraph prepare-only UI so Substack is manual/not-configured and provider writes remain off; verify integration/E2E proves Git save and retry cannot produce external writes.
- [x] 6.5 Implement **Auditable safe operations** for bounded auth/Git/series/media/preview/conflict/publication events; verify audit tests reject secrets, tokens, and full article bodies.
- [x] 6.6 Complete Phase 6 gates with affected tests, `pnpm check`, `pnpm build`, Publishing Center UI QA, migration backup/rollback evidence, and an explicit no-JSON/D1-dual-write assertion.

## 7. Phase 7 — Paragraph production gate

- [x] 7.1 Keep the **Paragraph production gate** blocked until the user explicitly approves and evidence pins a supported interface with verified create/update/publish/canonical/date/retry/public-read behavior; verify a gate test fails closed for every missing prerequisite.
- [x] 7.2 After approval, implement Paragraph create/update/publish around persisted remote ID plus source revision and dry-run-first behavior; verify non-production provider contract tests and controlled provider evidence without newsletter delivery.
- [x] 7.3 Implement **Newsletter idempotency boundary** as a separate explicit irreversible intent that ordinary updates/retries cannot repeat; verify state-machine and provider-boundary tests for already-sent newsletters.
- [x] 7.4 Verify public result and remote ID/URL persistence before marking Paragraph verified; verify a controlled production cohort result, failure isolation, and retry behavior without inferring success from API response alone.
- [x] 7.5 Complete Phase 7 gates with affected tests, `pnpm check`, `pnpm build`, Publishing Center QA, and separately recorded provider, public, newsletter, human, deployment, and production evidence.
