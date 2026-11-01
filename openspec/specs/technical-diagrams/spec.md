# technical-diagrams Specification

## Purpose

Keep technical diagrams editable in Git and deliver verified SVG images without a runtime diagram service.

## Requirements

### Requirement: Safe diagram conversion
The project SHALL convert one selected Mermaid source or all sources recursively into matching SVG paths, using pinned local tools. Conversion failure SHALL return a nonzero status and preserve previous valid outputs. Sources outside the diagram directory SHALL be rejected.

#### Scenario: Convert nested source
- **GIVEN** a valid source named docs/diagrams/nested/example.mmd
- **WHEN** the author converts that source
- **THEN** public/diagrams/nested/example.svg is generated with provenance and other diagrams remain unchanged

#### Scenario: Failed conversion
- **GIVEN** a valid existing SVG and an invalid updated source
- **WHEN** conversion fails
- **THEN** the command reports the failing source and preserves the existing SVG and provenance

#### Scenario: Invalid selection
- **GIVEN** a file outside docs/diagrams or an empty batch
- **WHEN** conversion is requested
- **THEN** outside paths are rejected and an empty batch succeeds without launching a browser

---
### Requirement: Browser-free diagram verification
The project SHALL detect missing, extra, altered or stale outputs and changes to conversion inputs without launching a browser. Markdown and MDX diagram image references SHALL resolve to tracked diagram outputs and include nonempty alternative text. Unsupported Mermaid fences SHALL fail validation.

#### Scenario: Source or output drift
- **GIVEN** a previously generated diagram
- **WHEN** its source, output or conversion configuration changes without regeneration
- **THEN** verification fails with a regeneration instruction

#### Scenario: Invalid article image
- **GIVEN** an article with a missing diagram target, empty alt text or Mermaid fence
- **WHEN** verification runs
- **THEN** verification identifies the article and the invalid reference or fence

---
### Requirement: Static diagram delivery
The existing Astro build SHALL copy verified SVG bytes to the corresponding built diagram path without changing Markdown or MDX rendering. Technical diagrams SHALL use readable Chinese text, service groups, directed data flows and an opaque background suitable for both site themes. Dense mobile diagrams SHALL retain access to a readable full-size image.

#### Scenario: Built image
- **GIVEN** verified source and SVG pairs referenced by an article
- **WHEN** the Astro build completes
- **THEN** built diagram bytes match the verified SVG and article image links retain the configured site base

#### Scenario: Visual review
- **GIVEN** the regenerated architecture diagram
- **WHEN** it is reviewed on desktop and mobile in both themes
- **THEN** labels and arrows remain present without clipping and the full-size image is readable without changing the article argument
