# Publishing CMS Architecture

## Status

Confirmed product and system architecture direction.

This document records the agreed architecture for a personal Git-backed publishing CMS for `gcake-dev`.

It is not yet an implementation specification. The next step is implementation design: data models, API contracts, routes, GitHub App permissions, R2 object conventions, preview workflow, publication state machine, failure flows, implementation phases, and acceptance criteria.

---

## 1. Product positioning

Build a personal-use **Git-backed Publishing CMS** for the long-lived technical blog.

The CMS should provide a complete and practical daily publishing workflow, not merely a minimal admin panel.

Primary goals:

- edit Markdown / MDX online
- paste, drag, upload, and manage article images
- preview rendered output while editing
- manage article metadata, series, status, and scheduled publication
- inspect GitHub Pages / Paragraph / Substack publication state
- preserve Git history
- prevent silent overwrites when Codex or another writer changes the repository
- make image, layout, scheduling, preview, and publication operations convenient from a browser

Out of scope for the first complete version:

- multi-user roles and permissions
- WordPress-style WYSIWYG editing
- a CMS database as the article content source
- analytics dashboards
- comments
- built-in AI writing
- reimplementing Git version control

The existing AI-assisted writing workflow remains valid. The CMS primarily covers operations that are awkward in a chat or coding-agent interface: preview, media handling, metadata, scheduling, publication state, retries, and visual inspection.

---

## 2. Source-of-truth boundaries

Different data types have different owners.

### 2.1 GitHub repository: editorial and article SSOT

Repository:

`gcake119/gcake-dev`

The repository remains the source of truth for:

- article bodies in `src/content/posts/**/*.{md,mdx}`
- article frontmatter
- series manifests in `src/content/series/*.yaml`
- section structure and reading order
- publication configuration such as distribution mode
- scheduled publication time through `publishedAt`

The CMS must not create a second editable copy of these values in D1.

Current article lifecycle remains:

```text
draft
ready
published
```

Series manifests remain the SSOT for sections and reading order. Post files do not gain duplicated section/order fields.

### 2.2 Cloudflare R2: media SSOT

R2 stores article media assets such as:

- screenshots
- WebP
- PNG
- SVG
- other article attachments

Markdown stores the public media URL that the article actually references.

Prefer a stable custom media hostname instead of embedding an R2 implementation hostname into every article.

Example:

```text
media.gcake.dev/posts/<post-slug>/<asset>
```

### 2.3 Cloudflare D1: operational state

D1 stores CMS runtime and derived state, for example:

- sessions
- UI preferences
- publication runs
- publication target status
- publish / verification attempts
- retry state
- preview build state
- media index metadata
- GitHub synchronization state
- audit events

D1 must not become the canonical copy of:

- article body
- article title or frontmatter
- series order
- publication date

Derived state should be reconstructable from repository and provider state when practical.

---

## 3. High-level architecture

```text
Browser
   ↓
Publishing Admin
Vue Web App
   ↓
Cloudflare Workers
   ├─ Auth API
   ├─ Content API
   ├─ Media API
   ├─ GitHub API
   ├─ Preview API
   └─ Publishing API
        │
        ├──────── GitHub App
        │             ↓
        │      gcake119/gcake-dev
        │             ↓
        │       GitHub Actions
        │        ├─ GitHub Pages
        │        ├─ Paragraph
        │        └─ Substack
        │
        ├──────── R2
        │          ↓
        │       Media
        │
        └──────── D1
                   ↓
              Runtime state
```

### Cloudflare responsibilities

#### Pages

Hosts the Admin frontend.

#### Workers

Provides server-side APIs for:

- authentication
- GitHub access
- content read/write orchestration
- media operations
- preview orchestration
- publication operations

#### R2

Stores media assets.

#### D1

Stores operational state.

Queues are not required for the first complete version. Add them later only if multi-target retries or background-job volume makes them useful.

---

## 4. Authentication and authorization

Use:

```text
GitHub Login
+
GitHub App
```

Login flow:

```text
Sign in with GitHub
↓
Verify GitHub user identity
↓
Check against allowed owner identity
↓
Open Admin
```

The CMS is personal-use. Having a GitHub account alone must not grant access.

Prefer matching immutable GitHub user ID rather than only the login name.

The GitHub App should request only repository permissions required by implemented features.

Initial expected scope:

- Contents: read/write
- Metadata: read
- Actions: read

Add workflow-trigger permissions only if explicit workflow dispatch is implemented.

---

## 5. Design system and frontend rules

The CMS must use the **same design language and design rules as the existing `gcake-dev` frontend**.

Do not create a separate Admin Design System.

Canonical references:

- `docs/design-system.md`
- `docs/blog-redesign-approved.md`
- `DESIGN.md`
- `src/styles/global.css`
- `design-qa.md`

Reuse the existing design direction:

