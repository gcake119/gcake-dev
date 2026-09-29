## MODIFIED Requirements

### Requirement: Safe development bindings
Cloudflare development configuration SHALL bind local or preview resources separately from production resources, production SHALL bind dedicated D1 and R2 resources, and all external publication write flags SHALL default to disabled.

#### Scenario: Missing production secrets
- **WHEN** the Admin and Worker run in the documented local development environment without production secrets
- **THEN** foundation features and health checks work while provider write operations remain unavailable

#### Scenario: Production environment selected
- **WHEN** an operator deploys the Worker with the production environment
- **THEN** Wrangler selects dedicated production D1 and R2 bindings while Paragraph and Substack writes remain disabled
