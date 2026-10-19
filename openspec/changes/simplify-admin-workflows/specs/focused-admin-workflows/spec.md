## Purpose

Provide focused everyday editing and publication management in the personal Publishing Admin. Keep each operation understandable through bounded action groups and plain Traditional Chinese wording without changing content authority or release safety.

## ADDED Requirements

### Requirement: Focused workspace navigation
The Admin SHALL default to Articles and provide Articles, Series, and Publishing navigation. Articles SHALL retain a compact next-release and attention summary without placing the complete release list before article discovery. New-article and new-series forms SHALL open only on request. Returning from an editor SHALL restore the originating list and filters.

#### Scenario: Find and return to an article
- **GIVEN** the owner has filtered Articles to one series
- **WHEN** the owner opens an article and returns without changing it
- **THEN** the same filtered article list is visible and the complete publishing queue remains in Publishing

#### Scenario: No articles match
- **GIVEN** the selected article filter has no matching content
- **WHEN** the owner views Articles
- **THEN** a plain empty-state explanation is visible and the filter remains usable

### Requirement: Two-button operation contexts
Every operation action group SHALL contain at most two directly available buttons, including a More actions button when present. A context SHALL correspond to one user task or selected record, not an arbitrary wrapper used to evade the limit. Additional operations SHALL be disclosed through settings or a menu instead of another simultaneous button row. Article editing SHALL expose Save article alone in the main toolbar and a two-icon tool group for cycling views and inserting images; series editing SHALL expose Save series and Add section. A confirmation SHALL expose only its confirm and cancel/back actions. Navigation links, selectors, and checkboxes SHALL retain their correct semantics and SHALL NOT disguise mutation actions.

#### Scenario: Edit without competing destructive operations
- **GIVEN** an article is open
- **WHEN** the owner inspects the editor action group
- **THEN** only 儲存文章 is present and deletion and immediate publication are disclosed separately in their relevant settings

#### Scenario: Expanded operations stay bounded
- **GIVEN** article settings, series settings, schedule adjustment, media management, or conflict recovery is expanded
- **WHEN** the owner inspects each task action group
- **THEN** no group contains more than two buttons and a third action is not placed in a second row for the same task

#### Scenario: Cancel an exceptional operation
- **GIVEN** the owner starts deletion or immediate publication
- **WHEN** the owner cancels its confirmation
- **THEN** the content, schedule, and publication state remain unchanged

### Requirement: Plain interface language
Everyday control labels, system statuses, hints, confirmations, and operation feedback SHALL use understandable Traditional Chinese. Labels SHALL include 儲存文章, 儲存系列, 網址代稱, 原文, 預覽, and 並排 where applicable. Storage tools, file formats, revision identifiers, internal codes, and raw status values SHALL NOT appear in everyday system copy. Provider names and owner-authored content SHALL remain intact. Unrecognized provider status or technical failure SHALL produce an honest plain fallback with an actionable next step instead of claiming success.

#### Scenario: Understand saved and published states
- **GIVEN** an article save succeeds but public verification is not complete
- **WHEN** the owner sees the result
- **THEN** the message states 文章已儲存 and does not claim confirmed public availability or notification delivery

#### Scenario: Unknown provider state
- **GIVEN** a publication target returns an unrecognized state
- **WHEN** the owner views its status
- **THEN** the interface states 狀態待確認 and offers the existing detail or checking path without exposing the internal state value or offering unconditional republication

### Requirement: Source-preserving editing and feedback
Navigation and disclosure SHALL preserve current unsaved article and series work unless the owner explicitly confirms discarding it. Successful saving SHALL preserve content status unless the owner explicitly finalizes. Save conflicts and failures SHALL leave the working content available and explain recovery. Contextual busy state SHALL prevent duplicate submission of the same save or finalization.

#### Scenario: Decline discarding unsaved work
- **GIVEN** the current article or series has unsaved changes
- **WHEN** the owner requests navigation and declines discarding
- **THEN** the current workspace and all working changes remain visible

#### Scenario: Save conflict
- **GIVEN** another source changes the article while it is open
- **WHEN** saving fails with a revision conflict
- **THEN** the working text remains available with a plain conflict explanation and recovery choices, without a success message

### Requirement: Contextual scheduling and locked series
The Publishing list SHALL disclose per-article operations through at most two row buttons. Series pause/resume SHALL appear once at series scope rather than on every article row. Schedule preview and confirmation SHALL be separate steps that retain existing conflict and affected-date checks. Cancel fixed time SHALL be available only for a known fixed future slot. A started series SHALL show plain ordering-lock explanation and read-only ordinal positions instead of drag handles and inactive movement buttons.

#### Scenario: Adjust a scheduled article
- **GIVEN** a scheduled article has been selected
- **WHEN** the owner previews a new date
- **THEN** affected dates and conflicts are shown before confirmation and neither stage exposes more than two buttons

#### Scenario: Inspect a started series
- **GIVEN** a series has started publication
- **WHEN** its editor is opened
- **THEN** ordering is shown as locked with numbered articles and no draggable handles or movement buttons

