# Multi-platform publishing design

## Status

Approved product direction. Ready for Codex implementation planning.

## Goals

- gcake-dev remains the only editable source for new article bodies.
- GitHub Pages remains the canonical reading surface.
- New articles distribute to Paragraph and Substack.
- Plain articles publish as full text by default.
- Articles that materially depend on interactive Vue/MDX content publish a compact external version with static fallback and a canonical link.
- Publication targets never write content changes back into gcake-dev.
- Each target publishes and verifies independently; one target failing must not invalidate the others.

## Source and ownership

~~~text
src/content/posts/**/*.{md,mdx}
        ↓
publication transform
        ↓
portable publication
        ↓
Paragraph adapter      Substack adapter
        ↓                    ↓
independent verification + publication state
~~~

GitHub Pages is the canonical rendering of the source article.

## Distribution policy

Default mode: full.

~~~yaml
distribution:
  mode: full
~~~

Interactive mode: interactive-summary.

~~~yaml
distribution:
  mode: interactive-summary
~~~

In interactive-summary mode, gcake-dev keeps the complete interactive experience. External platforms receive a shorter version that preserves the core meaning and includes a representative static fallback when useful, a concise explanation of what the interaction demonstrates, and a direct link to the canonical interactive version.

The publishing system must not infer this mode from component names. The author chooses it explicitly.

Interactive components must not contain the only information required to understand the article's core argument.

## Shared publication transform

Platform adapters must not read raw MDX and improvise how unsupported components should be handled.

Introduce a shared transform:

~~~text
Markdown / MDX source
→ shared transform
→ portable publication
→ platform adapter
~~~

Conceptual portable publication fields:

- slug
- title
- description
- canonicalUrl
- publishedAt / updatedAt
- distributionMode
- body
- assets
- sourceRevision

For full mode, preserve the complete portable article while removing source-only frontmatter and site-only constructs that cannot be published externally.

For interactive-summary mode, do not serialize Vue components to external platforms. The source article must provide or reference a source-controlled fallback version. Adapters must not invent fallback prose.

## Paragraph adapter

Paragraph is the reliable automated publication target.

Use the current official Paragraph API, SDK, or CLI after verifying supported behavior for:

- create/update draft
- publish
- newsletter delivery
- canonical/original URL
- publication date/update behavior
- resulting remote article ID/URL
- public verification
- Arweave persistence confirmation
- retry/idempotency behavior

Existing implementation starting points:

- scripts/publishing/prepare-paragraph.ts
- .github/workflows/sync-paragraph.yml
- src/data/publishing/paragraph-state.json

Evolve the current prepare-only workflow instead of creating an unrelated path.

## Substack adapter

Substack is a distribution target for a different reader network and newsletter audience.

Any automation that is not based on a stable official public publishing API must stay behind an isolated adapter and be treated as lower-confidence infrastructure.

Requirements:

- never make Substack a prerequisite for GitHub Pages or Paragraph publication
- keep authentication/runtime details outside article content
- fail independently
- record enough diagnostic state for manual recovery
- verify the public result after a publish attempt
- keep the adapter replaceable if Substack changes or later provides an official API
- do not couple the shared transform to reverse-engineered Substack payload shapes

## Publication state

The existing paragraph-state.json confirms that publication state belongs outside article bodies.

Move toward target-independent state that can record, per article:

- sourceRevision
- each platform status
- remote ID
- remote URL
- publishedAt
- publish failure vs verification failure
- whether the current source revision needs re-sync

Minimum useful states:

- pending
- published
- publish_failed
- verification_failed

## Publish and verify are separate

~~~text
prepare
→ publish
→ verify
→ record state
~~~

A successful API or browser action is not sufficient evidence that publication is complete.

## Failure isolation

Example:

~~~text
GitHub Pages succeeds
Paragraph succeeds
Substack fails
~~~

Expected result:

- canonical article remains published
- Paragraph remains published
- Substack is marked failed
- Substack can be retried or manually recovered
- the whole publication is not rolled back

The same independence applies to Paragraph failure.

## Newsletter behavior

- Paragraph and Substack are both newsletter surfaces.
- Newsletter sending must be an explicit adapter capability.
- Use dry-run/test behavior where supported.
- Prevent duplicate newsletter sends during retries or article updates.
- Distinguish updating an existing remote article from sending a new newsletter.

## Canonical

New local articles use:

~~~text
https://gcake119.github.io/gcake-dev/posts/<slug>/
~~~

Paragraph and Substack copies must link back to the canonical article.

Use a platform-supported canonical/original URL field where available. If a platform cannot reliably declare an external canonical, keep a visible canonical link and document the SEO limitation.

## RSS

The existing rss.xml.ts is a reader subscription feed, not the publication transport. It currently carries title, description, date, and link rather than the transformed full article.

## Secrets and runtime data

Do not commit API keys, session cookies, browser profiles, newsletter credentials, or runtime tokens.

## First production cohort

There is no external publishing planned yet. The publishing system may be implemented and tested locally before the series begins, but no Paragraph/Substack production write or newsletter send should occur during the current iThome competition.

After the iThome competition ends and the six-post 2026 behind-the-scenes extension series begins serial publication, use that series as the first production cohort.

Validate:

- full-text synchronization
- canonical handling
- image/link transformation
- newsletter delivery
- remote update behavior
- verification and retry state
- failure isolation

If none of the six posts naturally requires interaction, test interactive-summary with a fixture instead of inventing interaction for the series.

## Implementation phases

### Phase 1 — shared publishing contract

- add distribution metadata to the post schema
- define and test portable publication generation
- validate full vs interactive-summary modes
- add MD and MDX fixtures/tests
- keep site rendering unchanged

### Phase 2 — Paragraph production adapter

- evolve prepare-paragraph.ts around the shared transform
- integrate the supported official Paragraph automation surface
- implement create/update/publish/newsletter semantics
- verify the public result
- persist publication state
- add dry-run behavior

### Phase 3 — Substack isolated adapter

- confirm the current automation surface before implementation
- isolate authentication
- support draft/update/publish/newsletter as safely as the current interface allows
- verify the public result
- persist success/failure state independently
- ensure Substack failure cannot fail canonical/Paragraph publication

### Phase 4 — orchestration

- add one explicit publishing command/workflow that can target one or multiple platforms
- prevent duplicate newsletter sends
- support retry per target
- report per-platform results clearly

Do not automatically publish externally merely because Markdown reaches main until production behavior is intentionally approved. Git deployment and external publication remain separate actions.

Until the iThome competition has ended and the behind-the-scenes series is ready to begin, implementation work must stop at local tests, dry runs, interface verification, and non-writing validation.

## Out of scope for first implementation

- backfilling all 30 original iThome posts to Substack
- making Paragraph or Substack an editing source
- automatically generating fallback prose with an LLM
- reproducing Vue interaction inside external platforms
- treating Substack automation as equally stable as an official API
- adding more platforms before Paragraph and Substack are proven

## Implementation gate

Before enabling external writes, Codex must verify and document for each platform:

1. authentication method
2. create/update semantics
3. newsletter-send semantics
4. duplicate-send risks
5. public verification method
6. retry/idempotency behavior
7. canonical/original URL support
8. known stability limitations

For Paragraph, prefer official documentation and supported tooling. For Substack, clearly label any non-official integration and keep it replaceable.
