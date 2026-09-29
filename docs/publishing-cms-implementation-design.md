# Publishing CMS Implementation Design

## Status

Approved implementation design for the personal `gcake-dev` Publishing CMS.

This document turns `docs/publishing-cms-architecture.md` into an implementation contract suitable for Codex handoff.

The CMS remains a browser-based interface over the existing Git-backed publishing system. It must preserve repository ownership of article/editorial content while using Cloudflare for authentication, operational state, media, and admin runtime.

---

## 1. Implementation goals

The first complete implementation must support a real end-to-end personal publishing workflow:

```text
GitHub login
→ open/create article
→ edit Markdown / MDX
→ paste/upload media
→ immediate render preview
→ manage frontmatter
→ manage series order
→ schedule publication
→ commit safely to GitHub
→ observe GitHub Pages deployment
→ inspect/retry external publication targets
```

The implementation must be usable without directly editing repository files for routine publishing operations.

Codex and direct Git edits must remain valid parallel workflows.

---

## 2. Final ownership model

### 2.1 Repository SSOT

The GitHub repository remains authoritative for:

- article source: `src/content/posts/**/*.{md,mdx}`
- post frontmatter
- series manifests: `src/content/series/*.yaml`
- section structure
- reading order
- editorial statuses
- distribution mode/fallback
- scheduled publication time

The CMS must always re-read current repository state before formal writes.

### 2.2 R2 media SSOT

R2 owns article media binary objects.

Markdown stores stable public media URLs.

### 2.3 D1 operational SSOT

D1 owns CMS runtime state and publication execution state.

D1 is authoritative for:

- sessions
- UI preferences
- media index metadata
- preview jobs
- GitHub synchronization observations
- external publication runs/attempts
- remote provider IDs/URLs
- retry state
- audit events

D1 is not authoritative for article/editorial content.

---

## 3. Publication state migration

The existing repository file:

`src/data/publishing/publication-state.json`

is a transitional implementation artifact.

### Migration rule

During CMS implementation:

1. Preserve the existing file until the new D1 publication model is tested.
2. Add a one-time importer or compatibility reader if existing non-empty data appears.
3. Do not introduce new independent writes to both D1 and the JSON file.
4. Once D1-backed publication state is accepted, update publishing code to use D1 as the single operational publication-state owner.
5. Remove the JSON state file and update its documentation/tests in the same migration.

No long-term dual-write mode is allowed.

Article publication metadata such as `status` and `publishedAt` remains in Markdown frontmatter and is not moved to D1.

---

## 4. Scheduling precision decision

### Decision

Upgrade local article scheduling from Taipei calendar-day semantics to explicit date-time semantics.

Preferred source representation:

```yaml
publishedAt: 2026-10-15T09:00:00+08:00
```

### Rules

- New CMS-created scheduled posts must write explicit offset-aware ISO timestamps.
- Existing date-only values remain valid and are interpreted as the start of that Taipei calendar day for backward compatibility.
- Public visibility uses the exact instant for date-time values.
- Date-only legacy values preserve existing day-based visibility behavior.
- UI timezone is fixed to `Asia/Taipei` for the first personal-use version.
- The Admin displays both date and time.
- “Publish immediately” writes a published status and a current/appropriate timestamp according to the save action contract.

### Required repository changes

Replace or evolve `isPublishedDate` into publication-time-aware logic used consistently by:

- article routes
- catalog
- series visibility
- topics
- RSS
- search
- navigation

Tests must cover:

- legacy date-only scheduling
- timestamp before due time
- exact due instant
- timestamp after due time
- Taipei offset boundaries
- DST independence for Asia/Taipei
- undated published backward compatibility if retained

The existing hourly GitHub Actions schedule remains acceptable for the first version; the UI must state that actual public appearance may lag until the next deployment run.

---

## 5. Cloudflare application topology

Recommended repository organization may remain inside `gcake-dev` unless implementation complexity justifies a separate package.

Preferred monorepo shape:

```text
apps/
  admin/              # Vue admin frontend
  admin-worker/       # Cloudflare Worker API

packages/
  publishing-contract/
  admin-contract/

src/
  ...existing Astro site...
```

If introducing this structure creates unnecessary migration cost, Codex may use equivalent directories, but the public Astro site and admin runtime must remain clearly separated.

### Runtime components

#### Cloudflare Pages

Hosts the compiled Admin Vue application.

#### Cloudflare Workers

Hosts API endpoints and authentication callbacks.

#### Cloudflare D1

