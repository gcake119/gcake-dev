## ADDED Requirements

### Requirement: Create an empty series

The Publishing Admin SHALL allow the owner to create a series from a non-empty display name and a unique lowercase kebab-case slug. Creation SHALL write one canonical `src/content/series/<slug>.yaml` manifest with an empty sections collection through the Git write model.

#### Scenario: Create a valid empty series

- **GIVEN** no manifest exists for slug `agent-workflows`
- **WHEN** the owner creates `Agent Workflows` with slug `agent-workflows`
- **THEN** one Git commit creates `src/content/series/agent-workflows.yaml` whose internal slug is `agent-workflows` and whose sections collection is empty

#### Scenario: Reject a duplicate slug

- **GIVEN** `src/content/series/agent-workflows.yaml` already exists
- **WHEN** the owner attempts to create another series with slug `agent-workflows`
- **THEN** the operation returns a clear series conflict and creates no commit

#### Scenario: Reject an invalid slug

- **WHEN** the owner attempts to create a series with a slug outside the lowercase kebab-case format
- **THEN** the Admin identifies the slug validation problem and creates no commit

### Requirement: Edit series metadata without changing membership

The Publishing Admin SHALL allow the owner to edit a series display name and SHALL preserve every existing section, article reference, status, editorial pointer, unknown manifest field, and ordering unless the owner explicitly edits that content.

#### Scenario: Change display name only

- **GIVEN** a series contains ordered article references and editorial pointers
- **WHEN** the owner changes only its display name and saves
- **THEN** the saved manifest has the new display name and unchanged membership, ordering, statuses, and editorial pointers

### Requirement: Rename a series identity atomically

The Publishing Admin SHALL treat a slug change as an atomic series identity rename that updates the manifest filename and internal slug together while preserving the rest of the manifest. The new slug SHALL be checked for format, absence, and concurrent creation before commit.

#### Scenario: Rename a populated series

- **GIVEN** series `old-series` contains ordered references `one` then `two`
- **WHEN** the owner renames it to `new-series`
- **THEN** one Git commit deletes `src/content/series/old-series.yaml`, creates `src/content/series/new-series.yaml` with internal slug `new-series`, and preserves references `one` then `two`

#### Scenario: Reject rename collision

- **GIVEN** manifests already exist for `old-series` and `new-series`
- **WHEN** the owner attempts to rename `old-series` to `new-series`
- **THEN** the operation returns a clear series conflict and changes neither manifest

#### Scenario: Old slug stops resolving

- **WHEN** a rename from `old-series` to `new-series` succeeds
- **THEN** Admin and public route generation recognize only `new-series`, and no generated series navigation or derived index refers to `old-series`

### Requirement: Delete a series without deleting posts

The Publishing Admin SHALL require explicit confirmation before deleting a series and SHALL state that deletion does not delete articles. A confirmed deletion SHALL remove only the series manifest; local post Markdown and article bodies SHALL remain unchanged and SHALL become standalone content.

#### Scenario: Delete an empty series

- **GIVEN** an empty series manifest exists
- **WHEN** the owner confirms deletion
- **THEN** one Git commit deletes only that manifest

#### Scenario: Delete a populated series

- **GIVEN** a local series references existing Markdown posts
- **WHEN** the owner confirms deletion
- **THEN** the manifest is deleted, every referenced post file remains unchanged, the posts remain in the general article list, and they no longer display series navigation

#### Scenario: Cancel deletion

- **WHEN** the owner does not provide explicit confirmation
- **THEN** the operation reports that confirmation is required and creates no commit

### Requirement: Series list lifecycle controls

The Series list SHALL display every series name, slug, and current referenced-article count, and SHALL provide controls to create, edit, rename, and delete series using the existing Admin design system and accessible control conventions.

#### Scenario: View series article counts

- **GIVEN** one series references three posts and another references no posts
- **WHEN** the owner opens the Series list
- **THEN** the list displays counts of three and zero beside the corresponding series

#### Scenario: Delete warning is explicit

- **WHEN** the owner starts deleting a series
- **THEN** the confirmation states that the series manifest will be deleted and its articles will not be deleted

### Requirement: Series lifecycle writes preserve optimistic concurrency

Every series create, update, rename, and delete operation SHALL include the expected repository base revision. Updates, renames, and deletes SHALL also include the expected source blob revision. A stale revision SHALL return `SERIES_CONFLICT` and SHALL NOT create a commit or silently overwrite repository content.

#### Scenario: Concurrent manifest modification

- **GIVEN** the CMS loaded a series at blob `series-old` and another source committed blob `series-new`
- **WHEN** the owner updates, renames, or deletes using `series-old`
- **THEN** the API returns HTTP 409 `SERIES_CONFLICT` with current revision information and creates no commit

#### Scenario: Concurrent creation at rename target

- **GIVEN** the rename target did not exist when the editor loaded but exists before the transaction commits
- **WHEN** the owner saves the rename
- **THEN** the API returns HTTP 409 `SERIES_CONFLICT` and preserves both current repository manifests
