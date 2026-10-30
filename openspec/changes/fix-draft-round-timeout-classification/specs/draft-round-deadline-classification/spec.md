## Purpose
Preserve the existing exhausted-round verdict when asynchronous media cancellation races the wall clock, without changing time budgets or allowing provider operations after expiry.
## ADDED Requirements
### Requirement: Round-owned expiry retains budget verdict
The draft synchronization round SHALL classify its own fired deadline as exhausted budget even when the wall clock remains one tick early. It SHALL stop before provider dispatch and preserve prior operation intent.
#### Scenario: Media deadline fires before the wall-clock boundary
- **GIVEN** a slow source-media read and a round deadline that has fired while the wall clock is one tick early
- **WHEN** the read abort is observed
- **THEN** the round reports exhausted budget, makes no provider call and preserves prior intent
#### Scenario: Wall-clock expiry without a completed read
- **GIVEN** the round deadline has elapsed while source or main verification is pending
- **WHEN** the round evaluates continuation
- **THEN** it reports exhausted budget without dispatching a provider operation
### Requirement: Earlier caller cancellation remains distinct
A caller-owned cancellation before the round deadline SHALL retain its read-failure classification rather than falsely reporting exhausted round budget.
#### Scenario: Caller aborts before round expiry
- **GIVEN** source-media reading is cancelled by the caller before the round deadline fires
- **WHEN** the round records the read failure
- **THEN** it reports an inconclusive read, makes no provider call and preserves prior intent
