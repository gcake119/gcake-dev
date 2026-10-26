## Why
The original-site timestamp repair cannot be adopted because the managed Hermes authority is already 4,823,534,781 bytes and the existing update calculation projects 5,197,180,069 bytes against its 4 GiB limit. The owner explicitly chose to retain the limit and separately plan archival, preserving historical recovery material.

## What Changes
- Plan a foreground, administrator-operated archive of three exact retired immutable packages into a separate root-owned cold archive, with verified identity, metadata, references and reversible relocation.
- Preserve the active release, initial managed release, successful historical notification release, first-install original runtime backup, manifests, approvals and receipts.
- Keep the 4 GiB managed-authority limit and existing free-space check unchanged; recompute actual capacity before any later update.
- The initial proposal was planning only. On 2026-10-26 the owner explicitly authorized implementation and execution of this exact archival plan, retaining the 4 GiB cap and restoration ability, followed by the existing timestamp-repair adoption. No broad deletion or additional package substitution is authorized.

## Capabilities
### New Capabilities
- hermes-retired-package-archival: Exact, reversible archival and restoration of retired packages while preserving active execution and recovery history.
### Modified Capabilities
None. Existing runtime-update safety requirements remain unchanged.

## Impact
- Related specs: hermes-runtime-update-safety, hermes-update-entry-integration, hermes-publication-monitoring.
- New operational documentation: openspec/changes/archive/2026-10-26-archive-hermes-retired-versions/archive-plan.md.
- Future scoped implementation: scripts/hermes/archive_retired_packages.py and scripts/hermes/test_archive_retired_packages.py.
- Dependent adoption: openspec/changes/archive/2026-10-26-clarify-original-site-publication-times/tasks.md remains incomplete until separately authorized archival, managed update and readback finish.
- No dependency, CI workflow, timer, credential or production configuration change in this proposal.
