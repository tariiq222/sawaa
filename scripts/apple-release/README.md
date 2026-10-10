# Sawaa Apple release

One bundle (`sa.sawa.app`), existing team/signing and one Apple build-number sequence. `develop` produces a staging build; `main` produces a production build. Installing another environment replaces the existing app. Log out before switching and sign in with that environment's account.

`.github/workflows/apple-testflight.yml` runs on relevant pushes and manual dispatch from those two branches. It waits for OpenShip, builds on standard GitHub macOS with pinned Xcode 26.2, verifies the signed IPA, uploads once and verifies Apple `VALID` plus `Sawaa Internal` availability. It never submits App Review. Main promotion remains subject to the owner's production approval and deployment policy.

## Gate

The project, branch, active ready deployment, six unique running containers and HTTP readiness must match. API/website are public on staging; dashboard has no public staging route. Live staging acceptance separately checks its internal HTTP endpoint. OpenShip's runtime API reports running state, not Docker health; do not label that receipt a full Docker-health audit.

A mobile-only push may produce OpenShip `no_changes`. It unlocks the build only with a matching new-SHA no_changes record and identical Git blob/mode/type identities for all server inputs in the active ready revision. Only mobile, docs, GitHub workflow files, this Apple helper and root Markdown are excluded. Both release `sourceSha` and runtime `deployedSha` are recorded. Any changed server input, truncated tree, failed deployment, duplicate container, stale branch or changed active deployment blocks upload.

## Existing Secrets

- `APPLE_DISTRIBUTION_P12_BASE64`, `APPLE_P12_PASSWORD`
- `APPLE_PROVISIONING_PROFILE_BASE64`
- `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_PRIVATE_KEY_BASE64`
- `MOBILE_FIREBASE_IOS_BASE64`
- `OPENSHIP_STAGING_READ_TOKEN`, `OPENSHIP_PRODUCTION_READ_TOKEN`: separate read-only credentials, each restricted to its project. Verify successful own-project reads, forbidden other-project reads and forbidden mutations before storing them.

No administrative SSH key, paid EAS service or second Apple app is required. Signing material is decoded only in a private runner temporary directory, never uploaded as an artifact. The builder restores the original keychain search list and existing provisioning profile on exit, deletes its keychain/session, and the workflow removes decoded inputs even when a step fails.

## Recovery

Jobs share one concurrency group and do not cancel uploads already running. Allocation reads Apple and selects a number greater than the observed maximum and reserved floor35. A concurrent manual Apple build blocks a first upload. Archive and binary verification must pass before creating an upload-intent artifact containing only source/environment/version/build/IPA hash.

The intent is saved to GitHub before altool. An uncertain transport result queries the exact app/marketing-version/build; it never blindly resends. Reruns recover the prior intent and resume an observed build. If that intended build remains absent, automatic upload stops because its outcome cannot be proven. Investigate the original run and Apple before manually resolving the ambiguity. A newer push also invalidates a waiting older run.

`apple-release-evidence-*` artifacts contain sanitized deployment/binary/Apple receipts. They exclude IPA, sourcemap, raw server metadata, build logs and signing files. Success means TestFlight availability; device acceptance, provider tests, App Review and public release remain separate.

## Checks

`bash scripts/apple-release/test.sh`; `pnpm --dir apps/mobile test --runInBand`; mobile typecheck/lint; actionlint on the workflow. Native archive/export must also be proven using `build-ios.sh` and verified output before release delivery is claimed.

Local verified IPA36 exists as recipe evidence only; it has not been uploaded. The first actual GitHub run must build its own merged source and record fresh Apple delivery. See the [dated record](../../docs/mobile-app/releases/2026-10-10-apple-automation.md).