Stores operational/runtime state.

#### Cloudflare R2

Stores media binaries.

---

## 6. Design implementation contract

Admin must extend the existing site design system.

Canonical design inputs:

- `docs/design-system.md`
- `docs/blog-redesign-approved.md`
- `DESIGN.md`
- `src/styles/global.css`
- `design-qa.md`

### Required reuse

- mist-blue / night-mist-blue themes
- existing OKLCH tokens where applicable
- system sans-serif typography
- fine separators
- restrained accents
- existing focus/accessibility conventions
- responsive behavior
- existing dark-mode behavior

### New admin primitives

Codex may introduce only the primitives needed for CMS workflows:

- admin shell
- navigation rail/drawer
- editor toolbar
- status chips
- resizable split pane
- data table/list
- media grid
- modal/dialog
- diff view
- publishing status panel
- toast/inline error surfaces

Avoid an unrelated “generic SaaS dashboard” design.

---

## 7. Admin route structure

Frontend routes:

```text
/
  → Dashboard

/content
  → article list

/content/new
  → create article

/content/:slug
  → article editor

/series
  → series list

/series/:slug
  → series editor

/media
  → media library

/publishing
  → cross-article publication center

/publishing/:slug
  → article publication detail

/settings
  → account/integration/settings

/auth/callback
  → GitHub auth completion
```

Unauthorized users are redirected to login.

---

## 8. API contract

All API responses use JSON unless returning binary/media/preview content.

Recommended base:

```text
/api/v1
```

### 8.1 Auth

```text
GET  /api/v1/auth/login
GET  /api/v1/auth/callback
POST /api/v1/auth/logout
GET  /api/v1/auth/session
```

`session` returns:

```ts
{
  authenticated: boolean
  user?: {
    githubUserId: string
    login: string
    avatarUrl?: string
  }
}
```

### 8.2 Content

```text
GET    /api/v1/posts
POST   /api/v1/posts
GET    /api/v1/posts/:slug
PUT    /api/v1/posts/:slug
DELETE /api/v1/posts/:slug
GET    /api/v1/posts/:slug/diff
```

Article read response:

```ts
{
  slug: string
  path: string
  source: string
  frontmatter: PostFrontmatter
  body: string
  baseBlobSha: string
  baseCommitSha: string
  seriesContext?: {...}
}
```

Formal update request:

```ts
{
  source: string
  expectedBlobSha: string
  expectedCommitSha?: string
  commitMessage?: string
}
```

If the current blob/revision differs, return:

```text
409 Conflict
```

with enough information to fetch/view the latest diff.

### 8.3 Series

```text
GET  /api/v1/series
GET  /api/v1/series/:slug
PUT  /api/v1/series/:slug
POST /api/v1/series
DELETE /api/v1/series/:slug
```

List responses include each manifest's parsed display title and referenced-post count in addition to raw YAML and revision data.

Create request:

```ts
{
  title: string
  slug: string
  expectedBaseCommitSha: string
}
```

Creation writes one `src/content/series/<slug>.yaml` manifest with local defaults and an empty `sections` collection. The target path must be absent when the Git transaction commits.

Update or rename request:

```ts
{
  manifest: SeriesManifest
  expectedBlobSha: string
  expectedBaseCommitSha: string
}
```

When the manifest slug differs from the route slug, the operation is an atomic rename: one Git transaction deletes the old expected blob and creates the new absent path with the new internal slug. A duplicate or concurrently-created target returns `409 SERIES_CONFLICT` and changes neither manifest.

Delete request:

```ts
{
  expectedBlobSha: string
  expectedBaseCommitSha: string
  confirmed: true
}
```

Deletion removes only the series manifest. It never deletes post Markdown or changes article bodies. Local posts formerly referenced by the deleted manifest remain in the general post collection and become standalone posts because series membership and navigation are derived from manifests.

All mutations retain optimistic concurrency. Updates, renames, and deletes include the current blob SHA; every mutation includes the expected base commit. A mismatch returns `409 SERIES_CONFLICT` with current revision details and creates no commit.

### 8.4 Media

```text
GET    /api/v1/media
POST   /api/v1/media/uploads
GET    /api/v1/media/:id
PATCH  /api/v1/media/:id
DELETE /api/v1/media/:id
GET    /api/v1/media/:id/usage
```

Upload creation returns either:

- a Worker-mediated upload target, or
- a short-lived direct R2 upload mechanism

Prefer direct browser-to-R2 upload when it can be implemented safely.

