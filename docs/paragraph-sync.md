# Paragraph sync

Paragraph is retained primarily as the convenient Arweave publication/preservation layer.

Current skeleton behavior:

- `pnpm paragraph:prepare <slug>` produces a publication payload for a local post.
- GitHub Actions exposes a manual `Prepare Paragraph sync` workflow.
- The workflow intentionally does not publish yet.
- Credentials, update behavior, publication-date handling and Arweave confirmation must be verified before automatic writes are enabled.

Future publication metadata belongs in `src/data/publishing/paragraph-state.json`, not in article bodies.
