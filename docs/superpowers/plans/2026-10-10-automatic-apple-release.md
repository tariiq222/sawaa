# Automatic Apple Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and distribute the single Sawaa app to TestFlight automatically after its matching OpenShip deployment succeeds.

**Architecture:** One workflow handles `develop` and `main`, with fixed staging and production targets. OpenShip remains the image builder; GitHub reads deployment evidence, generates native iOS using Expo prebuild, signs with existing credentials and verifies Apple processing and group availability.

**Tech Stack:** Node.js, pnpm, Expo SDK 55, Xcode on GitHub macOS, Ruby xcodeproj, App Store Connect API, OpenShip read APIs.

**Spec:** `docs/superpowers/specs/2026-10-10-automatic-apple-release.md`

## Global Constraints

- Bundle `sa.sawa.app`, team `569M49FYA6`, ASC app `6815632181`.
- `develop`: `https://staging.sawaa.sa/api/v1`; `main`: `https://api.sawaa.sa/api/v1`.
- TestFlight only; production source promotion still follows `docs/operations/deployment-policy.md`.
- Existing signing only; no second app, GHCR migration, EAS subscription or administrative SSH secret in GitHub.
- Preserve unrelated changes, existing Apple Pay/APNS/Firebase behavior and mobile patches.
- Execute inline because build, validation and distribution share one release identity. Use one independent Sol 6.1 review after integrated checks.

## Review Focus

1. A release profile with the other environment's URL must fail before prebuild.
2. An old healthy deployment or partially failed deployment must never unlock Apple upload.
3. A superseded branch SHA must not publish after waiting for its server deployment.
4. An ambiguous upload response or Actions rerun must query Apple before attempting another upload.
5. Signing failure and cancellation must still remove temporary secrets and keychains.

### Task 1: Fixed environment configuration

**Files:** Modify `apps/mobile/eas.json`, `apps/mobile/constants/api-url-validation.js`, `apps/mobile/constants/config.test.ts`, `apps/mobile/app.config.ts`; create `scripts/apple-release/target.mjs` and its Node tests. Update the dated mobile release record, README and runbook.

**Interfaces:** `releaseTarget(branch)` returns `{profile, apiUrl, projectId, readinessUrl, dashboardUrl, websiteUrl}`. Only `develop` and `main` are allowed. Release profiles are `staging` and `production`.

- [ ] Add failing tests for profile/URL mismatch and unknown branches; run mobile's config test with coverage disabled and Node's focused release tests.

```js
assert.throws(() => releaseTarget('feature/example'));
assert.equal(releaseTarget('develop').apiUrl, 'https://staging.sawaa.sa/api/v1');
assert.equal(releaseTarget('main').apiUrl, 'https://api.sawaa.sa/api/v1');
```

- [ ] Require the fixed URL when a release profile is present. Keep existing development resolution and generic NODE_ENV HTTPS validation.

```js
const RELEASE_API_URLS = {
  staging: 'https://staging.sawaa.sa/api/v1',
  production: 'https://api.sawaa.sa/api/v1',
};
const expected = RELEASE_API_URLS[easBuildProfile];
if (expected && apiUrl !== expected) throw new Error(`API URL must match ${easBuildProfile}`);
```

- [ ] Add permanent staging and production EAS settings with explicit public API and existing merchant ID. Add CI build-number input to Expo config, validating a positive Apple-compatible value. Preserve the single bundle ID.
- [ ] Inspect existing storage for cross-environment sessions. Do not alter auth semantics; record any issue requiring separate approval.
- [ ] Run mobile config tests, typecheck and lint; review changes and commit only scoped files when delivery is authorized.

### Task 2: Deployment gate and signed binary

**Files:** Create `scripts/apple-release/deployment.mjs`, `build-ios.sh`, `configure-signing.rb`, `verify-ipa.py`, `deployment.test.mjs`, and `verify-ipa.test.py`.

**Interfaces:** `waitForDeployment(target, sha, token)` polls read-only OpenShip endpoints and returns sanitized evidence. `build-ios.sh` consumes the fixed environment, SHA, build number and temporary signing paths and outputs one IPA and a verification receipt.