### 8.5 Preview

```text
POST /api/v1/preview/render
POST /api/v1/preview/build
GET  /api/v1/preview/builds/:id
```

`render` is for immediate portable rendering if server assistance is needed.

`build` creates a formal Astro preview job.

### 8.6 GitHub/deploy status

```text
GET  /api/v1/github/repository
GET  /api/v1/github/deployments
GET  /api/v1/github/deployments/latest
POST /api/v1/github/workflows/deploy
```

The dispatch endpoint is optional until explicitly enabled.

### 8.7 Publishing

```text
GET  /api/v1/publishing/posts/:slug
POST /api/v1/publishing/posts/:slug/prepare
POST /api/v1/publishing/posts/:slug/publish
POST /api/v1/publishing/posts/:slug/verify
POST /api/v1/publishing/posts/:slug/retry
```

Requests must name target(s) explicitly.

No external publish should happen merely because content was saved to Git.

---

## 9. D1 schema

Use migrations.

Exact SQL may vary, but the logical schema is fixed.

### users

```text
id
github_user_id UNIQUE
github_login
avatar_url
created_at
last_login_at
```

### sessions

```text
id
user_id
session_token_hash
created_at
expires_at
last_seen_at
```

### user_preferences

```text
user_id
editor_view_mode       # markdown | rendered | split
split_ratio
sync_scroll_enabled
theme_preference
updated_at
```

### media_assets

```text
id
object_key UNIQUE
public_url UNIQUE
filename
mime_type
width
height
original_bytes
stored_bytes
sha256
alt_text
caption
created_at
updated_at
```

Do not treat alt/caption here as article-canonical prose if the Markdown already contains the authoritative alt/caption. The index may store defaults/last-used metadata.

### preview_builds

```text
id
post_slug
source_revision
status                 # queued | running | ready | failed | expired
preview_url
error_code
error_message
created_at
started_at
completed_at
expires_at
```

### publication_runs

```text
id
post_slug
source_revision
operation
created_at
completed_at
overall_status
```

### publication_attempts

```text
id
run_id
target                  # paragraph | substack
operation               # prepare | publish | verify | newsletter
status                  # pending | running | succeeded | failed
remote_id
remote_url
error_code
error_message
started_at
completed_at
```

### publication_targets

Latest known target state per article/target:

```text
post_slug
target
source_revision
status
remote_id
remote_url
published_at
verified_at
newsletter_state
updated_at

PRIMARY KEY(post_slug, target)
```

### github_sync_state

```text
id
repository
observed_commit_sha
observed_at
last_deploy_id
last_deploy_status
```

### audit_events

```text
id
user_id
event_type
resource_type
resource_id
summary
metadata_json
created_at
```

Keep audit payloads small and do not store article bodies unnecessarily.

---

## 10. GitHub App permissions

Use a GitHub App installation restricted to `gcake119/gcake-dev`.

Minimum initial permissions:

```text
Repository metadata: Read
Contents: Read and write
Actions: Read
```

Optional only when workflow dispatch is implemented:

```text
Actions: Write
```

Do not request:

- administration
- issues
- pull requests
- organization access

unless a later feature explicitly requires them.

### Token policy

- keep private key / app secret only in Cloudflare secrets
- request short-lived installation tokens server-side
- never expose installation tokens to browser JavaScript
- browser holds only CMS session credentials

---

## 11. R2 object convention

Use deterministic, human-readable object paths.

Preferred:

```text
posts/<post-slug>/<yyyy>/<mm>/<asset-id>-<sanitized-name>.<ext>
```

Example:

```text
posts/astro-choice/2026/10/01J...-codex-screen.webp
```

Requirements:

- asset ID guarantees uniqueness
- sanitized filename preserves human context
- replacing an asset should normally create a new immutable object key
- old objects can be deleted only after usage checks
- public URLs should use a stable custom host
- Markdown should reference stable public URLs, not signed upload URLs

### Upload processing

Client-side when practical:

- dimension check
- resize
- WebP conversion for screenshots/photos
- preserve PNG when transparency/lossless need justifies it
- preserve SVG as SVG after safety validation
- compute SHA-256 where practical

The Worker validates:

- authenticated user
- allowed MIME
- maximum size
- object key
- metadata

---

## 12. Editor implementation

### 12.1 View mode

Single button cycles:

```text
markdown
→ rendered
→ split
→ markdown
```

Persist mode in user preferences/local fallback.

### 12.2 Split mode

