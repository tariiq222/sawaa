# Release and deployment — Sawaa

The single source of truth is [the approved deployment policy](../docs/operations/deployment-policy.md). Read it before any release operation.

```text
task branch → checks → develop → OpenShip staging
                                  ↓ owner manual test + explicit production command
                                main → OpenShip production → runtime verification
```

Generic «انشر» / «ننشر» stops at staging. CI success never replaces manual acceptance or authorizes production.

Existing workflows include `ci.yml`, `regression-check.yml`, `merge-gate.yml` and `release.yml`. Their presence does not prove GitHub branch protections or OpenShip deployment gates are configured. Inspect live settings before relying on them.

`release.yml` currently writes a release tag and deploy-state record after a main push, before proving production deployment success. Treat these as release metadata only. Its direct state commit to main and deployment-success recording need reconciliation with the approved policy.

Do not assume `[skip release]` prevents OpenShip deployment: it only controls the release workflow. Do not use a tag as the sole rollback target; identify a verified deployed version and check database compatibility. Do not bypass the staging/manual/production authorization gates for a hotfix without a separate explicit exception from the owner.
