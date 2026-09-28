# safe-content-editor Specification

## Purpose

TBD - created by archiving change 'publishing-cms'. Update Purpose after archive.

## Requirements

### Requirement: Single cyclic view control
The Editor SHALL use one control that cycles exactly `markdown → rendered → split → markdown`, preserving the working source and practical cursor/reading positions across transitions.

#### Scenario: Complete view cycle
- **WHEN** the owner activates the view control three consecutive times from Markdown mode
- **THEN** the visible modes are Rendered, Split, and Markdown in that order without source loss

---
### Requirement: Resizable synchronized split view
Split mode SHALL default to a 50/50 ratio, provide a keyboard-operable draggable divider, persist the chosen ratio, synchronize scrolling by default, and allow synchronization to be disabled.

#### Scenario: Restore split preferences
- **WHEN** the owner changes the ratio, disables synchronized scrolling, and reopens the Editor
- **THEN** the prior ratio and synchronization preference are restored

---
### Requirement: Honest immediate rendering
Immediate preview SHALL render portable Markdown content with public-site content styles and SHALL surface a limitation for unsupported MDX instead of rendering a misleading substitute.

#### Scenario: Unsupported interactive MDX
- **WHEN** the working source contains an MDX construct unavailable to immediate preview
- **THEN** the Editor identifies the limitation and offers Formal Astro Preview while retaining the source

---
### Requirement: Revision-keyed browser recovery
Browser autosave SHALL be separate from Git save and keyed by repository, article slug, and base revision.

#### Scenario: Repository changed after autosave
- **WHEN** a local draft exists for an older base revision and the repository article has changed
- **THEN** the Editor enters recovery/conflict handling and does not apply the draft silently over the newer source

---
### Requirement: Optimistic concurrency on formal saves
Post and series writes SHALL include expected blob SHA and SHALL return HTTP 409 with `ARTICLE_CONFLICT` or `SERIES_CONFLICT` when the current SHA differs, without creating a commit.

#### Scenario: Codex changes an open article
- **WHEN** Codex commits a newer article blob after the CMS loaded its base SHA and the owner saves from the CMS
- **THEN** the Worker creates no overwrite commit and returns current revision information for diff/reload/manual resolution

---
### Requirement: Coherent repository commits
Operations that change an article and related series manifest SHALL validate all source first and create one Git tree/commit transaction against the expected base commit.

#### Scenario: Create series article
- **WHEN** a new article joins a series and both the post and manifest validate against the expected revisions
- **THEN** one commit contains both changes, or no repository file changes if the transaction fails

---
### Requirement: Guarded destructive deletion
Article deletion SHALL require explicit confirmation, report series references, and block deletion while unresolved references remain; it SHALL NOT delete R2 objects automatically.

#### Scenario: Referenced article deletion
- **WHEN** the owner requests deletion of a post still referenced by a series manifest
- **THEN** deletion is blocked until the manifest is coherently updated or the operation is cancelled
