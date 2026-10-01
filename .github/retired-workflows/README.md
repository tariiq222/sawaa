# Retired GitHub CI workflows

GitHub Actions CI was retired on 2026-09-30. These original definitions
are preserved as a command reference (literal synthetic keys are replaced with `GENERATED_SYNTHETIC_CI_FIXTURE`); files outside `.github/workflows/`
are not GitHub Actions workflows. GitHub Actions is disabled repository-wide.

Local Woodpecker CI, which briefly replaced them, was removed on 2026-10-01.
The checks required before merging into `develop` are defined in
`docs/operations/deployment-policy.md`.

Nightly E2E scheduling is retired.
Main-only `merge-gate.yml` and `release.yml` remain in `.github/workflows/`
for reference and remain disabled by the repository setting. Production
promotion is separately authorized and verified under the deployment policy.
