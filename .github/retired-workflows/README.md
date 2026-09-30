# Retired GitHub CI workflows

The owner selected local Woodpecker on 2026-09-30. These original definitions
are preserved as the command parity reference (literal synthetic keys are replaced with `GENERATED_SYNTHETIC_CI_FIXTURE`); files outside `.github/workflows/`
are not GitHub Actions workflows. GitHub Actions is disabled repository-wide.

The develop PR gate now lives in `.woodpecker/ci.yml` and `scripts/ci/`.
See `docs/operations/local-woodpecker-ci.md` for exact invocation and evidence.
A candidate may merge only after all replacement phases pass.

Nightly E2E scheduling is retired, not silently replaced by the develop gate.
Main-only `merge-gate.yml` and `release.yml` remain in `.github/workflows/`
for reference and remain disabled by the repository setting. Production
promotion is separately authorized and verified under the deployment policy.
