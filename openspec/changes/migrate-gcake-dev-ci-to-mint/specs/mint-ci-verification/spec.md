## Purpose

Preserve full low-privilege validation on the admitted shared Mint host without expanding publication authority.

## ADDED Requirements

### Requirement: Trusted validation preserves complete gates on Mint
Trusted gcake-dev PR and main validation SHALL use the admitted repository-scoped Mint runner, preserve all existing tests/checks/builds/dry-run/rehearsal and false provider flags, and use job-isolated mutable tools. Fork PRs SHALL remain hosted. Validation jobs SHALL receive no production credentials. Mint jobs SHALL have no sudo; hosted jobs retain their original installation steps.

#### Scenario: Trusted and fork routing
- **WHEN** validation starts for a same-repository or fork PR
- **THEN** the former uses repo-gcake-dev and the latter hosted execution, with identical necessary gates.

##### Example: Failing rehearsal
- **GIVEN** editorial:rehearse exits73
- **WHEN** the PR gate executes
- **THEN** validation fails73 without provider writes or success evidence.

### Requirement: Fixtures retain safe native boundaries
Chrome fixtures SHALL execute with channel chrome and synthetic local state. Hermes authority SHALL retain its fixed isolated /private/tmp namespace. Missing tools or unsafe fixture ownership SHALL fail rather than skip tests or grant runner privilege.

#### Scenario: Missing prerequisites
- **WHEN** Mint lacks its admitted browser, runtime or private fixture mount
- **THEN** preparation fails before test execution and does not publish ready environment.

##### Example: Missing Chrome
- **GIVEN** the admitted runner cannot execute /opt/google/chrome/chrome
- **WHEN** preparation runs
- **THEN** it fails with MINT_CI_TOOLS and leaves GITHUB_ENV empty.

### Requirement: Six runners share three CPU times and the existing build lock
All six runners and rootless Docker SHALL share CPUQuota300%, MemoryHigh16GiB, MemoryMax20GiB and Tasks4096. The original lock inode SHALL serialize cooperating builds; the sixth runner SHALL not gain backup or rootful Docker access.

#### Scenario: Real concurrent acceptance
- **WHEN** gcake-dev and an admitted repo run acceptance concurrently
- **THEN** both confirm kernel quota3 and the unchanged memory limits, and build intervals do not overlap.
