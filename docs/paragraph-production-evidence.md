# Paragraph Phase 7 production evidence

Recorded on 2026-09-28 for the controlled `gcake` publication cohort.

## Evidence boundaries

| Boundary | Evidence | Result |
| --- | --- | --- |
| Human authorization and acceptance | User explicitly approved create, update, temporary public publication, canonical/date, retry, and public-read verification for `gcake-cms-production-gate-20260928`, then confirmed that the published v2 article was correct. | Approved and human-accepted only for the controlled cohort. |
| Newsletter authorization | User explicitly stated `不核准寄送電子報`. Every create/update/publish payload and dry-run receipt contained `sendNewsletter: false`. | Not authorized; no newsletter intent was created. |
| Provider interface | Paragraph REST OpenAPI at official SDK commit `56c2fd279cfad810dab400236773406e41080d65`; API title/version `Paragraph API` / `1.0.0`. CLI identity check used CLI `0.4.0`. | Pinned. |
| Provider create | First run created remote ID `ZbxGX7Ju1uXR9BkSTj0R` as a draft and persisted it before later calls. | Verified. |
| Failure isolation | The immediate canonical/date update returned HTTP 409. Local state retained the remote ID with `failed`; the article remained a draft and no newsletter was sent. | Verified. |
| Retry protection | Retry dry-run selected `update`, reused `ZbxGX7Ju1uXR9BkSTj0R`, and did not create a second post. | Verified. |
| Provider update | Source revision changed from `sha256:52903b4b1091405020b3be3560dfc4f9390c12eba556352b7c23dfb6ca4a6327` to `sha256:095615f1e6961e53241bb698a313b255f4da1aa1d2677c4a5f59037d77d4e644` on the same remote ID. | Verified. |
| Provider publish/date | Provider-private read returned `status: published`, `publishOnline: true`, and `publishedAt: 1790589600000`. | Verified. |
| Public API | Anonymous publication-slug/post-slug read returned the same remote ID, slug, date, and v2 body markers. | Verified. |
| Public HTML/canonical | Public HTML at <https://paragraph.com/@gcake/gcake-cms-production-gate-20260928> returned successfully and its canonical link matched `https://gcake119.github.io/gcake-dev/posts/gcake-cms-production-gate-20260928/`. | Verified. |
| Runtime persistence | The controlled harness applied the D1 publication migration schema to a persistent local SQLite-compatible state database and ended at `verified` for the v2 source revision. Production code uses `D1PublicationRepository`; no JSON dual write was reintroduced. | Locally verified; not deployed. |
| Publishing Center QA | Real-browser QA covered desktop and 390×844 mobile layouts, light and dark themes, and keyboard activation of the theme control. The UI disclosed the controlled cohort, linked the verified article, kept other posts prepare-only, and stated that newsletters were not authorized. | Locally verified with mocked authenticated Admin reads; no provider write was triggered. |
| Local regression gates | `pnpm test`, `pnpm check`, and `pnpm build:all` passed. The build included content validation, the public Astro site, Admin, Worker, and both shared-contract packages. `git diff --check` passed. | Verified locally. |
| Deployment | No Admin, Worker, D1 migration, or public-site deployment was performed in this task. | Not deployed. |
| Production scope | One explicitly approved Paragraph article was created, updated, and left publicly accessible. | Controlled cohort only; global provider writes remain disabled. |

## Commands and receipts

- v1 dry run selected `create`, source revision `sha256:52903b4b1091405020b3be3560dfc4f9390c12eba556352b7c23dfb6ca4a6327`, receipt `02f85300d7f81c5beb473e436f8b49a52bbf8b13de739fa8fc5922dd1c8873db`.
- First publish persisted the remote ID, then stopped on HTTP 409 before public verification.
- Retry selected `update` and published the persisted remote ID.
- v1 verified at `2026-09-28T10:46:29.394Z`.
- v2 dry run selected `update`, source revision `sha256:095615f1e6961e53241bb698a313b255f4da1aa1d2677c4a5f59037d77d4e644`, receipt `00c1173c7ddb0482dac60c1425fc1f7229823d4c1e1c0785d500f6ad02ab3dc3`.
- v2 verified at `2026-09-28T10:47:05.727Z`.
- The user confirmed the published v2 result as correct after public verification.
- Browser QA screenshots were captured locally for desktop light, mobile light, and mobile dark states. The public Paragraph page was also read in a real browser and showed the v2 marker, the no-newsletter statement, and the expected publication date.

No API key, access token, private key, complete production article source, or subscriber data is recorded here.
