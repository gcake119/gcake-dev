## Why

The public blog currently matches whitespace-separated substrings without ranking or query-specific excerpts. Its articles can also support automatic citations, related reading, a corpus-derived terminology index, semantic retrieval, and evidence-grounded answers through one publication-aware knowledge pipeline.

## What Changes

- Build one revision-bound public corpus from the existing reading catalog, local Markdown/MDX, and pinned iThome snapshots; keep authored content and canonical URLs authoritative.
- Automatically derive evidenced terms, explicit aliases, outgoing citations, incoming citations, related articles, and complementary further reading without per-article editorial selection.
- Improve the existing search page with Chinese-aware lexical ranking, excerpts, highlighting, topic/series filters, shareable state, accessible loading/error/empty states, and optional explicit semantic search.
- Plan a separate public Cloudflare search Worker, Workers AI embeddings and Vectorize for opt-in semantic search; ordinary search remains usable as a static site.
- Add a separately activated, explicit question action that retrieves public passages and returns cited answers or an honest insufficient-evidence result.
- Deliver in three independently verifiable milestones: static discovery, semantic retrieval, and grounded answers. Provider resources, model calls, deployment, and activation require separate execution authorization.

## Capabilities

### New Capabilities

- `public-article-knowledge`: Publication-aware corpus, reproducible terminology extraction, passage identity, and revision lifecycle.
- `automatic-article-connections`: Automatically derived citations, backlinks, related reading, and complementary reading layout.
- `reader-search`: Accessible ranked keyword and semantic search with consistent filtering and reliable fallback.
- `grounded-article-answers`: Explicit RAG questions, validated citations, abstention, privacy, and bounded provider execution.

### Modified Capabilities

None. The existing public search design decision is extended in this change; no existing Spectra capability currently specifies public reader search. Formal preview, private editing, slug suggestions, publication automation, and distribution retain their current contracts.

## Impact

- Affected specs: four new capabilities listed above.
- Modified: `src/pages/search.astro`, `src/pages/search-index.json.ts`, `src/pages/posts/[...slug].astro`, `src/pages/series/ithome-2026/[post].astro`, `src/components/SiteHeader.astro`, `src/styles/global.css`, `src/lib/content/catalog.ts`, `package.json`, `docs/blog-redesign-approved.md`, `docs/design-system.md`.
- New: `src/lib/discovery/`, `src/components/ArticleConnections.astro`, `src/data/discovery-aliases.yaml`, `scripts/discovery/`, `test/discovery/`, `apps/search-worker/`, `docs/article-discovery-runbook.md`.
- APIs: versioned public semantic-search and answer endpoints in the separate Worker; no Admin credentials or write routes in that service.
- Dependencies and systems: reuse current TypeScript, Node test runner, Playwright, Astro rendering, and site tokens. Stage A adds no required external runtime. Stage B/C provisioned resources and exact model versions are subject to measured acceptance and explicit activation decisions.
- No removal of required checks, no new mandatory CI workflow, no change to Substack, original content, source slug, canonical ownership, publication times, or notification behavior.
