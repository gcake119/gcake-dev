# PR33 review corrections — local evidence

Review head: 63d4b7127fa90d47c0980b6150acbee16058419d. All three P2 findings were reproduced before fixes: both legacy receipt entry points accepted old evidence, omission cleared a held issue, and transport-to-lock interleaving silently released a newly installed manual hold. The initial focused RED run had four expected assertion failures, one for each receipt entry point plus the two remaining behaviors.

Corrections require anonymous-only receipts unconditionally, query all D1 manual_required Substack states before publishing attention (independent of inventory), and propagate --background to the coordinator for eligibility checks while owning the per-target lock. Rejections do not save state, settle checkpoints or read public content. Explicit foreground verification remains available.

Focused acceptance tests passed (34 tests), including injected local SQLite production notification for a deleted/ineligible source and preservation after a failed durable read. The race fixture changes state after transport selection before lock acquisition; additional cases preserve changed revisions and checkpoints. Browser/public reads are zero on rejected background invocations; exact held diagnostics and locks are checked.

Full pnpm test passed. Its first run exposed one historical native-receipt test expecting the superseded behavior; that expectation was changed to require rejection and the complete suite passed again. pnpm check then found one missing generic query-result type annotation. Only that erased TypeScript annotation was added; the passed runtime test result remains applicable. Final pnpm check (203 files, 0 errors/warnings/hints), pnpm build:all and pnpm release:dry-run passed. Simulation productionWrites=false and telegramNetworkCalls=0. Existing Hermes SQLite ResourceWarnings were non-failing.

Spectra analyze has zero findings and validate passed using an isolated artifact copy because this CLI resolves the primary checkout from Git worktrees. The primary checkout artifacts were preserved byte-for-byte. No live sync, live D1 mutation, Hermes sender/activation, scheduler cutover, Chrome operation or article publication was performed for these corrections. The existing immutable private runtime deliberately remains unchanged; these follow-up fixes are source-only until a separately verified installation.

Remote CI and review must pass for the new pushed head before merging; this local record does not claim remote approval or merge completion.

Private local log SHA-256 values:

- pr33-review-red.log: 972c8ea34811e71139adb8f775862a21885375bb78580e51c1a06de23961d861
- pr33-review-green.log: 8700a611f63c4fa268a73c824de4c71f8852d9716dcd8ad79d35308b75e6e631
- pr33-review-focused.log: 1e0dcca0da0a34f9a89d8d96575145776d65c708fff2dbe6e942fb8bd66e6794
- pr33-review-native-green.log: c95a7d311c3ecac85d3605f4aeeb2b24dbf7c903b07dbeff5acd9a47bcf6d0c8
- pr33-review-full-test-final.log: 3bce0365d4677689bce7a85d3e5a9342b8b78b086f34014514299c3f4194a674
- pr33-review-check-final.log: 6dbc3521fcf9f98e2b3d75781ebb1f40e4907aba283c98f41366d85283136311
- pr33-review-build.log: 70bf0ef0a4f2dddb67fd9a1789cc7bb8a34e7d9f34e02a60ed15316ce79ddfcb
- pr33-review-release.log: 8c7b0cc4c6f1817404847d0f81ec78f3ae6fb9c25bb0aeca405faef0a061a37c
