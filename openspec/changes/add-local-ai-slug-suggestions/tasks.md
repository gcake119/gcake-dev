## 1. Local generator contract

- [x] 1.1 Implement **Use a loopback-only local slug generator service**, **Explicit local title-to-slug generation**, and **Server-side local configuration** as a workspace package whose POST contract uses environment-configured Ollama/Gemma settings and never downloads models; verify with HTTP tests for a valid title, empty title, CORS origin, timeout, unavailable Ollama, and missing model responses.
- [x] 1.2 Implement **Keep model output untrusted and sanitize once**, **Deterministic safe output boundary**, and **Optional failure behavior** so only one 3-to-7-word lowercase ASCII kebab-case candidate is returned; verify with unit tests for plain, fenced, mixed-case, prose, multiple candidates, invalid, dated, and numbered model outputs.

## 2. Admin interaction

- [x] 2.1 Implement **Keep suggestion state separate from saved article state** and **Editable AI slug suggestion** for both new and existing article title/slug fields so requests occur only on explicit activation, success fills an editable field, title changes never overwrite a slug, empty titles make no request, and failures preserve the current slug; verify with Admin unit tests and the static Admin foundation contract.
- [x] 2.2 Preserve **Existing validation remains authoritative** and **Reuse current CMS validation and Git transaction boundaries** so duplicate slugs remain blocked by the existing CMS flow and suggestion generation invokes no save endpoint or Git commit; verify with focused Admin and Worker route tests.
- [x] 2.3 Implement **Reuse the GitHub App installation token for production writes** and **Production GitHub writes remain bounded and atomic** with `save`, `renamePost`, and `deletePost`, optimistic blob/base checks, one non-force ref update, and Worker runtime wiring; verify with mocked GitHub API integration tests including concurrent ref conflict and secret non-disclosure.
- [x] 2.4 Implement **Preserve series referential integrity during post rename** and **Slug rename preserves every series reference** so all series post entries and editorial pointers are rewritten server-side in the same transaction as the post path rename; verify with pure transaction tests and production writer tests for multiple references and stale series conflicts.

## 3. Hosted-runtime boundary and documentation

- [x] 3.1 Enforce **Ollama remains outside hosted runtimes** by keeping the Cloudflare Worker and public Astro site free of Ollama imports, endpoints, and runtime dependencies; verify with public visibility tests plus Admin, Worker, and Astro builds without Ollama.
- [x] 3.2 Document local startup, environment variables, error behavior, and the **Use a loopback-only local slug generator service** architecture in the Publishing CMS architecture and implementation design; verify by reviewing the documented command and configuration names against package scripts and implementation defaults.

## 4. Full verification

- [x] 4.1 Run focused tests, `pnpm test`, `pnpm check`, `pnpm build:all`, `spectra validate add-local-ai-slug-suggestions`, `spectra analyze add-local-ai-slug-suggestions --json`, and `git diff --check`; all commands must pass without provider writes, model downloads, or Git commits.
