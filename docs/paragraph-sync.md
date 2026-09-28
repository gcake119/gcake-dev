# Paragraph sync

Paragraph is retained as a publication/newsletter target and the convenient Arweave publication/preservation layer.

Current skeleton behavior:

- `pnpm paragraph:prepare <slug>` produces and validates a shared portable publication plus a Paragraph dry-run plan.
- GitHub Actions exposes a manual Prepare Paragraph sync workflow.
- The plan always has `externalWriteEnabled: false` and `sendNewsletter: false`.
- The workflow intentionally does not publish, verify remotely, persist credentials, or send email.
- Target-independent runtime state lives in D1; Git frontmatter remains the editorial source of truth.

Phase 1 evolves this skeleton through the shared transform and disabled adapter defined in docs/multi-platform-publishing.md. The former Paragraph-only empty state file was removed so publication state has one owner.

Before automatic writes are enabled, verify the current official Paragraph interface for authentication, create/update draft behavior, publish behavior, newsletter sending, canonical/original URL, original publication date and update behavior, remote ID/URL retrieval, public verification, Arweave persistence, retry behavior, and duplicate-send behavior.

Paragraph remains a publication target only. Changes are made in gcake-dev and synchronized outward.

The official Paragraph surface available in 2026-09 includes REST API, TypeScript SDK, CLI, MCP and agent skills. The API is explicitly alpha. The CLI documents draft create/update, publish, publish dry-run, draft/archive, public get/list and test email. Publishing with `--newsletter` sends to subscribers, so article update and newsletter delivery must remain separate commands and state transitions.