### Requirement: Accessible responsive workspaces
The Admin SHALL retain the existing light/dark design language, labeled controls, keyboard focus, and responsive layout. The editor SHALL prioritize body work, disclose metadata/publication settings on demand, and keep its save action reachable while reading long drafts. Sticky controls SHALL NOT obscure focused controls at narrow widths or zoom.

#### Scenario: Narrow editing
- **GIVEN** the owner uses a 390 CSS-pixel viewport
- **WHEN** the owner edits, opens settings, and moves focus through controls
- **THEN** content and actions are reachable without page-level horizontal scrolling and keyboard focus is not hidden by the action bar

#### Scenario: Publication evidence remains separate
- **GIVEN** deployment completed but page verification and external notification remain unconfirmed
- **WHEN** the owner views publication information
- **THEN** those outcomes are shown separately and no interface simplification marks them all complete

### Requirement: Direct media entry
One labeled SVG image button SHALL open the media library directly. The dialog SHALL explain that images can be pasted or dragged into it and SHALL support both actions through existing upload and insertion behavior. Opening or closing SHALL NOT change article content. Closing with Escape SHALL return focus to the image button.

#### Scenario: Open and close media library
- **GIVEN** an article with unsaved content
- **WHEN** the owner activates the image icon and presses Escape
- **THEN** the dialog closes, focus returns to the image icon and article content remains unchanged

#### Scenario: Paste or drop an image
- **GIVEN** the media library is open
- **WHEN** the owner pastes or drops an image and uploading succeeds
- **THEN** the image is inserted into the working article and the dialog closes without saving or publishing

#### Scenario: Upload fails or input is not an image
- **GIVEN** the media library is open
- **WHEN** uploading fails or pasted content contains no image
- **THEN** article content stays unchanged and an upload failure is explained in plain language when applicable

### Requirement: Article settings hierarchy
Article settings SHALL distinguish 基本資料 and 文章網址 with section headings, field labels and nearby help. Title and read-only series information SHALL appear in 基本資料. Website-preview and publication settings SHALL remain separate. Low-frequency backup and deletion SHALL appear under a separate 其他管理 disclosure, with deletion visibly separated and confirmed through the existing flow. Opening settings SHALL NOT save or discard edits.

#### Scenario: Edit basic details
- **GIVEN** an unsaved article
- **WHEN** the owner opens article settings and edits its title or URL
- **THEN** clearly grouped fields retain changes without submitting a save, and deletion is absent from those groups

#### Scenario: Open other management
- **GIVEN** article settings are visible
- **WHEN** the owner opens 其他管理
- **THEN** backup and deletion are explained separately, each operation has at most two buttons and deleting still requires confirmation

### Requirement: Adopted Admin visual foundations
The Admin SHALL follow the owner-adopted design supplement in docs/design-system.md. It SHALL use 26px page titles (20px at widths up to 760px), 20px major headings, 16px settings headings, 17px body/input/button text, and 14px labels/help/status text, expressed relative to the 17px root. Important error feedback SHALL retain body size. Spacing SHALL use 4/8/12/16/20/24/32/48px by documented role, with 24px settings section padding, 32px desktop settings column gap and 8px label/input gap. The Admin frame SHALL retain a 72rem maximum, 24px desktop and 20px mobile gutters; reading preview SHALL use at most 44rem and 1.9 line height. Controls SHALL have at least 44px height, icon buttons SHALL be 44px square with 22px SVG, and control radius SHALL be 5px.

#### Scenario: Desktop settings hierarchy
- **GIVEN** an article with unsaved content on a desktop wider than 760px
- **WHEN** the owner opens article settings
- **THEN** page/settings headings, labels and input text follow the documented sizes, section padding and column gap follow their roles, and no content is saved or discarded

#### Scenario: Mobile long title and long draft
- **GIVEN** a long article title and draft at a 390px viewport
- **WHEN** settings and preview are opened and keyboard focus moves through the page
- **THEN** the page title is 20px, input/button text remains 17px, settings stack in one column, reading content fits the viewport, and the save control and focused field remain visible without page-level horizontal scrolling

### Requirement: Shared theme and SVG contracts
The Admin SHALL preserve the public site's shared light/dark brand color values and expose danger, warning and overlay as root-level semantic variables. Components SHALL NOT introduce literal color values. Warning markers SHALL retain readable main-color explanatory text and explicit status wording. Astro and Vue SHALL render shared SVG path data through their own templates with a 24px viewBox, 1.7 currentColor stroke and round line caps/joins; the existing public icon appearance SHALL be preserved. Theme switching SHALL NOT modify or save working article content.

#### Scenario: Four visual combinations
- **GIVEN** desktop and 390px viewports in both light and dark themes
- **WHEN** the owner opens settings and the media dialog
- **THEN** hierarchy, documented controls and themed overlay remain consistent, SVG controls have accessible names, and working article content is unchanged

#### Scenario: Visible failure feedback in both themes
- **GIVEN** a failed save or revision conflict with unsaved content
- **WHEN** the owner reads feedback in either theme
- **THEN** body-sized readable text explains the result, color is not the only signal, and no success, publication or notification completion is invented