- mist-blue light theme
- night-mist-blue dark theme
- existing OKLCH design tokens
- system sans-serif typography
- clear size and weight hierarchy
- fine horizontal separators
- restrained accent use
- minimal decorative surfaces
- responsive behavior consistent with the public site
- keyboard accessibility and visible control labels
- existing theme behavior and persistence conventions where applicable

Admin screens may introduce new layout primitives required for editing workflows, such as:

- side navigation
- editor toolbar
- resizable split panes
- status badges
- data tables
- media grids
- dialogs
- publication status panels

These must extend the existing visual system instead of defining an unrelated style.

Avoid generic SaaS-admin visual conventions that conflict with the current site identity, especially excessive cards, heavy borders, decorative gradients, or an unrelated color system.

The rendered article preview must match the public site's article typography and content rendering rules as closely as practical.

---

## 6. Information architecture

Primary navigation:

```text
Dashboard
Content
Series
Media
Publishing
Settings
```

---

## 7. Dashboard

The dashboard is a publishing work surface, not an analytics dashboard.

It should show:

- articles scheduled today
- upcoming scheduled articles
- draft / ready counts
- failed publication attempts
- latest GitHub Pages deployment
- Paragraph / Substack state
- recently edited articles

Example:

```text
Today
├─ scheduled: 1
├─ failed: 0
├─ waiting sync: 1
└─ drafts: 3

Upcoming
09/30  Article A
10/04  Article B
10/08  Article C
```

---

## 8. Content

Article list filters should include:

- all
- draft
- ready
- scheduled
- published
- publication errors

Additional filters:

- series
- topic
- status
- publishedAt
- updatedAt

Search should cover at least:

- title
- description
- Markdown body

Article rows should expose:

- title
- series
- editorial status
- scheduled date/time
- current Git revision
- GitHub Pages state
- Paragraph state
- Substack state

---

## 9. Editor

The editor remains source-oriented.

Do not build a full WYSIWYG editor.

Markdown / MDX is the editable source.

### 9.1 View-mode control

Use **one button** that cycles through three modes:

```text
Markdown
→ Rendered
→ Split
→ Markdown
```

Do not implement three separate tabs.

#### Markdown mode

The source editor occupies the full editing area.

#### Rendered mode

The rendered article preview occupies the full editing area.

#### Split mode

Markdown is on the left and rendered preview is on the right.

Default split ratio:

```text
50 / 50
```

The divider must be draggable.

Remember:

- last-used view mode
- split ratio

Split mode defaults to synchronized scrolling, with an option to disable it.

Changing view modes must not lose:

- editor cursor position
- current source position
- current preview reading position when reasonably preservable

Example toolbar:

```text
[View: Split] [Sync scroll] [Formal site preview]
```

### 9.2 Editor capabilities

First complete version should support:

- Markdown / MDX syntax highlighting
- headings
- links
- code blocks
- quotes
- tables
- images
- undo / redo
- search / replace
- document outline
- local/browser draft autosave

---

## 10. Preview architecture

Provide two preview levels.

### 10.1 Immediate rendered preview

Used continuously while editing.

Covers normal portable article content such as:

- Markdown
- headings
- code blocks
- tables
- images
- captions

This must be fast and should not require a full Astro build for every keystroke.

### 10.2 Formal Astro preview

Provide a separate action such as:

```text
Formal site preview
```

This is not part of the three-state view-cycle button.

It should render through the real Astro site path when validation of site-specific behavior is needed, including:

- MDX
- Vue islands
- site CSS
- responsive layout
- TOC
- series navigation
- complete article page

---

## 11. Media workflow

The Editor supports:

```text
Paste
Drag & Drop
File Picker
Media Library
```

Typical image flow:

```text
Clipboard image
↓
Browser-side processing
↓
Resize when needed
↓
WebP conversion when appropriate
↓
Upload to R2
↓
Create/update media metadata
↓
Insert Markdown at cursor
```

Example Markdown:

```md
![Alt text](https://media.gcake.dev/posts/example/image.webp)
```

Editable media metadata should include:

- alt text
- caption
- filename
- MIME type
- width / height
- original size
- output size
- uploadedAt
- used-by articles

Heavy image processing should remain client-side where practical instead of consuming Worker CPU.

---

## 12. Media Library

Media Library should support:

- search
- preview
- insert into current article
- copy URL
- replace asset
- inspect usage
- find unused assets
- delete unused assets

Media metadata in D1 is an operational index. R2 remains the media source of truth.

---

## 13. Series Editor

The Series Editor directly modifies existing manifests:

```text
src/content/series/*.yaml
```

Visual management should support:

- sections
- planned posts
- drag-and-drop ordering
- post planning status
- current / next post
- adding new sections
- adding planned posts

Example:

```text
Series
└─ Chapter 1
   ├─ Post A   published
   ├─ Post B   ready
   └─ Post C   planned
```

Do not duplicate section or reading order into article frontmatter.

---

## 14. Scheduling and publication date

