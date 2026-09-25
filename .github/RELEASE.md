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

`release-integrity.yml` runs the release tag, ancestry and deployment-record behavioral tests without application dependencies. It uses temporary local Git remotes and never publishes a real release in tests.

`merge-gate.yml` is an additional check, not an aggregate of `ci.yml`. Branch protection must separately require the relevant CI jobs (backend, dashboard, website, mobile, security, critical-real-e2e, dashboard-smoke, outbox-transport), `gate` for main, and `release-integrity`. Confirm the actual check names and fresh results before configuring protection. Workflow presence does not configure protection; the last observed enforcement limitations are in the operations summary.
