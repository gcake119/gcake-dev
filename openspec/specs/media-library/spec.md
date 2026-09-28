# media-library Specification

## Purpose

TBD - created by archiving change 'publishing-cms'. Update Purpose after archive.

## Requirements

### Requirement: R2 media ownership
Uploaded media binaries SHALL be stored in R2 under immutable keys shaped as `posts/<post-slug>/<yyyy>/<mm>/<asset-id>-<sanitized-name>.<ext>`, and Markdown SHALL store the stable public media URL.

#### Scenario: Paste screenshot
- **WHEN** the owner pastes an allowed screenshot into the Editor
- **THEN** the client processes it, R2 stores a uniquely keyed object, and the Editor inserts valid image Markdown using the stable public URL

---
### Requirement: Validated upload path
The client SHALL perform practical resize/conversion/hash work, and the Worker SHALL validate authentication, MIME type, size, object key, and metadata before accepting an upload.

#### Scenario: Disallowed upload type
- **WHEN** an authenticated user attempts to upload a disallowed MIME type
- **THEN** the Worker rejects it with `MEDIA_TYPE_NOT_ALLOWED` and creates neither an R2 object nor a D1 media record

---
### Requirement: Operational media index
D1 SHALL index object identity, dimensions, sizes, hash, timestamps, and reusable metadata defaults without becoming authoritative for article alt text, captions, or binary content.

#### Scenario: Article-specific alt text
- **WHEN** the owner changes image alt text in Markdown
- **THEN** the article source remains authoritative even if the media index contains a different last-used default

---
### Requirement: Usage-aware media management
The Media Library SHALL support search, preview, insert, copy URL, replacement, usage inspection, unused detection, and guarded deletion.

#### Scenario: Delete used asset
- **WHEN** repository usage scanning finds the selected asset URL in an article
- **THEN** the UI warns and blocks accidental deletion unless a separately confirmed safe replacement/removal workflow resolves the usage

---
### Requirement: Immutable replacement
Replacing an asset SHALL create a new object key and SHALL NOT mutate bytes at an existing public key.

#### Scenario: Replace an image
- **WHEN** the owner uploads a replacement for an existing image
- **THEN** the new object receives a new stable URL and existing Git revisions continue to resolve the old object until separately cleaned up
