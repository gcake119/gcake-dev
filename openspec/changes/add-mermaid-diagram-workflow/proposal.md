## Why
The fifth article has an editable Mermaid source but a hand-maintained SVG. Future changes need reproducible conversion and inexpensive drift detection without changing the CMS media workflow.

## What Changes
- Add pinned local Mermaid CLI conversion, atomic SVG replacement and browser-free provenance checks.
- Validate diagram references and built static assets through existing test/build gates.
- Document technical diagram ownership and regenerate the fifth article diagram for visual comparison.

## Capabilities
### New Capabilities
- `technical-diagrams`: Editable diagram sources, safe conversion and verified static delivery.
### Modified Capabilities
None.

## Impact
- Modified: package.json, pnpm-lock.yaml, AGENTS.md, public/diagrams/blog-system-architecture.svg, docs/diagrams/blog-system-architecture.mmd, docs/decisions/index.md, scripts/publishing/release-dry-run.ts, scripts/workspace/foundation.test.ts, .github/workflows/validate-pr.yml, .github/workflows/validate-editorial.yml.
- New: scripts/diagrams/, docs/mermaid-diagrams.md, docs/diagrams/mermaid-config.json, public/diagrams/manifest.json.
- Existing media-library requirements remain unchanged; no publication, deployment or provider writes.
