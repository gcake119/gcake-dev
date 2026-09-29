## Context

The Admin is a Vue application served with the Cloudflare Worker, while the public site is a separate Astro build. The current main branch already supports new standalone posts, editable pre-save slug input, CMS-side format checks, server-side duplicate protection, and Git commits only during formal save. A deployed Cloudflare Worker cannot reach Ollama on the author's computer, and exposing Ollama directly to the browser would couple UI code to model details and provide no response validation boundary.

## Goals / Non-Goals

**Goals:**

- Add an explicit title-to-slug suggestion action for both new and existing article workflows.
- Keep Ollama and Gemma configuration in a loopback-only local service.
- Return only sanitized, validated suggestions and preserve the existing CMS ownership of uniqueness checks and Git writes.
- Fail without blocking or mutating normal editing.

**Non-Goals:**

- Hermes, Telegram, agent workflows, tags, summaries, metadata generation, series creation, publishing, cloud fallback, or a general AI provider abstraction.
- Calling Ollama from the Cloudflare Worker or public Astro site.
- Downloading or managing Ollama models.

## Decisions

### Use a loopback-only local slug generator service

Add a small Node HTTP service that binds to `127.0.0.1` by default and exposes only `POST /api/slug-suggestions`. The Admin receives the bridge URL through Vite environment configuration, while the bridge receives its Ollama endpoint and model through server-side environment variables. This is preferred over Worker-to-Ollama calls because Cloudflare cannot route to the user's localhost, and preferred over direct browser-to-Ollama calls because the model prompt, timeout, and validation belong behind a local server boundary.

### Keep model output untrusted and sanitize once

The bridge sends a short prompt with non-streaming generation and treats the response as untrusted text. It extracts at most one candidate, converts ASCII words to lowercase kebab-case, removes surrounding prose or code fences only when a single safe candidate remains, enforces 3 to 7 words, and rejects empty or ambiguous output. Duplicate detection is intentionally excluded from the bridge.

### Keep suggestion state separate from saved article state

The Admin sends a request only after an explicit button activation and only when the title is non-empty. A successful response fills the slug input, which remains editable. Title changes do not trigger requests and do not modify an existing slug. The action does not call any CMS save endpoint.

### Reuse current CMS validation and Git transaction boundaries

The existing client-side slug format guard and Worker/Git duplicate checks remain authoritative for save. AI generation provides a candidate only; formal save continues to create the repository commit using the current optimistic-concurrency path. When an existing post slug changes, a dedicated bounded rename contract derives the old and new post paths server-side and creates the new file plus removes the old file in one optimistic transaction. It does not expose a generic client-controlled delete operation.

### Reuse the GitHub App installation token for production writes

The Worker SHALL construct a production content writer from the same short-lived GitHub App installation-token provider used for reads. The writer SHALL use GitHub's Git database API to create blobs, one tree, one commit, and finally advance the default-branch ref without force. It SHALL verify the expected base commit and every expected blob before the ref update. A concurrent ref change SHALL fail closed and SHALL NOT overwrite the newer branch head. No installation token, private key, article body, or series source may be returned to the browser or persisted in D1.

### Preserve series referential integrity during post rename

The rename operation SHALL discover local series manifests server-side, replace every post entry and editorial pointer that equals the old slug, and include only affected manifests in the same repository transaction as the new post path and old-path removal. The new slug is treated as existing for series validation. If any affected series blob, the old post blob, the target path, or the base commit is stale, the entire branch update SHALL fail with no visible partial rename.

## Implementation Contract

The local service SHALL accept JSON `{ "title": string }` at `POST /api/slug-suggestions` and return HTTP 200 JSON `{ "slug": string }` only after sanitization and validation. Empty titles SHALL return HTTP 400 without calling Ollama. Unavailable Ollama, timeout, missing model, invalid JSON, ambiguous text, or invalid slug output SHALL return a non-2xx JSON error without leaking raw model output or server configuration.

The service SHALL use `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `SLUG_GENERATOR_HOST`, `SLUG_GENERATOR_PORT`, `SLUG_GENERATOR_ALLOWED_ORIGIN`, and `SLUG_GENERATOR_TIMEOUT_MS`, with safe local defaults for host, port, Ollama URL, Gemma model, and timeout. It SHALL not download models or call cloud providers.

The Admin SHALL expose an explicit `產生 slug` button beside the slug field for new and existing articles. It SHALL not request a suggestion for an empty title, SHALL fill but not lock the slug on success, SHALL preserve the current slug on failure, SHALL show `目前無法產生 slug，可以手動輸入。` for unavailable or invalid responses, and SHALL never save or commit as part of generation.

The production Worker SHALL provide `save`, `renamePost`, and `deletePost` through a GitHub App content writer whenever the existing GitHub App credentials are configured. A save SHALL advance the default branch with one non-force ref update after all optimistic checks pass. A rename SHALL update the post path and all referencing local series manifests in that same ref update. Any conflict SHALL leave the branch head unchanged and return the existing conflict response.

Acceptance requires focused unit tests for prompt/output handling, HTTP failures, UI request behavior, manual edits, no automatic regeneration, duplicate validation continuity, and no save request during suggestion generation. Repository-level Admin, Worker, public-site tests and builds SHALL pass.

## Risks / Trade-offs

- [Risk] A remotely hosted Admin must call a local HTTP origin and browser origin policy can block requests. → Mitigation: configure an explicit allowed Admin origin, document local use, answer preflight requests, and keep the failure non-blocking.
- [Risk] Gemma can add explanations despite the prompt. → Mitigation: accept only a single safely extractable candidate after deterministic sanitization; otherwise reject.
- [Risk] A configured model is missing or Ollama is stopped. → Mitigation: use a short abort timeout and return a generic optional-helper error.
- [Risk] Existing article slug rename must not leave both old and new files or expose arbitrary deletion. → Mitigation: validate both slugs, derive both post paths on the server, require the old blob/base commit revisions, and commit create-plus-delete atomically; an occupied target path fails the whole transaction.
- [Risk] Updating only the Markdown path would leave series manifests pointing at a missing slug. → Mitigation: discover and rewrite every matching series post entry and editorial pointer server-side, then include all affected blobs in the same tree and ref update.
- [Risk] GitHub objects can be created before a concurrent ref conflict is discovered. → Mitigation: publish visibility changes only through one non-force ref update; orphaned blobs/trees/commits are unreachable and the existing branch remains untouched.

## Migration Plan

Add the local package, Admin integration, and a bounded existing-post rename branch without changing the public Astro runtime. Operators run the helper explicitly when needed and configure the Admin bridge URL at build/dev time. Rollback removes the helper package and button; any slug rename already saved remains ordinary Git history.

## Open Questions

None.