- default 50/50
- draggable divider
- remember ratio
- synchronized scrolling on by default
- user can disable synchronization

### 12.3 Source state

Maintain three conceptual states:

```text
repository base
local/browser working draft
last committed repository version
```

Browser autosave must never be interpreted as a Git save.

### 12.4 Local autosave

Use browser storage for fast recovery.

Key by:

```text
repository + article slug + base revision
```

On reopen:

- if base revision unchanged, offer/restore autosave
- if repository changed, show recovery/conflict workflow

---

## 13. Immediate rendering

Immediate rendered mode should share the public site's content styles.

Implementation should reuse the same Markdown rendering configuration/components where practical.

Requirements:

- headings
- links
- code highlighting
- tables
- figures/images
- captions
- blockquotes
- lists
- inline code

For MDX constructs that cannot be faithfully rendered client-side, show a clear preview limitation and direct the user to Formal Astro Preview.

Do not silently render a misleading approximation of interactive components.

---

## 14. Formal Astro preview workflow

### Goal

Render the exact current working draft using the real site build without first committing it to `main`.

### Preferred design

Use an ephemeral preview revision/workspace generated server-side or through a dedicated preview workflow.

Conceptual flow:

```text
working draft
+ selected repository base revision
↓
preview build request
↓
ephemeral source package/revision
↓
Astro build
↓
temporary preview artifact/site
↓
preview URL
```

The preview must not mutate canonical production content.

### Implementation options

Codex should prefer, in order:

1. Cloudflare-hosted preview build if the Astro build/runtime is practical there.
2. Dedicated GitHub Actions preview workflow using temporary artifacts/preview hosting.
3. Another isolated preview worker/service only if required.

Do not create preview commits on `main`.

If a temporary branch is used, it must be clearly namespaced, automatically cleaned up, and never treated as content SSOT.

### Preview state

Track in D1:

- source revision/base
- requested draft hash
- status
- URL
- error
- expiry

Preview links should expire.

---

## 15. Article creation workflow

```text
New article
↓
enter title
↓
generate/propose slug
↓
select standalone or series
↓
create local working source
↓
edit
↓
save to Git when ready
```

Before first Git save:

- slug must be globally unique
- source path must follow existing content rules
- frontmatter must validate
- series reference updates must be coherent if the article joins a series

Article creation and series-manifest mutation should be committed together when both are required.

---

## 16. Article deletion workflow

Deletion is a destructive operation.

For first complete version:

- require explicit confirmation
- show references from series manifests
- block deletion if references are unresolved
- optionally offer “remove article + update series manifest” as one coherent commit
- do not delete referenced R2 assets automatically
- media cleanup remains a separate usage-aware action

---

## 17. Series Editor contract

Series writes operate directly on YAML source.

The Series list provides create, display-name edit, slug rename, delete, and current article counts. Delete confirmation must state that deleting a series does not delete its articles.

Required validations before commit:

- unique series slug
- unique section IDs within series
- referenced local post slug exists unless status is planned
- planned posts may omit Markdown
- published references must satisfy existing visibility/content rules
- current/next post references must be valid for the intended editorial rules
- no duplicate post slug inside one manifest unless explicitly supported

Drag-and-drop changes are only UI operations until committed.

Series slug is one identity across the internal manifest field, manifest filename, Admin route, public route, derived membership, and static route generation. Rename must update the filename and internal field together; the old slug is not retained as a valid route. No series membership field is added to post frontmatter.

Deleting a populated series is a manifest-only operation. The website must continue to build, post Markdown must remain unchanged, former members must appear as standalone posts, and no series navigation or broken series reference may remain.

---

## 18. Conflict model

### Post conflict

Formal save request includes expected blob SHA.

If mismatch:

```text
409 ARTICLE_CONFLICT
```

Response includes:

- expected SHA
- current SHA
- latest source metadata
- diff endpoint/reference

### Series conflict

Same SHA-based behavior.

### Conflict UI

Offer:

- View diff
- Reload repository version
- Copy local draft
- Manual resolve

Do not provide automatic merge in first version.

### Multi-file coherent write

For operations that update more than one repository file, such as:

- create article + series manifest
- rename article + series reference

use one Git tree/commit transaction rather than independent sequential commits when possible.

---

## 19. Publication state machine

External target state is per target and source revision.

Recommended states:

```text
not_configured
pending
prepared
publishing
published_unverified
verified
publish_failed
verification_failed
stale
manual_required
```

### Meaning

