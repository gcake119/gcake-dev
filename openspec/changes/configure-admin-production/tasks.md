## 1. Production resources and configuration

- [x] 1.1 Implement **Use dedicated named production resources** and **Production resources are isolated** by creating `gcake-cms-production` and `gcake-media-production`, recording explicit production bindings, and verifying them with Wrangler resource inspection plus a production dry run.
- [x] 1.2 Implement **Migrate before deployment** and **Production schema precedes runtime deployment** by applying all committed migrations to the production D1 database and verifying the expected tables remotely.
- [x] 1.3 Implement **Keep provider writes disabled** and the modified **Safe development bindings** requirement by retaining fail-closed publication flags and documenting production runtime boundaries; verify with configuration tests and review.

## 2. Deployment and verification

- [x] 2.1 Implement **Keep CI credentials in GitHub Actions secrets** and **Production deployment is credential-safe** with a fail-closed workflow using only named GitHub secrets; verify workflow syntax and repository secret-name inspection without exposing values.
- [x] 2.2 Deploy the Worker under the **Implementation Contract** and satisfy **Production health is verified** by running complete local checks, Wrangler dry run, supervised production deploy, and a live `/health` assertion.
- [x] 2.3 Verify **Admin deployment fails** independently from the public site by confirming no public-site workflow or Ollama dependency was added, then run `spectra validate configure-admin-production`, `spectra analyze configure-admin-production`, and affected workspace tests/builds.
