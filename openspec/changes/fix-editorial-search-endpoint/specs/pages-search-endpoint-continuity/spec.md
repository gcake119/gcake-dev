## Purpose
Preserve existing semantic search configuration across manual and automatic public website builds, so publication does not silently disable meaning-based search.
## ADDED Requirements
### Requirement: Publication preserves configured reader search
Both publication paths SHALL retain the same configured semantic endpoint in the generated reader page while preserving existing release controls.
#### Scenario: Configured publication retains meaning-based search
- **GIVEN** the existing public search endpoint is configured and the indexed public source is compatible
- **WHEN** either publication path builds and publishes the website
- **THEN** a reader query uses that endpoint and displays meaning-based results from the current public articles
#### Scenario: Missing configuration retains keyword search
- **GIVEN** no semantic endpoint is configured
- **WHEN** the website is built and a reader searches
- **THEN** keyword results remain available without a cloud inference request
#### Scenario: Unavailable semantic service retains existing fallback
- **GIVEN** the endpoint is configured but the semantic service is unavailable
- **WHEN** a reader searches
- **THEN** the existing keyword fallback and bounded failure notice remain available without an automatic model retry
### Requirement: Wiring repair preserves publication boundaries
The repair SHALL preserve existing schedules, source pinning, failed-build and stale-source rejection, and notification boundaries. This authorized repair deployment SHALL publish the same article identities and source revisions as the existing public snapshot.
#### Scenario: Stale or failed build cannot publish
- **GIVEN** a publication build fails or its source is no longer current
- **WHEN** deployment is evaluated
- **THEN** it does not publish the invalid artifact
#### Scenario: Repair changes search wiring without publishing new content
- **GIVEN** the approved repair artifact contains the same article identities and revisions as the current public snapshot
- **WHEN** the repair is deployed
- **THEN** those identities and revisions remain unchanged and no publication notification is sent by the repair operation
