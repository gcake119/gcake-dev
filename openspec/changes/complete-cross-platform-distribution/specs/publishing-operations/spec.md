> 歷史規格：此已完成變更的分發目標已由 remove-paragraph-sync 取代。不得依此文件啟動舊目標；現行操作以 Substack-only 同步文件及新規格為準。

## MODIFIED Requirements
### Requirement: Disabled Substack production path
Substack SHALL remain write-disabled by default. The separately requested attended Playwright integration SHALL require a reviewed UI contract, exact article-level approval, no-newsletter confirmation, and durable recovery before external writes. Unattended publishing SHALL remain disabled.
#### Scenario: User requests Substack publish
- **GIVEN** no separately approved stable write configuration
- **WHEN** the CMS receives a Substack operation
- **THEN** it provides manual recovery guidance and performs no external write
#### Scenario: Explicit attended integration
- **GIVEN** reviewed configuration and matching article-level approval
- **WHEN** the operator invokes the dedicated runtime
- **THEN** it executes only the named article/platform operation without emails
## ADDED Requirements
### Requirement: Preserve operational identity
Preparation, failure, and blocked operations SHALL preserve remote IDs, remote URLs, newsletter history, and outstanding write checkpoints.
#### Scenario: Failed retry
- **GIVEN** a platform with a known remote identity
- **WHEN** preparation or an attempt fails
- **THEN** the remote identity remains available for recovery
