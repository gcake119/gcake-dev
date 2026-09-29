## MODIFIED Requirements

### Requirement: Optimistic concurrency on formal saves

Post writes and every series create, update, rename, and delete operation SHALL include the expected repository base revision. Post and existing-series writes SHALL include the expected blob SHA. Series creation and rename targets SHALL assert that the target path is absent. The Worker SHALL return HTTP 409 with `ARTICLE_CONFLICT` or `SERIES_CONFLICT` when any current revision or target-presence expectation differs, without creating a commit.

#### Scenario: Codex changes an open article

- **WHEN** Codex commits a newer article blob after the CMS loaded its base SHA and the owner saves from the CMS
- **THEN** the Worker creates no overwrite commit and returns current revision information for diff, reload, or manual resolution

#### Scenario: Another source changes an open series

- **WHEN** another source commits a newer series manifest after the CMS loaded its base SHA and the owner updates, renames, or deletes from the CMS
- **THEN** the Worker creates no overwrite commit and returns HTTP 409 `SERIES_CONFLICT` with current revision information

#### Scenario: Rename target appears concurrently

- **WHEN** a target series slug becomes present after the CMS uniqueness check but before the rename transaction
- **THEN** the Worker creates no commit and returns HTTP 409 `SERIES_CONFLICT`

### Requirement: Coherent repository commits

Operations that change an article and related series manifest, or rename a series manifest path and internal identity, SHALL validate all source first and create one Git tree/commit transaction against the expected base commit.

#### Scenario: Create series article

- **WHEN** a new article joins a series and both the post and manifest validate against the expected revisions
- **THEN** one commit contains both changes, or no repository file changes if the transaction fails

#### Scenario: Rename series identity

- **WHEN** an existing series changes from `old-series` to the available slug `new-series` and all revisions validate
- **THEN** one commit deletes the old manifest path and creates the new manifest path with internal slug `new-series`, or no repository file changes if the transaction fails
