# Formal Astro Preview execution decision

Date: 2026-09-28

The bounded spike selected an **isolated source package runner behind `PreviewBuildProvider`**. It is the first approved implementation because it executes the repository's real `pnpm build:astro`, accepts an uncommitted draft, and can be replaced by a remote sandbox without changing the preview API or lifecycle contract.

Priority order:

1. Isolated source package on a bounded runner with no canonical Git remote write credentials.
2. A remote sandbox implementing the same provider interface if production runtime isolation cannot execute Astro safely.
3. A namespaced temporary branch only as a last resort; it must never target `main` and must be automatically deleted.

The spike copies the requested source into an OS temporary directory, links read-only installed dependencies, adds an unsaved fixture only in that directory, runs the real Astro build, verifies the rendered route, checks a canonical repository checksum, and removes the temporary directory in `finally`. It does not create a branch or commit and does not contact GitHub, Pages, R2, D1, or a provider.

This is local feasibility evidence only. Production execution infrastructure and public preview URL availability remain separate deployment evidence.
