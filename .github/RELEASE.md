# Release and deployment — Sawaa

The approved [deployment policy](../docs/operations/deployment-policy.md) controls authorization. The dated [operations summary](../docs/operations/current-state.md) separates source, runtime, mobile and pending gates.

```text
task branch → checks → develop → OpenShip staging
                                  ↓ owner manual test + explicit production command
                                main → OpenShip production → runtime verification
```

Generic «انشر» / «ننشر» stops at staging. CI success never replaces manual acceptance or authorizes production.

## Code release versus deployment

`release.yml` creates a CalVer tag and GitHub Release for the exact main event commit. It does not commit or push a branch, update a deployment-state file, or claim that OpenShip succeeded. Retrying the same commit reuses its release tag. `[skip release]` skips this metadata only; it does not stop OpenShip.

The obsolete `.github/DEPLOY_STATE.json` was removed because its tag-only data did not establish runtime state. GitHub tags/releases remain the source of code-release history. `scripts/check-deploy-state.mjs` retains its filename for callers but checks **code-release ancestry only**, excluding rollback tags. Passing it is not permission to merge or proof of deployment.

After observing the target environment, use the [deployment-record contract](../docs/operations/deployments/README.md). It requires an exact matching requested/running commit, deployment identity, six healthy services and three successful HTTP checks. Records are dated operator attestations, not automatic monitoring or signed proof. No historical deployment is retroactively marked verified without the required evidence.

## Checks and enforcement

`merge-gate.yml` runs on pull requests into `main`, `develop` and `integration/**` and on pushes to `main`. It has exactly two jobs, `gate` and `critical-real-e2e`; those are the required checks named in the [deployment policy](../docs/operations/deployment-policy.md#merge-checks-for-develop--owner-direction-2026-10-01). A `cancelled`, skipped or failed required check counts as failed. The separate `ci.yml`, `release-integrity.yml`, `dashboard-smoke` and `outbox-transport` jobs were retired (see `.github/retired-workflows/`) and must not be configured as required checks. `gate` runs the deploy-state regression tests (`scripts/check-deploy-state.test.mjs`) and the code-release ancestry check.

Confirm the actual check names and fresh results before configuring branch protection. Workflow presence does not configure protection; the last observed enforcement limitations are in the operations summary.
