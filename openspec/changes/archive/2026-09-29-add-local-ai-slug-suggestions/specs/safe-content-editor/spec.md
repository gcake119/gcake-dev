## ADDED Requirements

### Requirement: Editable AI slug suggestion

The Editor SHALL place an explicit slug generation control next to the article title and slug fields for new and existing articles, fill the editable slug field on success, and preserve user control over the final value.

#### Scenario: User edits a suggestion

- **WHEN** the service returns `add-gherkin-to-sdd-workflow` and the user changes it to `gherkin-sdd-acceptance-workflow`
- **THEN** the manually edited value remains the value submitted to existing CMS validation

#### Scenario: Title changes after slug exists

- **WHEN** an article already has a slug and the user modifies its title
- **THEN** the Editor does not request or apply another suggestion until the user explicitly activates `產生 slug`

### Requirement: Existing validation remains authoritative

AI suggestions SHALL pass through the existing slug format and duplicate validation during formal save, and generation SHALL NOT decide uniqueness.

#### Scenario: Suggested slug already exists

- **WHEN** a generated suggestion conflicts with an existing article slug and the user attempts to save it
- **THEN** the existing CMS validation blocks the duplicate and creates no Git commit

### Requirement: Production GitHub writes remain bounded and atomic

The Worker SHALL use the configured GitHub App installation credentials to perform content saves without persisting credentials or exposing a generic arbitrary-path deletion API, and SHALL make content changes visible through exactly one non-force default-branch ref update after optimistic checks pass.

#### Scenario: Save through the production Worker

- **GIVEN** the Worker has valid GitHub App installation credentials and the article base commit is current
- **WHEN** the authenticated owner saves an article
- **THEN** the Worker creates the required Git objects and advances the default branch once without exposing the installation token

#### Scenario: Branch changes during a save

- **GIVEN** another writer advances the default branch after the CMS read its base commit
- **WHEN** the CMS attempts its non-force ref update
- **THEN** the save returns a conflict and does not overwrite the newer branch head

### Requirement: Slug rename preserves every series reference

When an existing local article slug changes, the Worker SHALL update every matching series post entry and editorial pointer in the same Git transaction as creating the new post path and removing the old post path.

#### Scenario: Rename an article referenced by multiple series locations

- **GIVEN** `old-slug` is referenced by series post entries and an editorial pointer
- **WHEN** the owner saves the article as `new-slug`
- **THEN** the new post path, old post removal, and all affected series manifests become visible in one commit with every reference changed to `new-slug`

#### Scenario: Referencing series changed concurrently

- **GIVEN** a referencing series manifest no longer has the blob SHA read for the rename
- **WHEN** the owner attempts to save the new slug
- **THEN** the rename is rejected as a conflict and neither post path nor any series reference changes