The Admin should provide a clear publishing control:

```text
Status
○ draft
○ ready
● published

Publication
○ immediately
● scheduled

Date / time
Asia/Taipei
```

The current repository already performs scheduled static rebuilds through GitHub Actions.

During implementation design, explicitly decide whether `publishedAt` remains date-only or becomes date-and-time.

Preferred direction for the CMS:

```yaml
publishedAt: 2026-10-15T09:00:00+08:00
```

If time precision is adopted, public visibility logic and tests must be updated consistently.

---

## 15. Git write model

The CMS is another interface to the repository, not another content store.

Formal save flow:

```text
Editor
↓
Validate
↓
Check base revision
↓
GitHub API
↓
Commit
↓
main
```

Commit messages may be generated automatically, for example:

```text
content: update astro-choice
```

When practical, article and newly referenced media metadata/config changes should be committed coherently.

Browser autosave is separate from Git save.

---

## 16. Concurrency and conflict handling

Both Codex and the CMS may modify the same repository.

Therefore optimistic concurrency is mandatory.

When an article opens, record its base SHA.

Example:

```text
base SHA = abc123
```

Before writing, check the current repository revision.

If it has changed:

```text
abc123 → def456
```

the CMS must not silently overwrite the repository.

Show a conflict state with actions such as:

```text
Repository has a newer version.

[View diff]
[Reload latest]
[Resolve manually]
```

The first complete version does not need a custom automatic Git merge engine, but it must fail closed on conflicts.

---

## 17. Publishing Center

Each article should expose independent target state.

Example:

| Target | State |
| --- | --- |
| GitHub Pages | Published |
| Paragraph | Published |
| Substack | Pending |

Target detail may show:

- remote URL
- source revision
- publishedAt
- last verification time
- newsletter state when relevant
- publish failure
- verification failure
- retry action

Preserve the existing publication lifecycle:

```text
prepare
→ publish
→ verify
→ record state
```

Targets remain failure-isolated.

A failure in Paragraph or Substack must not invalidate the canonical GitHub Pages publication.

Paragraph should evolve from the existing shared transform / adapter design.

Substack remains replaceable and may stay disabled or require manual fallback until a sufficiently reliable integration exists.

---

## 18. Operational data model direction

Expected D1 domains include:

```text
users
sessions

media_index

publication_runs
publication_targets
publication_attempts

preview_builds

github_sync_state

audit_events
```

This is a conceptual boundary only. Exact schema belongs in implementation design.

Audit events are useful for reconstructing CMS actions, for example:

```text
09:31 login
09:42 uploaded image
09:48 committed article
09:51 GitHub Pages deployed
```

Audit events do not replace Git history.

---

## 19. Codex and CMS responsibilities

The expected writing/publishing model is:

```text
                 ChatGPT / Codex
                       │
                       ▼
                  Git repository
                       ▲
                       │
                Publishing CMS
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        Media        Preview     Publishing
        layout       metadata    scheduling
```

The CMS does not need to replace the AI-assisted writing workflow.

It primarily handles:

- visual preview
- media
- layout inspection
- metadata
- scheduling
- publication state
- retries
- Git diff/conflict handling

---

## 20. First complete usable version

The first complete version should include:

1. GitHub Login
2. Dashboard
3. Content list / search / filtering
4. Markdown / MDX Editor
5. One-button Markdown → Rendered → Split view cycle
6. Split synchronized scrolling
7. Immediate rendered preview
8. Formal Astro preview
9. Frontmatter form
10. Image paste / drag / upload
11. R2 Media Library
12. Alt text / caption editing
13. Series Editor
14. Scheduled publication
15. Git commit
16. Conflict detection
17. GitHub Pages deployment state
18. Publishing Center
19. Paragraph adapter integration
20. Substack disabled/manual fallback
21. Retry and error states
22. Responsive Admin UI using the existing gcake-dev design system

---

## 21. Existing repository behavior to preserve

The CMS must integrate with, not bypass, current repository responsibilities:

- `src/content/posts/**/*.{md,mdx}` remains the editable article source
- `src/content/series/*.yaml` remains the series structure and reading-order SSOT
- current article states remain `draft | ready | published`
- GitHub Pages remains the canonical reading surface for new articles
- publication targets remain independent
- the existing shared publication transform remains the boundary before external platform adapters
- scheduled static publication continues to rely on repository state plus rebuild/deploy behavior

Changes to these semantics require an explicit design decision and corresponding migration/tests.

---

## 22. Next step before Codex implementation

Do not begin implementation directly from this document.

Complete an implementation design covering:

```text
D1 schema
→ API contracts
→ route / page structure
→ GitHub App permissions
→ R2 object convention and media URLs
→ preview workflow
→ publication state machine
→ scheduling precision
→ error and conflict flows
→ implementation phases
→ acceptance criteria
```

After that implementation design is approved, hand off to Codex for SDD → TDD → implementation.
