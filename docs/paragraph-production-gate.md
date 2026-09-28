# Paragraph production gate

Status on 2026-09-28: **blocked**.

Every item below must be supported by a pinned evidence receipt before production implementation or provider writes begin:

- [ ] The user explicitly approved controlled Paragraph production writes.
- [ ] A supported Paragraph publishing interface and version are pinned.
- [ ] Create behavior is verified in a controlled non-newsletter cohort.
- [ ] Update behavior retains the same remote article ID.
- [ ] Publish, canonical URL, and publication date behavior are verified.
- [ ] Retry protection is verified against duplicate remote articles.
- [ ] Public read-back verification is available.

Local tests, dry-run payloads, Git saves, deployments, and an API success response do not satisfy these items. Newsletter delivery is a separate irreversible intent and is not included in ordinary create, update, publish, verify, or retry approval.
