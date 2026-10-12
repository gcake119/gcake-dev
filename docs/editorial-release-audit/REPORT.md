# Editorial release scoped security review

Latest follow-up: [test-mode boundary re-review](../editorial-release-boundary-review.md) reproduced and fixed transport activation/interface gaps and DB setup side effects introduced or exposed by the mock integration. The original review below predates that follow-up; its empty remote-exploit findings do not imply these safety gaps were previously covered. The follow-up was a single-agent local review, with intercepted transport tests, not a new independent multi-agent audit.

No exploitable privilege escalation or credential disclosure was confirmed in the introduced queue/Actions/Hermes integration. Three independent reviewers mapped the architecture and then hunted Git lifecycle/access, network/outbox/secrets, and input/file/config boundaries. This is a local source review with dynamic reproductions, not a full CMS security audit or production provider acceptance.

Baseline: trusted repository writers control static blog content and workflows, as in Git/Jekyll/Hugo CI publishing; the Hermes OS owner controls its private outbox and credentials. That existing privilege was not misclassified as a vulnerability. Public RSS/HTML cannot select arbitrary origins, redirects or private secret-bearing targets.

Confirmed security findings: none. The machine-readable findings array is empty. There are therefore no MEDIUM+ exploit traces or per-finding validation/verification agents to run.

## Reproduced correctness issues and fixes

- Pending digest was stored but unchecked. A CMS body revision with unchanged status/date was accepted. Recovery now compares the transformed published-file SHA-256 and requires operator repair on changes; public HTML carries the same fingerprint and confirmation checks it.
- Deleting an active manifest silently held all other series. Reservation now raises a clear operator-repair error.
- UTF-16 RSS bypassed ASCII DTD scanning. Parser now explicitly requires UTF-8, rejects NUL and DTD/entity markup, with regression coverage.
- URL parsing removed control characters while returning raw input. canonical_url now rejects controls at entry.
- Date.parse accepted hour 24 normalization. Timestamp validation now bounds hour/minute/second and calendar date.
- First activation could consume a pre-activation latest slot. A durable startedAt gate prevents it; future manually scheduled series chapters are also held.

## Positive patterns and verification

Explicit activation gates; protected-environment/main-only content-write jobs; read-only build; argument-array subprocess calls; path and symlink rejection; strict journal schemas; non-force Git conflict refusal; page canonical/source digest verification; fixed HTTPS origin and response limits; parameterized SQLite; flock and canonical-key outbox; baseline initialization; dry/live isolation; pre-send uncertainty persistence; secrets omitted from exception logs. Actions syntax was checked with actionlint. Local canonical/SQL-injection URL tests and a real static-build HTTP rehearsal were exercised without real Telegram calls.

## Remaining acceptance boundaries

GitHub environment/ruleset protection and unattended token write permission were not changed or provider-tested. SHA pre-deploy check and Pages deploy remain a cross-service race window; pending version checking and latest-head recovery reduce the effect but do not make it atomic. Same-user filesystem/configuration controls are trusted. At-most-once delivery deliberately leaves ambiguous sends for human reconciliation. No real Hermes account installation, Telegram provider delivery or production candidate deployment occurred. Independent review did not claim whole-repo coverage; further review is useful if scope expands to CMS or deployment locking.
