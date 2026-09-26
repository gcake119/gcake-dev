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
                              Paragraph / Arweave
```

### Editorial

`src/content/series/*.yaml`

Defines why posts belong together, section planning, post order and editorial progress.

### Content

`src/content/posts/**/*.{md,mdx}`

The only editable source for new article bodies. Subdirectories organize files in the repository only. The Markdown/MDX filename basename is the local post slug and must remain globally unique; parent folders do not affect the public `/posts/<slug>/` URL. Series membership and reading order remain defined by frontmatter plus the Series manifest.

### External content

Old series remain owned by their original repositories. The first external source is `gcake119/ithome-2026`.

### Presentation

Astro renders static HTML. Vue is reserved for interactive islands.

### Publication

GitHub Pages is the current canonical reading surface for new posts. Paragraph is a publication/preservation target and must not become a second editing source.
