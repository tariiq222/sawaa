# Release and deployment — Sawaa

The approved [deployment policy](../docs/operations/deployment-policy.md) controls authorization. The dated [operations summary](../docs/operations/current-state.md) separates source, runtime, mobile and pending gates.

```text
task branch → required checks → merge to main → automatic OpenShip staging
                                    owner accepts exact ready staging SHA
                                          ↓ manual workflow dispatch
                                    verified production → GitHub Release
```

Generic «انشر» / «انشر للاستيج» / «انشر على الاستيج» / «ننشر» stops at staging. See the [cutover runbook](../docs/operations/single-main-cutover.md) for live configuration and branch retirement.

`production-release-metadata.yml` creates a CalVer tag and GitHub Release for the SHA verified by the manual production workflow. Retrying the same commit reuses its release tag. `[skip release]` skips GitHub release metadata.

The obsolete `.github/DEPLOY_STATE.json` was removed because its tag-only data did not establish runtime state. GitHub tags/releases remain the source of code-release history. `scripts/check-deploy-state.mjs` retains its filename for callers but checks **code-release ancestry only**, excluding rollback tags. Passing it is not permission to merge or proof of deployment.

After observing the target environment, use the [deployment-record contract](../docs/operations/deployments/README.md). It requires an exact matching requested/running commit, deployment identity, six healthy services and three successful HTTP checks. Records are dated operator attestations, not automatic monitoring or signed proof. No historical deployment is retroactively marked verified without the required evidence.

## Checks and enforcement

`merge-gate.yml` supplies `gate` and `critical-real-e2e` for PRs into main. Configure and verify these checks in GitHub branch protection. The scripts for release ancestry, tags and deployment evidence use temporary local Git remotes in their behavioral tests.