- [ ] Add tests where an active old SHA, wrong project, partial failure, missing service or duplicate container is rejected. Successful fixtures must match SHA, active deployment and enabled service identities. Test bounded timeout and superseded source.
- [ ] Implement the gate using the project's read endpoint, deployment detail/status, and `/api/projects/{id}/services/containers`; inspect actual returned service-state metadata before relying on it. Independently check the three target HTTP endpoints and recheck source SHA before signing/upload. Never treat stored desired configuration as runtime evidence.
- [ ] Select a standard GitHub macOS image and a pinned available Xcode version compatible with SDK 55 and current Apple requirements. Install both root and mobile frozen lockfiles and build shared packages.

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/mobile install --frozen-lockfile
pnpm --filter @sawaa/shared build
pnpm --dir apps/mobile exec expo prebuild --clean --platform ios --no-install
```

- [ ] Import the existing P12 into a temporary keychain, validate the decoded profile against bundle/team/certificate/capabilities/expiry, install it temporarily and configure manual signing on the app target with Ruby xcodeproj. Do not force provisioning settings onto every Pods target.
- [ ] Install Pods, archive the Release scheme with `xcodebuild`, and export with `method=app-store-connect`. Use an EXIT trap to remove decoded secrets, temporary profile and keychain even on failure.
- [ ] Verify IPA identity, build/version, non-development signature, profile, Apple Pay, APNS, Firebase, fonts and native payment module. Capture JS sourcemap during bundling and validate the fixed API URL at its release configuration origin instead of searching arbitrary URLs in the binary.
- [ ] Run unit fixtures for wrong profile/capability/URL and cleanup failures. Build locally using this exact recipe and save an IPA hash and sanitized receipt without uploading a test binary.

### Task 3: Apple lifecycle and GitHub workflow

**Files:** Create `.github/workflows/apple-testflight.yml`, `scripts/apple-release/apple.mjs`, `apple.test.mjs`, and `scripts/apple-release/README.md`; update mobile runbook and dated record with actual observations.

**Interfaces:** Apple helper uses ES256 JWT from temporary key material. It resolves build numbers, uploads the verified IPA, waits for processing and adds the processed build to internal group `e6c7ec75-2b70-471a-b07e-bec53443702d`; returns `{environment, sourceSha, version, buildNumber, buildId, processingState, groupId}` only after fresh verification.

- [ ] Add mocked lifecycle tests for VALID, INVALID, processing timeout, pre-existing build and upload-result uncertainty. Verify uncertain upload queries the exact app/version/build before retrying and never blindly reuploads.
- [ ] Serialize staging and production jobs under one concurrency group without cancelling an upload in progress. Allocate a unique build greater than Apple's observed latest number within CFBundleVersion constraints; recheck before upload and fail if a concurrent manual build conflicts.
- [ ] Use `xcrun altool` with the existing API key, wait for VALID, apply the already established encryption answer and environment-labelled Arabic test notes, add the build to Sawaa Internal and query group availability. Do not create an App Review submission.
- [ ] Trigger on relevant pushes to develop/main; support rerun for the current branch revision. Permissions are `contents: read`. Production branch entry relies on the approved promotion path and verified production deployment. Fork PRs never receive signing secrets.
- [ ] Store only named existing signing/ASC/Firebase materials in Secrets. Use separately scoped OpenShip read tokens after verifying access restrictions; do not create a broad token or copy the host's administrative SSH key.
- [ ] Run focused script tests, workflow validation, mobile typecheck/lint, and one independent review. Follow authorized PR/check/merge path into develop; verify actual GitHub runner build, Apple processing and group availability. Record blockers and distinguish configuration complete from observed release delivery.

## Plan self-review

The three tasks cover target separation, deployment gating, native signing, Apple lifecycle and delivery documentation. Each review focus is assigned to its owning task. OpenShip's build hang remains a separately diagnosed prerequisite; this plan neither hides it with an external image builder nor authorizes a broad platform upgrade.
