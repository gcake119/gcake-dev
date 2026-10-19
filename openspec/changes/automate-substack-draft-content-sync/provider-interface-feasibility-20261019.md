# Substack draft-write interface feasibility — 2026-10-19

## Result and authorization

Result: **capability-gap; no interface selected or qualified**. Public documentation research is complete for this bounded attempt; task 1.1 remains unchecked because the owner-reviewed interface decision is unresolved. No statement here proves that Substack has no API or no private/partner offering.

The owner authorized implementation, then explicitly selected “先解決 Substack 寫入介面，再開始程式實作” in response to the proposed option of building a disabled core and admin read API first. Therefore no application source, fixture transport or frontend API implementation starts on this attempt. The original implementation objective and later frontend API handoff remain outstanding. Runtime/provider activation remains a separate boundary.

Decision context: Level 2, unattended sync/provider/authentication. Apply the existing Git-content/D1-operations ownership, exact source slug, original provider ID, unknown-outcome no-replay and foreground-only scheduling rules. No ADR registry exists; this evidence and the current design are the decision record. No requirement has been relaxed.

## Current primary sources

Checked anonymously through web tools on 2026-10-19 Asia/Taipei; no logged-in interface, credentials, browser profile, authenticated MCP or private endpoint was accessed.

| Source | Observed documented capability | Qualification consequence |
| --- | --- | --- |
| [Official MCP guide](https://support.substack.com/hc/en-us/articles/50834026608916-How-to-connect-Substack-to-your-AI-Assistant) | Read-only publication metrics/settings; sign-in and consent; Admin/Bestseller prerequisites | Not a draft-write transport; private full-draft content access is not established. Account eligibility was not inspected. |
| [Official Developer API terms](https://substack.com/api-tos) | Public creator/publication data scope | Does not document private draft creation/update or suitable authorization scopes. This is a capability assessment, not a legal opinion. |
| [Technical-documentation link from those terms](https://support.substack.com/hc/en-us/articles/45099095296916) | Fetch failed again; prior planning recorded 404 | Authentication and draft endpoints cannot be inferred from this unavailable document. A failed fetch does not prove the offering does not exist. |
| [Official publishing guide](https://support.substack.com/hc/en-us/articles/360037831771-How-do-I-publish-a-new-post-on-Substack) | Web editing and autosaved drafts are separate from publication | Product UI existence is not proof of a supported unattended adapter or atomic conflict/disposition controls. Prior foreground proof is not unattended proof. |
| [Official article importer](https://support.substack.com/hc/en-us/articles/360037830351-How-do-I-import-my-posts-from-another-platform-such-as-Mailchimp-WordPress-Medium-or-Ghost) | Article migration; reimport has an update-existing option | Documents migration, not draft-only continuous Git synchronization, exact-ID/slug guarantees or conditional updates. No import was attempted. |
| [Official imported-post delivery guide](https://support.substack.com/hc/en-us/articles/360041912391-If-I-import-a-post-from-elsewhere-will-it-be-emailed-out-to-my-list) | Imported posts appear as web posts; email is a later choice | Reject as a replacement for unpublished draft creation, even if subscriber delivery is not automatic. |
| [Official external podcast distribution](https://support.substack.com/hc/en-us/articles/52072365337620-How-do-I-distribute-my-podcast-to-Substack-if-it-s-hosted-elsewhere) | Podcast RSS can produce drafts with auto-publication disabled | Not documentation of a full text-article synchronization contract; exact-slug, same-ID revision, code/alt/full-body readback and recovery remain unestablished. Do not disguise articles as podcasts. |
| [Official support instructions](https://support.substack.com/hc/en-us/articles/43904995414164-How-to-contact-Substack-Support) | Support bot followed by human support escalation | A way to ask about supported/private-partner capabilities; no inquiry was sent. |

Search scope: official Help Center and substack.com; queries covered official API documentation, API keys, draft create/update, automation, integrations and imports. Ordinary author newsletters hosted under substack.com are not platform documentation and were not treated as platform support evidence. No third-party integration was connected or tested; no undocumented endpoint was probed.

## Required transport contract and missing proof

| Required capability | Evidence necessary before qualification | Present finding |
| --- | --- | --- |
| Unattended authentication | Supported scope, credential custody, consent, expiry/renewal/revocation and challenge handling | No verified draft-write authentication contract |
| Create unpublished only | Supported operation that cannot arm/publish/send and yields a durable original ID | Not established |
| Exact slug | Persist the authoritative Git slug; read it back; reject collisions without suffix/new ID | Not established for a supported unattended operation |
| Full saved reads and updates | Read persisted title, description, complete structure/code/links/images/alt; conditional same-ID update; reload proof | Not established |
| Exhaustive identity discovery | Complete Drafts/Scheduled/Published paging and publication identity, with conclusive matching | Not established through a supported unattended port |
| Unknown create reconciliation | Idempotency/correlation or authoritative lookup that remains conclusive after lost acknowledgement and delayed indexing | Not established |
| Concurrency protection | Reject writes atomically when remote revision or unscheduled/never-public disposition changes; equivalent verified exclusion guarantee accepted only after review | Not established; local locks and a second read do not protect against external scheduling between read/save |
| Media fidelity | Supported upload/reference semantics, complete saved media/alt evidence and failure behavior | Not established for an unattended full-article adapter |
| Call limits and operational support | Documented quotas/errors and finite qualification-based call/time budget | Not established for the required write port |

Known draft UI features do not fill this matrix by implication. No ordinary or dedicated browser implementation has been qualified. Existing attended handoff remains valid within its current foreground scope and is not renamed as unattended automation.

## Options and decision boundary

1. **Recommended under current requirements:** ask Substack whether an official or partner-supported draft-only API/automation interface exists and request its technical contract. Written support confirmation identifies a candidate; real qualification still needs separately scoped auth/setup and isolated draft-write evidence.
2. If no suitable supported interface exists, keep this implementation blocked with the current observer unchanged. Waiting is not completion of the requested product.
3. A dedicated-browser or third-party approach would require a new reviewed interface decision and proof of authentication, content fidelity, same-ID recovery and race protection. The current request does not authorize switching to private endpoints, exporting cookies or silently replacing atomic safeguards with read-before-write. A requirements change must be resolved in specs/Gherkin before implementation tasks resume.

The proposed “disabled core and admin read API first” route was offered and the owner selected interface resolution first. Do not implement it while this decision stands. The eventual admin API must still separate draft sync, scheduling, publication and delivery evidence; no endpoint in this note is an implemented or deployed API.

## Prepared support inquiry — not sent

Subject: Supported unattended API for unpublished article drafts, same-ID updates and safe recovery

We maintain our publication's full article originals in Git and want to synchronize finalized Markdown into unpublished, unscheduled Substack article drafts. Publication, scheduling and subscriber email/App delivery must remain separately authorized foreground operations.

Does Substack offer an officially supported or partner-supported API or automation interface for this use case? Please provide technical documentation and access requirements for:

- Supported authentication and draft-only scopes, unattended renewal/revocation and service/account eligibility.
- Creating an unpublished, unscheduled article with an exact chosen slug and receiving its stable post ID, without publication or delivery.
- Reading complete persisted draft title/subtitle, structured body, code, image/alt text and links; updating and reloading that same ID.
- Complete discovery of draft/scheduled/published IDs and safe recovery when creation succeeds but its response is lost. Is an idempotency key or request correlation supported?
- Conditional update semantics that reject concurrent edits and reject a write if the article was scheduled or published after it was read. Are a version token, precondition or equivalent exclusion mechanism supported?
- Image handling, quotas, error/retry rules and supported client libraries or integration partners.

The public MCP documentation describes read-only access. We do not want to use undocumented private endpoints, extract browser login data or accidentally publish imported content. If no supported draft-write surface exists, please confirm that limitation and any supported alternative that preserves unpublished-only and same-ID behavior.

## Evidence and next action

No application code, provider mutation, credentials, messages, runtime installation, migration, schedule or notification changes occurred. Only Spectra unpark/in-progress bookkeeping and this local evidence were written. Initial Spectra bookkeeping hit the sandbox read-only SQLite boundary; authorized elevated CLI restored registration without editing database contents manually.

Keep all 14 implementation tasks unchecked, including task 1.1 until the interface decision is reviewed. The separate schedule-substack-drafts-ahead task 5.3 remains pending. Next external evidence is a documented supported interface or a provider response; no support message is authorized or sent by this note. Resume implementation only after the blocking interface decision is resolved, retaining the later frontend API deliverable.

## Subsequent owner decision — same day

The owner later instructed: 「使用現有實作已成功的 computer use 方式完成寫入，開始實作」. That explicitly supersedes this report's prior wait-for-interface implementation gate. The current proposal/design/specs/tasks now select the existing Computer Use handoff for local implementation. This report is preserved as research history, not a current instruction to stop implementation. Live controlled-session qualification and formal activation remain distinct and pending.
