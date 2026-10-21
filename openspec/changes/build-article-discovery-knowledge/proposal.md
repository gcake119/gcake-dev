## Why

Before this change, the public blog matched whitespace-separated substrings without ranking or query-specific excerpts. Its articles can also support automatic citations, related reading, a corpus-derived terminology index, and semantic retrieval through one publication-aware knowledge pipeline.

## What Changes

- Build one revision-bound public corpus from the existing reading catalog, local Markdown/MDX, and pinned iThome snapshots; keep authored content and canonical URLs authoritative.
- Automatically derive evidenced terms, explicit aliases, outgoing citations, incoming citations, related articles, and complementary further reading without per-article editorial selection.
- Improve the existing search page with Chinese-aware lexical ranking, excerpts, highlighting, shareable query/page state and accessible loading/error/empty states. Use the approved minimal reader surface with no filters, mode selectors, suggestions or explanatory copy; the authorized local BGE preview searches directly on form submission.
- Plan a separate public Cloudflare search Worker, the explicitly authorized temporary BGE-M3 model on Workers AI and a 1024-dimensional cosine Vectorize index for opt-in semantic search; ordinary search remains usable as a static site.
- Keep the preference for verified non-Chinese developer provenance, with the user-authorized temporary exception limited to @cf/baai/bge-m3 while EmbeddingGemma free eligibility is unverified. Other Chinese-developed or unidentified models remain excluded, including rerankers and automatic alternatives. EmbeddingGemma remains the intended replacement after its free eligibility and retrieval quality are verified.
- Record provider pricing evidence before activation: BGE-M3 has a published neuron conversion; EmbeddingGemma still has no verified model-specific rate/free treatment. Verify the selected BGE model and actual account-wide free/no-overage boundary before enabling remote processing; never transfer either model's prices or vectors to the other.
- Enforce free-tier-only operation with zero authorized paid overage across embedding, Vectorize and supporting services; stop remote work when remaining free capacity is unknown or insufficient, and retain keyword search. No automatic plan upgrades or paid fallback.
- Explicitly defer AI question answering: no generation model, answer endpoint, generated prose, chat UI, or RAG activation in this change.
- Deliver in two independently verifiable milestones: static discovery and semantic retrieval. Provider resources, model calls, deployment, and activation require separate execution authorization.

- Accumulate source-grounded evaluation data as public articles grow. No fixed total, per-category quota, balanced split, minimum panel count or numerical relevance score is a release blocker; report observed coverage and defects without inventing missing data. Evidence correctness and execution/activation safeguards remain required.

## Capabilities

### New Capabilities

- `public-article-knowledge`: Publication-aware corpus, reproducible terminology extraction, passage identity, and revision lifecycle.
- `automatic-article-connections`: Automatically derived citations, backlinks, related reading, and complementary reading layout.
- `reader-search`: Accessible ranked keyword search and authorized local BGE retrieval with shareable pagination and reliable fallback.

### Modified Capabilities

None. The existing public search design decision is extended in this change; no existing Spectra capability currently specifies public reader search. Formal preview, private editing, slug suggestions, publication automation, and distribution retain their current contracts.

## Impact

- Affected specs: three new capabilities listed above.
- Modified: `src/pages/search.astro`, `src/pages/search-index.json.ts`, `src/pages/posts/[...slug].astro`, `src/pages/series/ithome-2026/[post].astro`, `src/components/SiteHeader.astro`, `src/styles/global.css`, `src/lib/content/catalog.ts`, `package.json`, `docs/blog-redesign-approved.md`, `docs/design-system.md`.
- New: `src/lib/discovery/`, `src/components/ArticleConnections.astro`, `src/data/discovery-aliases.yaml`, `scripts/discovery/`, `test/discovery/`, `apps/search-worker/`, `docs/article-discovery-runbook.md`.
- APIs: versioned public semantic-search endpoint in the separate Worker; no Admin credentials or write routes in that service.
- Dependencies and systems: reuse current TypeScript, Node test runner, Playwright, Astro rendering, and site tokens. Stage A adds no required external runtime. Stage B provisioned resources and exact model versions are subject to measured acceptance and explicit activation decisions.
- No removal of required checks, no new mandatory CI workflow, no change to Substack, original content, source slug, canonical ownership, publication times, or notification behavior.


## Authorized local model comparison（２０２６－１０－２１）

The user now authorizes local Ollama calls to the installed `bge-m3:latest` and `embeddinggemma-2:latest` for a source-grounded retrieval comparison. This permits local embedding/index/query evaluation only, using the existing public corpus and frozen available judgments. It does not authorize Cloudflare calls, cloud model fallback, resource provisioning, production wiring, model replacement, deployment, generation, or activation. Pin installed model digests and runner/quantization; do not describe this mixed-runner comparison as a controlled weights-only comparison.

## Authorized local search preview

Connect the existing built search page to pinned installed BGE-M3 through a foreground loopback preview, reuse the verified current-corpus document vectors, and accept the real flow through Computer Use. The preview changes served HTML only; public static assets, Cloudflare policy and deployment remain disabled and unchanged.

## Reader correction: one search form

The user rejected the multi-filter UI. Remove topic, series, sort and mode dropdowns and the clear-filter action. Preserve the existing header input and source results; authorized local BGE preview uses the submitted query directly, with lexical fallback. Public remote activation remains disabled.

The latest reader correction removes suggested vocabulary too: after submission, display article results directly, with no suggestion region during typing or in empty states.

Remove the remaining device-processing sentence and repeated reader-page chrome, leaving the single search form, count and articles. Preserve conditional pagination/recovery and disabled remote settings.

## Authorized conformance fixes

Fix the reviewed client release-conflict fallback, preview receipt overwrite and duplicate reading URL validation while preserving the user-approved UI and disabled remote execution. Reuse existing Node and browser acceptance layers; no deployment, model downloads or cloud calls.


## Production static milestone accepted（2026-10-21）

The separately authorized static Pages deployment of main f488015757d2cb337734c5c735f9b590c510adae succeeded after PR #50 and exact-main CI. Published manifest/assets/search HTML match that deployment artifact; actual desktop and 320/390px browser interactions verified keyword results, pagination/back, article links and empty results with the approved minimal layout unchanged. See production-acceptance-20261021.md and its JSON/screenshots. This supersedes earlier current-status statements that only a local candidate existed; earlier authorization boundaries remain historical evidence. No cloud resources, model calls or semantic activation occurred. Tasks remain 24/27: 1.1 is historical red-test provenance; 3.3/4.3 retain actual cloud account/model/wiring and semantic release acceptance. This backfill changes documentation only, not requirements, scenarios, runtime or activation authority.
