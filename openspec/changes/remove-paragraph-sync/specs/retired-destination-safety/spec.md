## Purpose

Retire unsupported publication destinations without replaying operations or destroying historical publication evidence.

## ADDED Requirements

### Requirement: Substack-only synchronization
All current preparation, command, API and scheduled synchronization entrypoints SHALL accept only Substack as a distribution destination and SHALL reject any other destination before contacting providers, reading credentials or changing publication state.

#### Scenario: Current destination
- **GIVEN** a published original and a configured Substack destination
- **WHEN** synchronization is planned
- **THEN** only Substack operations are produced with the existing identity, source proof and delivery restrictions

#### Scenario: Retired destination request
- **GIVEN** a stale command or policy naming Paragraph
- **WHEN** preparation or execution is requested
- **THEN** the request fails before any provider access or publication-state mutation

#### Scenario: Mixed or empty destinations
- **GIVEN** a policy with no destination or with Substack and a retired destination
- **WHEN** synchronization is planned
- **THEN** planning stops rather than silently executing a partial policy

### Requirement: Preserve historical evidence
Removal SHALL preserve existing provider articles, remote identities, historical database migrations and recorded unresolved intents. Removed destinations SHALL not appear as actionable current UI targets or trigger provider replay.

#### Scenario: Historical destination state
- **GIVEN** stored state for a retired destination and Substack
- **WHEN** the current publishing center loads
- **THEN** only supported destinations are actionable and the retired evidence remains stored unchanged

#### Scenario: Unresolved historical intent
- **GIVEN** an unresolved retired-destination intent
- **WHEN** retirement is audited
- **THEN** the intent is reported without deletion or replay

### Requirement: Remove integration surfaces
The repository SHALL contain no current Paragraph provider implementation, dedicated command, workflow, binding or operating guide. Historical specifications, receipts, migrations and author content SHALL remain historical evidence.

#### Scenario: Repository verification
- **GIVEN** the completed retirement candidate
- **WHEN** repository tests, type checks and builds run
- **THEN** Substack and original-site behavior passes and current integration entrypoints contain no Paragraph execution path
