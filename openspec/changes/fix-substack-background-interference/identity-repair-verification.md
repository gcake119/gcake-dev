# Two original Substack article identity repair — 2026-10-17

Substack changed anonymous page identity from a quoted JSON.parse literal to the inert `script#preloads-json[type="application/json"]` data element. The old parser falsely returned SUBSTACK_PUBLIC_IDENTITY_AMBIGUOUS for both original articles and the archive. No duplicate, missing article or content divergence was found.

The parser now supports either unique format and rejects missing, malformed, duplicate, mixed-format, wrong-publication and wrong-canonical identity. Executable hydration wrappers are never evaluated. Existing full text, links, assets, original date and canonical checks remain unchanged.

| Original article | Preserved ID | Public URL | Final state |
| --- | --- | --- | --- |
| ithome-2026-chatgpt-writing-workflow | 220011124 | https://gcakedev.substack.com/p/chatgpt-30 | verified |
| ithome-2026-publishing-toolchain | 220473117 | https://gcakedev.substack.com/p/ce0 | verified |

RED: both new acceptance cases failed on the old parser, including mixed-format ambiguity. GREEN: all 6 identity tests passed. Exact captured anonymous HTML for both posts and archive passed identity/full-mirror verification against the unchanged source revisions. Full pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run passed; dry-run productionWrites=false.

One fresh clean remote main snapshot at 6f02e56b1f19a6a9b28b9fcb6e865789934e3eb5 was used for Pages-first evidence, explicit operator verification through the existing coordinator, and a real production background round with normal planning, --background dispatch, D1 audit, notification callback and source cleanup. Only the exact two original held articles were reconciled. Both kept remote IDs, URLs, source revisions and empty newsletter timestamps. D1 locks/checkpoints/intents were empty before and after. No direct status SQL repair, prepare/publish/finalize/create/update action, Substack mutation, Email send, App notification or browser operation occurred. The instrumentation initially blocked an internal INSERT OR IGNORE lock statement before any write; it was corrected after inspecting that statement, preserving the failed preflight evidence. No ambiguous provider action was retried.

The background round completed with exactly two verify results and removed its owned source clone. Shared lock was released. Hermes receipt reports clear / issueCount=0; this is an active-set clear, not a new delivery or a human-read receipt. The root Hermes sender and gateway were unchanged.

The GUI LaunchAgent was switched while idle to installed-identity-repair-20261017, with StartInterval=900, RunAtLoad=false, KeepAlive=false, and no kickstart. Previous safe installation and plist remain preserved. All 593 source-file hashes in the new and previous installation were verified. Only parser and identity test differ from the previous runtime. This follow-up verifies a real explicit production background round; a new natural timer occurrence was not claimed or required because background controls are unchanged and retain their prior acceptance evidence.

Durable private evidence: /Users/caiyijun/Library/Application Support/gcake-distribution/installed-identity-repair-20261017/verification. Raw anonymous HTML and original D1 rows remain private under /private/tmp/substack-identity-5loPRj (not committed). Source changes stay in /private/tmp/gcake-substack-background-20261017. No commit, push, cloud deployment or archive was performed.
