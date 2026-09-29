## Why

The Publishing Admin Worker has production code but no production D1 or R2 bindings, deployment workflow, or deployed Worker. This leaves the CMS unavailable in production even though the public site deploys successfully.

## What Changes

- Provision dedicated production D1 and R2 resources for the Admin Worker.
- Apply the existing D1 migrations before serving production traffic.
- Bind production runtime variables and GitHub App configuration while keeping secrets outside Git.
- Add a GitHub Actions workflow for verified, fail-closed Worker production deployment.
- Verify the deployed Worker health endpoint without coupling the public site to the Admin runtime.

## Capabilities

### New Capabilities

- `admin-production-deployment`: Production resource isolation, migration, deployment, and health verification for the Publishing Admin Worker.

### Modified Capabilities

- `admin-runtime`: Production builds gain explicit D1 and R2 bindings while provider write gates remain disabled by default.

## Impact

- Affected specs: `admin-production-deployment`, `admin-runtime`
- Affected code:
  - New: `.github/workflows/deploy-admin-worker.yml`
  - Modified: `apps/admin-worker/wrangler.toml`, `apps/admin-worker/package.json`, `docs/publishing-cms-implementation-design.md`
- Affected external systems: Cloudflare Workers, D1, R2, GitHub Actions repository secrets
