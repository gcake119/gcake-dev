## Context

The Admin Worker already has preview bindings and production-safe runtime gates, but production has no D1, R2, deployed Worker, or repeatable deployment workflow. Cloudflare credentials must remain outside Git and GitHub Actions must fail closed when deployment secrets are absent.

## Goals / Non-Goals

**Goals:**

- Isolate production data from preview data.
- Apply all existing D1 migrations before deploying the Worker.
- Deploy the Admin SPA and API as one Cloudflare Worker with explicit production bindings.
- Verify the deployed `/health` route.
- Provide a repeatable GitHub Actions deployment path.

**Non-Goals:**

- Enabling Paragraph or Substack writes.
- Moving local Ollama into Cloudflare.
- Changing Git, D1, or R2 ownership boundaries.
- Storing Cloudflare or GitHub App private credentials in Git.

## Decisions

### Use dedicated named production resources

Create `gcake-cms-production` and `gcake-media-production`, then record their bindings explicitly in Wrangler configuration. This keeps preview and production data visibly separate and avoids implicit resource selection.

### Migrate before deployment

The deployment workflow applies all D1 migrations to the production database before deploying the Worker. A migration failure stops deployment so code never runs against an older schema.

### Keep CI credentials in GitHub Actions secrets

The workflow reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only from GitHub secrets. Local OAuth can perform the initial supervised deployment, but no OAuth token or API token is committed.

### Keep provider writes disabled

Production binds the GitHub App identifiers required by the existing Git writer, while `PARAGRAPH_WRITE_ENABLED` and `SUBSTACK_WRITE_ENABLED` remain `false`. The GitHub App private key remains a Worker secret.

## Implementation Contract

- `wrangler deploy --env production` SHALL bind production-only `CMS_DB` and `MEDIA_BUCKET` resources and package the Admin static assets.
- Before deployment, all files in `apps/admin-worker/migrations` SHALL be applied remotely to `gcake-cms-production`.
- `GET /health` on the deployed production Worker SHALL return HTTP 200 with the typed `gcake-admin-worker` health payload.
- The workflow SHALL stop before deployment when Cloudflare credentials, migration, build, or tests fail.
- GitHub App private key and Cloudflare credentials SHALL remain outside tracked files.
- Public-site deployment and local Ollama behavior are outside this workflow and remain independent.

Acceptance requires production resource inspection, full affected local verification, a Wrangler dry run, a successful supervised production deployment, and a live health check.

## Risks / Trade-offs

- [Missing GitHub Actions secrets] → Keep the workflow fail-closed and document the exact required secret names.
- [Migration failure] → Run migrations before deploy and stop immediately on error.
- [Wrong environment binding] → Use explicit `--env production` in every remote command.
- [Credential disclosure] → Never print or commit token or private-key values.
