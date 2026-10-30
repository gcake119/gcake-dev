## ADDED Requirements

### Requirement: Explicitly authorized immediate publication success
The system SHALL admit an explicitly authorized immediate publication to the existing Hermes success flow after fresh complete public verification of its original identity, source, full content and actual first-publication time. It SHALL preserve its real authorization instant separately from a saved schedule and SHALL NOT invent a scheduled commitment. The existing notification contract SHALL carry that authorization instant as the confirmed publication intent time and the actual-minus-authorization interval. Scheduled publications SHALL retain their existing contract and deduplication identity.

#### Scenario: Approved immediate publication is notified once
- **GIVEN** the operator approved immediate publication of the existing article and its complete matching public content is verified
- **WHEN** the original Hermes job observes that publication
- **THEN** the existing private-message flow emits its three-line success notification once without a saved schedule or another provider write

#### Scenario: Missing or contradictory authority is rejected
- **GIVEN** an article lacks explicit immediate-publication approval or combines contradictory immediate and scheduled evidence
- **WHEN** the notification authority evaluates it
- **THEN** the article emits no success notification and existing evidence remains intact

#### Scenario: Invalid timing or stale verification is rejected
- **GIVEN** authorization occurred after the claimed publication, verification is older than one hour or the source no longer matches the verified public content
- **WHEN** the notification authority evaluates it
- **THEN** the article emits no success notification

#### Scenario: First-publication identity survives content refreshes
- **GIVEN** the same original article and actual publication time already have a sent, intent or unknown notification outcome
- **WHEN** content is reverified, source metadata changes or the observer restarts
- **THEN** no second notification is sent and the immutable first-publication identity and previous outcome are preserved

#### Scenario: Existing scheduled publications remain compatible
- **GIVEN** an existing verified scheduled publication has a previously established notification identity
- **WHEN** the updated authority and unchanged Hermes consumer evaluate it
- **THEN** its notification identity, timing, message and suppression outcome remain unchanged
