# Retired GitHub CI workflows

The CI workflows in this directory were retired on 2026-09-30. These original
definitions are preserved as a command reference (literal synthetic keys are
replaced with `GENERATED_SYNTHETIC_CI_FIXTURE`). Files in this directory are not
GitHub Actions workflows and never run.

GitHub Actions itself is **enabled** for the repository (re-enabled by the owner
on 2026-10-01; see `docs/operations/deployment-policy.md`). The workflows that
run are the ones in `.github/workflows/`: `merge-gate.yml`, `build-images.yml`,
`changelog.yml`, `release.yml` and `apple-testflight.yml`.

Local Woodpecker CI, which briefly replaced the retired workflows, was removed on
2026-10-01. The checks required before merging into `develop` are defined in
`docs/operations/deployment-policy.md`.

Nightly E2E scheduling is retired. `merge-gate.yml` (pull requests into `main`,
`develop` and `integration/**`, and pushes to `main`) and `release.yml` (pushes to
`main`) are active. Production promotion is separately authorized and verified
under the deployment policy.
