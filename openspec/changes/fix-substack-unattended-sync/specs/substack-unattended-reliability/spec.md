## Purpose

Restore unattended Substack synchronization using the existing approved native browser transport and durable publication identity. Preserve exact source verification, minute precision and zero email or App delivery.

## ADDED Requirements

### Requirement: Complete native discovery

The synchronizer SHALL scan every published, draft and scheduled article before creation, using a verified current browser identity and current rendered controls. Navigation completion SHALL NOT substitute for article-list readiness. A failed or incomplete scan SHALL block article creation.

#### Scenario: Existing article is discovered
- **GIVEN** a matching article exists in one of the three article lists
- **WHEN** an unattended round scans the lists
- **THEN** it returns that existing article identity and creates no replacement

#### Scenario: Empty scheduled list is complete
- **GIVEN** published and draft lists match their visible totals and the scheduled list displays its empty state
- **WHEN** discovery completes
- **THEN** the empty list is accepted without replaying an article operation

#### Scenario: Incomplete or changed browser identity
- **GIVEN** a list total conflicts with observed articles or the browser identity changes
- **WHEN** discovery runs
- **THEN** it stops before article creation or publication

### Requirement: Public date evidence matches HTML semantics

Anonymous verification SHALL interpret HTML attribute names without case sensitivity, require one unambiguous valid publication instant and compare the approved source minute. Missing, conflicting, invalid or wrong-minute evidence SHALL fail closed.

#### Scenario: Equivalent HTML spelling
- **GIVEN** the same public article exposes a publication instant through datetime or dateTime
- **WHEN** its complete public evidence is verified
- **THEN** both spellings produce the same verified original identity

#### Scenario: Wrong or ambiguous date
- **GIVEN** publication date evidence is missing, conflicting, invalid or differs from the approved minute
- **WHEN** public verification runs
- **THEN** the round reports attention and does not replay publication

### Requirement: Preserve website-only publication and recovery

A new approved article SHALL be published once without email or App delivery, then retain its original identity through date restoration and verification. A repeated verified source version SHALL only read public evidence. Unknown results SHALL retain their original intent and SHALL NOT trigger automatic creation or publication retries. Source connection failures SHALL block writes without assuming the source is current.

#### Scenario: First publication and date restoration
- **GIVEN** an eligible original and no matching remote article
- **WHEN** an authorized unattended round prepares and publishes the mirror
- **THEN** it completes any website-only confirmation once, restores the source minute on the same article and sends no email or App notification

#### Scenario: Repeated verified source
- **GIVEN** an existing verified mirror on the same source revision
- **WHEN** the next scheduled occurrence executes
- **THEN** it verifies the same ID with zero article mutations and zero delivery

#### Scenario: Unknown result or unavailable source
- **GIVEN** an operation result is unknown or current source verification fails
- **WHEN** the round evaluates its next action
- **THEN** it retains evidence, stops writes and does not replay publication
