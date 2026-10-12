## Purpose

Measure traffic on the production reading site and establish owner-visible Google search reporting without changing publication architecture.

## ADDED Requirements

### Requirement: Production-only traffic measurement

The site SHALL load the official Cloudflare beacon once per document only when the production deployment explicitly enables measurement with a valid public beacon token. Measurement SHALL cover every public reading page under https://gcake119.github.io/gcake-dev/ regardless of its source canonical.

#### Scenario: Public articles are measured

- **GIVEN** a production deployment with measurement enabled and a valid token
- **WHEN** a reader opens the homepage, a local article or an imported series article
- **THEN** the page loads one official Cloudflare beacon with the configured token

#### Scenario: Development and preview are excluded

- **GIVEN** a development server, an ordinary build without production measurement enabled, or a production artifact served on localhost or a preview domain
- **WHEN** a reader opens a page
- **THEN** no Cloudflare beacon is requested

#### Scenario: Other projects and repeated execution are excluded

- **GIVEN** a production artifact served under another path, a lookalike path such as /gcake-dev-preview/, or a page already containing the Cloudflare beacon
- **WHEN** the measurement bootstrap executes
- **THEN** it loads no additional beacon

#### Scenario: Invalid configuration fails closed

- **GIVEN** production measurement is enabled with a missing or malformed token
- **WHEN** the website is built
- **THEN** the build fails with an actionable configuration error without printing the token

### Requirement: Search Console verification and evidence

The site SHALL support an optional Google HTML verification tag in its shared page head. The operator SHALL verify the selected account and existing properties before creating a URL-prefix property. Existing sitemap and source-aware canonical rules SHALL remain unchanged until the owner resolves the legacy canonical question. Completion SHALL distinguish code/build evidence, production deployment, Cloudflare received traffic, Google verification, sitemap acceptance and indexing.

#### Scenario: Verification tag is published

- **GIVEN** an owner-selected account and an assigned HTML verification value
- **WHEN** the production website is built with that value
- **THEN** its homepage contains one Google verification tag in the head

#### Scenario: Missing verification value leaves SEO intact

- **GIVEN** no Google verification value is configured
- **WHEN** the website is built
- **THEN** no empty Google verification tag is emitted and existing canonical and metadata remain intact

#### Scenario: Provider evidence is still pending

- **GIVEN** local tests pass but provider acceptance or indexing has not been observed
- **WHEN** setup progress is reported
- **THEN** pending provider states remain explicitly unconfirmed
