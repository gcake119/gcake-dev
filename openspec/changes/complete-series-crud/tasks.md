## 1. Repository lifecycle and validation

- [x] 1.1 Deliver **Create an empty series** and **Series lifecycle writes preserve optimistic concurrency** through **Use one lifecycle service over repository transactions** and **Use absence as the expected revision for creation targets**: first add failing lifecycle and repository tests for valid creation, invalid slug, duplicate target, and stale base revision; then implement canonical empty-manifest creation until the focused Worker tests pass.
- [x] 1.2 Deliver **Edit series metadata without changing membership** and **Rename a series identity atomically** through **Represent rename as one atomic delete-and-create transaction**: first add failing tests for title-only preservation, populated rename, collision, target race, and stale source revision; then implement update and atomic rename until the focused lifecycle and Git-write tests pass.
- [x] 1.3 Deliver **Delete a series without deleting posts** through **Delete only the manifest**: first add failing tests for confirmation-required, empty deletion, populated deletion with unchanged post files, and stale revision; then implement manifest-only deletion until the focused lifecycle and repository tests pass.

## 2. API and contracts

- [x] 2.1 Deliver **Complete Series CRUD runtime**, **Optimistic concurrency on formal saves**, and **Coherent repository commits** according to **Interface and data shape** and **Failure modes**: first add failing shared-contract and router tests for POST/PUT/DELETE, CSRF, validation, 404, 409 revision details, and single-transaction rename; then wire the lifecycle service and typed responses until Admin contract and Worker route tests pass.
- [x] 2.2 Deliver list summaries through **Return parsed summaries for the Series list**: first add failing GitHub-reader and contract tests for parsed title and referenced-post count including zero; then extend GET list data until those focused tests pass.

## 3. Admin Series workspace

- [x] 3.1 Deliver **Series list lifecycle controls** using the existing Admin design system: first add failing Admin helper tests for create defaults, title/slug edits, article-count presentation, and API error messages; then implement list controls and accessible forms in the Series workspace until Admin unit tests and build pass.
- [x] 3.2 Deliver the explicit no-post-deletion warning and conflict recovery behavior: first add failing Admin tests that assert delete copy says articles remain and that `SERIES_CONFLICT` preserves the working manifest; then implement confirmation, success refresh/navigation, and actionable errors until focused Admin tests pass.

## 4. Public routes and standalone fallback

- [x] 4.1 Deliver **Public-site regression boundary** through **Preserve route semantics through canonical slug identity**: first add failing catalog/route regression tests showing old slug absence after rename and deleted-series posts becoming standalone without navigation; then adjust derived membership or route generation only as needed until public tests and content validation pass.
- [x] 4.2 Update `docs/publishing-cms-implementation-design.md` with the final Series POST/PUT/DELETE contracts, atomic rename semantics, and manifest-only deletion behavior; verify the document against the **Implementation Contract** and confirm no second database or post-frontmatter membership is introduced.

## 5. Full verification

- [x] 5.1 Verify **Acceptance criteria** and **Scope boundaries** by running `spectra analyze complete-series-crud --json`, all focused suites, `pnpm test`, `pnpm check`, `pnpm build:all`, and `git diff --check`; resolve failures and confirm create, rename, delete, standalone fallback, Worker/Admin builds, and public Astro build satisfy every acceptance scenario without changing post source ownership, media, providers, authentication, or deployment.