- `not_configured`: target cannot currently publish
- `pending`: revision requires action
- `prepared`: payload prepared successfully
- `publishing`: write in progress
- `published_unverified`: provider write returned success but public verification incomplete
- `verified`: target public result verified
- `publish_failed`: provider write failed
- `verification_failed`: write may have succeeded but verification failed
- `stale`: remote target corresponds to older source revision
- `manual_required`: automation unavailable; user intervention required

### Source revision changes

When article source revision changes:

- existing target record is retained
- if remote sourceRevision differs from current source revision, UI marks target `stale`
- do not automatically publish/update external targets unless explicitly requested

---

## 20. Paragraph workflow

Keep existing shared transform and adapter boundary.

Production implementation sequence:

```text
current source revision
↓
createPortablePublication
↓
Paragraph prepare
↓
explicit publish/update action
↓
verify public result
↓
write D1 publication state
```

Requirements before enabling production write:

- pin supported Paragraph interface/tool version
- verify create/update draft behavior
- verify publish behavior
- verify canonical/original URL handling
- verify update behavior
- verify newsletter behavior separately
- verify retry/idempotency strategy
- verify public result

Newsletter delivery is a separate irreversible intent.

Never send newsletter as an implicit result of an article update retry.

---

## 21. Substack workflow

First complete version does not require automated production writes.

UI states may include:

```text
manual_required
not_configured
```

Publishing Center should still show Substack as a target with its limitation.

Do not implement brittle browser/internal API automation as part of the first complete CMS unless separately approved.

---

## 22. GitHub Pages deployment observation

CMS should read GitHub Actions/deployment state.

Display at least:

- latest workflow run status
- commit SHA
- started/completed time
- deployment URL
- failure status

After a content commit, show:

```text
Saved to Git
→ deployment pending
→ building
→ deployed
```

Do not claim article publication merely because the Git commit succeeded.

For scheduled articles:

- commit may already be deployed
- route remains absent until the publication instant and a subsequent scheduled build

---

## 23. Search implementation

Content Admin search can initially use repository-derived content loaded/indexed in the Admin client/server.

First version does not require an external search service.

Search fields:

- title
- description
- slug
- topics
- body

D1 must not become a canonical full-text article store solely for search.

A derived disposable index is allowed later if scale justifies it.

---

## 24. Error model

API errors should use stable machine-readable codes.

Examples:

```text
UNAUTHENTICATED
FORBIDDEN
ARTICLE_NOT_FOUND
ARTICLE_CONFLICT
SERIES_CONFLICT
INVALID_FRONTMATTER
INVALID_SERIES
MEDIA_TOO_LARGE
MEDIA_TYPE_NOT_ALLOWED
GITHUB_API_FAILED
PREVIEW_BUILD_FAILED
PUBLISH_PREPARE_FAILED
PUBLISH_WRITE_FAILED
PUBLISH_VERIFY_FAILED
TARGET_NOT_CONFIGURED
```

Response shape:

```ts
{
  error: {
    code: string
    message: string
    details?: unknown
    retryable?: boolean
  }
}
```

User-facing messages should be plain Traditional Chinese.

Detailed provider diagnostics may be available in an expandable technical section.

---

## 25. Audit events

Record significant write/operation events:

- login/logout
- Git commit created by CMS
- series update
- media upload/delete
- preview build
- publication prepare/publish/verify/retry
- conflict encountered

Do not log:

- raw access tokens
- secrets
- complete article source by default

---

## 26. Security requirements

- GitHub App private key only in Cloudflare secrets
- provider API credentials only in secrets
- session cookies HttpOnly, Secure, SameSite
- CSRF protection for state-changing requests
- OAuth state validation
- allowlist immutable GitHub user ID
- validate all GitHub paths server-side
- prevent arbitrary repository path writes
- media MIME/type/size validation
- SVG safety handling
- no secret material in D1 audit metadata
- no browser exposure of provider/GitHub installation tokens

---

## 27. Implementation phases

### Phase 0 — repository preparation

- add Admin/Worker package structure
- add shared types/contracts
- configure Cloudflare development environment
- add test harness
- keep production writes disabled

Acceptance:
- existing Astro site tests/build unchanged
- admin app can build independently
- Worker health endpoint works locally

### Phase 1 — GitHub authentication and read-only content

- GitHub App/OAuth login
- user allowlist
- sessions
- read article list/source
- read series
- read GitHub deployment state

Acceptance:
- unauthorized GitHub user cannot enter
- owner can browse current repository content
- no write permissions used by UI yet

