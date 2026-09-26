# Paragraph sync

Paragraph is retained as a publication/newsletter target and the convenient Arweave publication/preservation layer.

Current skeleton behavior:

- pnpm paragraph:prepare <slug> produces a publication payload for a local post.
- GitHub Actions exposes a manual Prepare Paragraph sync workflow.
- The workflow intentionally does not publish yet.
- src/data/publishing/paragraph-state.json is currently empty state storage.

The next implementation should evolve this skeleton into the Paragraph adapter defined in docs/multi-platform-publishing.md.

Before automatic writes are enabled, verify the current official Paragraph interface for authentication, create/update draft behavior, publish behavior, newsletter sending, canonical/original URL, original publication date and update behavior, remote ID/URL retrieval, public verification, Arweave persistence, retry behavior, and duplicate-send behavior.

Paragraph remains a publication target only. Changes are made in gcake-dev and synchronized outward.
