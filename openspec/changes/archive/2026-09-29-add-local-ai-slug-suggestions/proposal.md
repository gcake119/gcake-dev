## Why

Publishing Admin users currently have to invent English URL slugs manually even when an article title already expresses the intended meaning. A local, explicitly invoked helper can reduce that friction without making article editing, Git writes, the Cloudflare Worker, or the public site depend on an AI provider.

## What Changes

- Add a loopback-only slug generator API that calls an already-installed Ollama Gemma model with server-side environment configuration.
- Add an explicit "產生 slug" action beside the title and slug fields for new and existing article workflows.
- Sanitize and validate the model response before returning a suggestion, while leaving duplicate checks and final save validation in the existing CMS flow.
- Treat the helper as optional: empty titles do not send requests, failures leave the editable slug unchanged, and generation never creates a Git commit.
- Wire the existing GitHub App installation credentials into a production content writer so ordinary CMS saves and bounded slug renames reach the repository without storing user tokens.
- When an existing slug changes, update every local series manifest reference in the same Git transaction as the post path rename.

## Capabilities

### New Capabilities

- `local-slug-suggestions`: Generate a safe English kebab-case slug suggestion from an article title through a local Ollama bridge.

### Modified Capabilities

- `safe-content-editor`: Expose editable title and slug fields with an explicit, non-saving suggestion action that never overwrites a slug because the title changed.
- `admin-runtime`: Keep Ollama outside the Cloudflare Worker and public site while providing a separately runnable local helper with environment-based endpoint and model configuration.

## Impact

- Affected specs: `local-slug-suggestions`, `safe-content-editor`, `admin-runtime`
- Affected code:
  - New: `apps/slug-generator/package.json`, `apps/slug-generator/src/server.ts`, `apps/slug-generator/src/slug-generator.ts`, `apps/slug-generator/src/slug-generator.test.ts`, `apps/admin/src/slug-suggestion.ts`, `apps/admin/src/slug-suggestion.test.ts`
  - Modified: `apps/admin/src/App.vue`, `apps/admin/src/admin.css`, `apps/admin/src/foundation.test.ts`, `apps/admin/package.json`, `apps/admin-worker/src/github.ts`, `apps/admin-worker/src/index.ts`, `apps/admin-worker/src/git-writes.ts`, `apps/admin-worker/src/router.ts`, `package.json`, `pnpm-lock.yaml`, `docs/publishing-cms-architecture.md`, `docs/publishing-cms-implementation-design.md`
  - Removed: none
