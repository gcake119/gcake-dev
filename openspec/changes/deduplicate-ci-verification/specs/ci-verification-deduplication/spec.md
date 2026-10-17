## Purpose

Preserve the complete read-only PR validation contract while removing repeated work.

## ADDED Requirements

### Requirement: One complete read-only PR validation
The repository SHALL execute the union of existing PR validation once per main pull request candidate and preserve the required validate status. It MUST retain full tests, checks, all workspace builds, release simulation and editorial rehearsal without publication authority.

#### Scenario Outline: Main pull request validation
- **Given** a pull request containing <change_type> targets main
- **When** its candidate is validated
- **Then** shared tests, checks, dependency preparation and site builds run once
- **And** all workspace builds, release simulation and editorial rehearsal remain present
- **And** no real publication or notification channel is written

Examples:
| change_type |
| editorial content |
| workspace code |
| mixed changes |
| documentation only |

#### Scenario: Necessary validation fails
- **Given** a necessary validation step fails
- **When** the PR validation concludes
- **Then** the required validation does not report success
- **And** no credentials or deployment authority are granted

#### Scenario: Required history or shared validation is unavailable
- **Given** a pull request candidate requires publication history and all shared checks
- **When** required history cannot be obtained or a shared check is incomplete
- **Then** validation must not report merge readiness

#### Scenario: Main and manual editorial validation remain available
- **Given** a main push or an operator-requested editorial validation
- **When** the event is processed
- **Then** the existing editorial validation remains available
- **And** a feature branch push does not duplicate PR validation

### Requirement: Preserve test coverage while eliminating repeated execution
The aggregate test entrypoint SHALL execute every previously selected test file and SHALL execute the release queue test once.

#### Scenario: Aggregate test suite
- **Given** the editorial and public test groups share the release queue test
- **When** the complete test entrypoint runs
- **Then** the release queue test is selected exactly once
- **And** the other selected tests remain in their existing groups
