# Architecture

## Purpose

`gcake-dev` is a long-lived personal technical publishing site.

## Layers

```text
Editorial Series Manifest
        ↓
Local Markdown ───── External immutable sources
        ↓                     ↓
        └──── normalized content ────┐
                                      ↓
                                Astro static site
                                      ↓
                                GitHub Pages
                                      ↓
                         Paragraph / Substack adapters
```

### Editorial

`src/content/series/*.yaml`

Defines why posts belong together, section planning, post order and editorial progress.

### Content

`src/content/posts/**/*.{md,mdx}`

The only editable source for new article bodies. Subdirectories organize files in the repository only. The Markdown/MDX filename basename is the local post slug and must remain globally unique; parent folders do not affect the public `/posts/<slug>/` URL. Series membership and reading order remain defined by frontmatter plus the Series manifest.

### External content

Old series remain owned by their original repositories. The first external source is `gcake119/ithome-2026`.

External article bodies are treated as immutable inputs. `gcake-dev` may normalize their metadata and render them through the current reading experience, but it does not rewrite the source Markdown or take over the source repository's canonical ownership.

### SEO / AEO

Local posts and external series use the same site-level metadata and structured-data pipeline after ingestion.

Shared article output includes:

- title and description metadata
- Open Graph and Twitter metadata
- canonical URL
- `BlogPosting` JSON-LD with one stable author identity
- language metadata
- series membership through `isPartOf` / `articleSection`
- topic relationships when topic metadata exists
- breadcrumb structured data

Series pages emit `CollectionPage` + ordered `ItemList` structured data.

Canonical ownership stays source-aware:

- new local posts use `gcake-dev` URLs
- imported iThome 2026 posts keep the canonical URL published by `ithome-2026`

This lets archived external content gain the current site's reading and discovery structure without changing the archived source site.

### Presentation

Astro renders static HTML. Vue is reserved for interactive islands.

### Publication

GitHub Pages is the canonical reading surface for new posts. A shared transform produces a provider-neutral portable publication before Paragraph or Substack sees the content. Both are independent distribution targets and never editing sources.
