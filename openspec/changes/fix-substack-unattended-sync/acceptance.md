# Substack native reliability acceptance

Candidate: codex/fix-substack-unattended-sync, based on origin/main 7e0fd1421ebd0cf5b321840d8c7c9de1857114f6. The primary checkout's unrelated edits were preserved. No Git commit, push, merge or Worker deployment was performed.

## Product RED and GREEN

- Anonymous-reader acceptance initially failed for dateTime and DATETIME, and incorrectly accepted two mixed-case date controls or conflicting mixed-case attributes. The corrected parser accepts equivalent HTML spellings and rejects the ambiguous cases.
- Native discovery initially read a stale total before an asynchronous tab transition completed. The adapter now waits for the selected-list boundary before reading totals. Complete-scan, pagination and count-disagreement protections remain green.
- A native preflight with one eleven-second navigation failed with SUBSTACK_NATIVE_WAIT_TIMEOUT at the previous ten-second deadline. A bounded thirty-second rendering window accepts this case while retaining one navigation and all identity guards. The earlier real failure was intermittent: the captured pre-fix native diagnostic completed successfully; this is not evidence that every earlier timeout had the same cause.
- A delayed website-only confirmation initially failed with SUBSTACK_UI_CONTROL_AMBIGUOUS. The corrected adapter waits for the observed confirmation, publishes once and leaves email, App and schedule controls false.
- Published-list discovery initially returned an editor URL even when an anonymous public resolver was available. It now returns the original public identity for verification before adoption, without treating the published mirror as a draft to rewrite.
- The rendered LaunchAgent initially omitted the qualified IPv4 connection path. It now retains TLS and credentials while disabling Node address-family racing and preferring IPv4; there is no provider mutation retry loop.

The focused native/reader/identity suite passed 41 tests. Full pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run passed. Astro checked 199 files with zero errors, warnings or hints. The release rehearsal reported productionWrites=false and telegramNetworkCalls=0. Raw logs are retained in the private installation.

## Real system qualification and switch

The fresh private installation is installed-repair-20261015-crv89jlt, with an independent runtime copy and a 479-file SHA-256 manifest. The previous installed-pr27-20261013 installation, pin and original plist were preserved for rollback. The new runtime does not depend on the editable repair worktree.

A real GUI-user LaunchAgent completed native preflight and all three lists: two published posts, one historical test draft and zero scheduled posts. It resolved today's existing ID 220473117 to its anonymous public URL. Both IDs 220011124 and 220473117 passed independent complete body, title, canonical, original-link, publication-identity and source-minute checks. An explicit qualification guard rejected all article mutations and non-SELECT D1 operations; articleWrites=0. D1 locks, checkpoints and unresolved intents were empty. The temporary qualification service and its source snapshot were removed after completion.

The first controlled runtime round completed as round-LbmWU9. It corrected the first article's old manual_required state by verifying its original public identity; the prepare/publish command labels in that plan did not cause a new publication because the durable coordinator's verified-version path returned read-only verification. Today's article also verified on ID 220473117. In-flight D1 state was empty and the round source was removed.

The production label dev.gcake.distribution-sync switched at 2026-10-15T04:18:22Z with StartInterval=900, RunAtLoad=false, KeepAlive=false and initial runs=0. No kickstart was used. The exact prior plist is backed up under the new private installation's rollback directory; rollback requires an idle writer and empty in-flight state before restoring it, and never reactivates a retired dual-platform heartbeat.

## Automatic occurrence

At 2026-10-15T04:33:47Z (12:33 Taipei), the first natural occurrence completed as round-yD4v1V. The launchd run count increased from 0 to 1 without kickstart and the exit code was 0. Both articles executed verify only and remained verified on original IDs 220011124 and 220473117. The result was completed with notification=quiet. Article writes and email/App delivery were zero; D1 locks, checkpoints and unresolved intents were empty; the shared lock and source snapshot were absent. All 479 pinned runtime files matched after the automatic round. Raw result, provider-state readback and scheduler output are preserved in automatic-acceptance.json and scheduler-automatic.txt in the private installation.

## Evidence boundary

Local fixtures exercised publication, date recovery, single-publication and zero-delivery behavior. Real native qualification and the controlled installed round used existing public articles. A future first publication is not fabricated for acceptance: actual new-article production evidence remains tied to the next eligible formal original. Chrome must remain open under the bound process/window/tab; restarting it still requires explicit rebinding and fresh read-only verification.