### Phase 2 — Editor and safe Git writes

- Markdown/MDX editor
- one-button Markdown → Rendered → Split cycle
- split resize
- sync scroll
- browser autosave
- frontmatter form
- optimistic concurrency
- Git commit
- conflict UI

Acceptance:
- edit/save article to Git
- Codex/external change causes 409 instead of overwrite
- reload shows committed content
- existing content validation still passes

### Phase 3 — Media

- R2
- upload/paste/drag
- browser compression/conversion
- media library
- alt/caption
- usage scan
- insert into Markdown

Acceptance:
- pasted screenshot becomes R2 asset and valid Markdown image
- preview renders it
- unused media can be identified
- used media cannot be accidentally deleted without warning

### Phase 4 — Series and scheduling

- Series Editor
- coherent multi-file Git commits
- date-time `publishedAt`
- repository publication-time migration/tests
- Admin schedule controls

Acceptance:
- reorder planned/unpublished series content
- schedule exact Taipei time
- article is hidden before due instant
- visible after due instant + deployment

### Phase 5 — Formal Astro preview

- preview job contract
- exact site rendering
- temporary URL
- expiry/cleanup

Acceptance:
- unsaved working draft can be rendered through real Astro without touching main
- failed preview shows actionable error
- preview expires/cleans up

### Phase 6 — Publishing Center and D1 migration

- D1 publication state
- migrate/remove JSON publication state
- GitHub Pages observation
- Paragraph prepare integration
- retry/error UI
- Substack manual/disabled state

Acceptance:
- each target state independent
- source revision staleness visible
- no JSON/D1 dual-write
- GitHub Pages failure does not corrupt article content
- Substack limitation clearly represented

### Phase 7 — Paragraph production gate

Only after explicit approval and provider verification:

- enable Paragraph write
- update/create
- verify
- newsletter opt-in handling

Acceptance:
- dry run first
- remote ID persisted
- retries do not duplicate posts/newsletters
- public result verified

---

## 28. Testing strategy

Follow existing SDD/TDD workflow.

### Unit tests

- frontmatter parsing
- scheduling/time semantics
- series validation
- API validation
- publication state transitions
- R2 key generation
- conflict detection
- auth allowlist logic

### Integration tests

- GitHub content read/write against mocked/fake GitHub boundary
- D1 migrations/repositories
- R2 media metadata/object flow
- Paragraph adapter boundary
- preview orchestration state

### E2E

Use browser E2E for:

- GitHub-login mocked/dev flow
- article list
- editor mode cycling
- split-pane behavior
- paste/upload image
- commit save
- conflict
- series reorder
- scheduling
- Publishing Center state

### Visual/UI QA

Use existing design rules and inspect:

- desktop
- mobile
- light
- dark
- keyboard navigation
- long Markdown
- wide code
- tables
- images
- dialogs
- split editor

---

## 29. Definition of done for first complete version

The CMS is considered complete for first personal production use when the user can:

1. sign in with the authorized GitHub account
2. browse all local articles
3. create/edit a Markdown or MDX article
4. cycle one button through Markdown, Rendered, and Split views
5. resize and sync the split view
6. preview normal Markdown immediately
7. request a real Astro preview
8. paste/upload an image and insert it into the article
9. manage media through R2
10. edit frontmatter
11. manage series order/sections
12. schedule publication at a Taipei date/time
13. save through a safe Git commit
14. receive a conflict instead of silent overwrite
15. observe GitHub Pages deployment state
16. inspect publication state per target
17. prepare/retry Paragraph operations safely
18. see Substack represented as disabled/manual when automation is unavailable
19. use the Admin on desktop and mobile with the existing `gcake-dev` design language
20. recover from browser refresh without losing an uncommitted working draft

---

## 30. Codex handoff gate

This implementation design is sufficient to begin Codex SDD/TDD work.

Before writing production code, Codex should:

1. read:
   - `docs/publishing-cms-architecture.md`
   - this document
   - `docs/design-system.md`
   - `docs/blog-redesign-approved.md`
   - `DESIGN.md`
   - `docs/editorial-series.md`
   - `docs/article-scheduling.md`
   - `docs/multi-platform-publishing.md`
   - relevant current publishing/content tests
2. produce an implementation proposal/spec split by phases above
3. preserve current public-site behavior until each migration phase is explicitly implemented
4. start TDD from Phase 0/1
5. keep external provider writes disabled until their production gate is separately approved
