## MODIFIED Requirements

### Requirement: Explicit publication operations

Prepare, publish, verify, retry, draft synchronization and newsletter intent SHALL be explicit operations naming target and policy. A Git save alone SHALL NOT grant provider-write authority. Only a separately qualified and activated standing unattended-draft-sync-v1 policy SHALL permit ordinary rounds to create or update eligible unscheduled never-published drafts. That authority SHALL NOT include schedule operations, publication, public corrections, email or App delivery. Foreground schedule and first-delivery operations SHALL retain their exact current source/identity/time/reservation/version/audience scope and readback requirements.

#### Scenario: Save article only

- **GIVEN** no unattended draft activation exists
- **WHEN** the owner commits an article from the Editor
- **THEN** no Substack publication, email, newsletter or draft write starts automatically

#### Scenario: Explicit standing draft authority

- **GIVEN** an owner-selected qualified Computer Use integration and matching activated draft policy exist
- **WHEN** an ordinary round synchronizes an eligible source
- **THEN** one full unpublished unscheduled draft is saved under that authority without publication or subscriber delivery

#### Scenario: Draft authority does not arm or revise

- **GIVEN** a worker has draft authority and an article is scheduled or already public
- **WHEN** its source changes or its estimated time becomes due
- **THEN** it requests foreground action without editing, cancelling, rearming, republishing or sending

#### Scenario: Old foreground review becomes stale

- **GIVEN** a previous schedule approval has a different source or current queue version
- **WHEN** a foreground mutation is requested after draft synchronization
- **THEN** the old approval is rejected under the existing exact-scope checks
