---
name: sawaa-release
description: Use for any Sawaa publish, staging deploy, production promotion, rollback or deployment verification. Triggers on «انشر», «انشر للاستيج», «ننشر», «ادمج في الإنتاج», «انشر في الإنتاج», «انشر للإنتاج», «انشر للبرودكشن», deploy, release, staging, production, rollback, OpenShip, build-images, GHCR.
---

# Sawaa release

The fixed path from a merged change to a verified production release. It implements
[the deployment policy](../../../docs/operations/deployment-policy.md); the policy wins on any conflict.
Work only on Sawaa (`tariiq222/sawaa`); never touch other projects on the shared server or in shared folders.

## Fixed facts

| | Staging | Production |
|---|---|---|
| Source branch | `main` | `main` |
| OpenShip project | `proj_7M0RNj59nQnafh1m` | `proj_tsxe0sAW3u2AMSGO` |
| Server | `f2c67bb9-d9bf-415d-a92f-66663ca512c5` (shared with other projects) | same |
| Public checks | `https://staging.sawaa.sa/` and `/api/v1/health/ready` | `https://sawaa.sa/`, `https://admin.sawaa.sa/`, `https://api.sawaa.sa/api/v1/health/ready`, `https://files.sawaa.sa/minio/health/live` |
| Images | `ghcr.io/tariiq222/sawaa-{postgres,backend,dashboard,website}:staging[-<sha>]` | `…:production[-<sha>]` |
| How it runs | digest-pinned application images via `docker/openship/compose.prebuilt.yml` | digest-pinned application images via `compose.prebuilt.yml`, explicit production admission |

`/api/v1/health` returns `gitSha`. Images built by `build-images.yml` carry the full commit; legacy host builds report `unknown`; new production publication requires the image SHA.

## Command meaning

- «انشر» / «انشر للاستيج» / «انشر على الاستيج» / «ننشر»: PR into `main`, then staging. Stop and hand over for the owner's manual test.
- «ادمج في الإنتاج» / «انشر في الإنتاج» / «انشر للإنتاج» / «انشر للبرودكشن»: dispatch the manual production job for the exact current main SHA accepted on staging. Do not ask again for steps this skill lists.
- A request to fix or implement something does not authorize commit, push, merge or deploy.

## 1. Into main

1. Work on a short task branch in its own worktree from `origin/main`. One task branch at a time; never batch unrelated work into one integration branch.
2. Run the checks for the changed surface (root `CLAUDE.md` test matrix). Docs-only changes need `git diff --check`.
3. Push and open a PR into `main`. The pre-push hook needs `node_modules`; if the worktree has none, push the commit from the main checkout. Never bypass hooks.
4. Merge only when `gate` and `critical-real-e2e` pass on the PR head. Use a merge commit.

## 2. Staging — the single fixed path

Use the mechanism in [the deployment policy](../../../docs/operations/deployment-policy.md#fixed-staging-publication-path--owner-approved-2026-10-11). Do not create another deploy recipe when it fails.

1. `build-images.yml` builds all four images on GitHub and emits application SHA/digest artifacts. No runtime changes occur after a partial build.
2. `scripts/openship/staging-deploy.mjs` accepts only main and staging project `proj_7M0RNj59nQnafh1m`, with `autoDeploy=false` and prebuilt compose. It rejects missing activation, wrong hook scope or unsafe backend startup.
3. It reads migration metadata with a SELECT-only read-only transaction. Pending/failed/unknown/new checksum drift blocks deployment. Three exact historical checksum pairs from the existing provenance report are preserved, never repaired. The prebuilt backend starts directly without migrations or migration credentials.
4. It temporarily selects the immutable candidate SHA as the staging Git ref, pins only backend/dashboard/website image variables to the build digests, then invokes the existing token-authenticated hook scoped to exactly those three service IDs with strict scope. The hook snapshots that SHA before the selected ref returns to `main`. PostgreSQL/Redis/MinIO retain their containers, images and mounts. A superseding push is reported explicitly; never substitute its source files into an older image set.
5. It verifies the returned deployment is active/ready for the expected SHA, all three runtime digests match, backend health reports that SHA, public API/website and internal dashboard answer 200, infrastructure containers are unchanged and migration metadata is identical. OpenShip `ready` can precede container health: application-only `starting` is polled for at most 20 observations, 15 seconds apart, with identity/digest/infrastructure checks on each observation. Invalid state fails immediately; all six must be running before success. It saves the sanitized artifact `staging-deployment-<sha>`.

For fully image-backed deployments OpenShip can omit `commitSha`. This staging path still requires the exact immutable candidate SHA in the recorded branch, matching application digests and an independently observed live backend `gitSha`. Populated contradictory metadata fails; production uses its separately authorized frozen-source/digest/health proof.

Required variables: `STAGING_PREBUILT_DEPLOY=true`, `OPENSHIP_STAGING_HOOK_ID`. Required automation secrets: `OPENSHIP_STAGING_DEPLOY_TOKEN` (read/write limited to this staging project) and `OPENSHIP_STAGING_DEPLOY_HOOK_TOKEN`. The existing `OPENSHIP_STAGING_READ_TOKEN` remains for other read-only release gates. Never print tokens or include hook secrets in logs, reports or artifacts; private credential transfer for setup is allowed.

Updating the incoming hook's `actionConfig` or execution authority can rotate its token. Configure the final staging-only service scope first, then privately transfer its current credential directly into `OPENSHIP_STAGING_DEPLOY_HOOK_TOKEN`. HTTP 404 can mask a credential or execution-authority mismatch. Diagnose and correct this same path, then rerun the failed GitHub deployment job using its existing build artifacts.

Full manual publication: `gh workflow run build-images.yml --repo tariiq222/sawaa --ref main -f target=staging`. This uses exactly the same job and concurrency group. Rerunning the failed deployment job after a diagnosed configuration correction also uses this path. Do not use ordinary Redeploy, host rebuilds, moving tags or SSH container operations as a substitute. Read the failure, repair the path, then allow at most one bounded transient retry. Never claim success from build/ready alone.

All main merges queue staging, including docs and mobile-only commits. Verify the exact running SHA independently. If a newer run supersedes it, provide the actual runtime SHA for acceptance.

Give the owner the staging URL, actual runtime SHA, deployment id, verified evidence and relevant manual test steps. Automated success is not owner acceptance.

## 3. Production (agent-driven, on explicit command only)

Preconditions, all required:
- The owner accepted the exact active staging SHA after it was observed ready. Confirm it is still the head of main with successful required checks.
- Check additive migrations and their compatibility. Pending migrations require separate authorization, isolated restore/migration validation, and `prisma migrate deploy` before application publication.

Steps:
1. **Backup** on the server: `pg_dumpall` (gzip), `pg_dump -Fc`, Redis `SAVE` + tar, MinIO data tar, row counts (finished migrations, `Client`, `Booking`, `Payment`) and `SHA256SUMS`, into `/var/backups/sawaa/pre-production-<UTC>/` with mode 700/600. Use container credentials without printing them.
2. **Restore test**: restore `db.dump` into a throwaway container with `--network none` from the production Postgres image and compare the counts. Stop if they differ. Record the active production deployment ID and observed source SHA as the rollback point.
3. Record `PRODUCTION_BACKUP_EVIDENCE` and the environment-scoped `SAWAA_PRODUCTION_ACCEPTANCE` only from observed evidence. Include the owner login, accepted SHA, staging deployment ID, successful GitHub staging run ID, staging verification time and later owner acceptance time. Confirm `SAWAA_PRODUCTION_ACTOR` matches the authorized dispatcher.
4. Dispatch `gh workflow run build-images.yml --repo tariiq222/sawaa --ref main -f target=production -f accepted_sha=<full SHA>`. Follow the run to its verified production evidence artifact. The publisher refuses a newer head or different active staging deployment before triggering the hook. If main advances after the hook, verify and report the exact running SHA with the supersession flag.
5. **Verify**: all six containers healthy, three application digests matching, infrastructure container identities preserved, public checks above return 200, migration metadata unchanged by the application deploy and live backend SHA matches. The release metadata job uses the verified production SHA.
6. **Receipt**: write private evidence JSON using `docs/operations/deployments/evidence.example.json`, run `node scripts/record-deployment.mjs <evidence> docs/operations/deployments/<date>-production-<dep id>.json` within 24 hours, and add a dated entry to `docs/operations/current-state.md`. Submit the receipt through a normal PR into main.

Report to the owner: commit, deployment id, checks, backup path and restore result, rollback point, and what was not tested (for example real payments or the mobile app).

## Rollback

Staging code rollback: review a revert, merge it into `main` through a PR, and publish it through `build-images.yml` → `staging-deploy.mjs`, including fresh build manifests and verification. Bare OpenShip rollback/redeploy and selecting old digests are not supported staging shortcuts.

Production code rollback requires the owner's separate explicit authorization and its own reviewed restore-plan. Never restore an old database as part of a code rollback; that needs separate explicit authorization.

## Known failure modes

| Symptom | Cause | Action |
|---|---|---|
| `only one connection allowed`, BuildKit session failed | OpenShip 0.8.x host builds (dockerode session health) | Staging avoids it with prebuilt images. Production now uses prebuilt images as well; host builds are not a fallback. Repair the fixed mechanism and stop on a failed gate. Upgrading OpenShip does not fix it as of 0.8.2. |
| TestFlight `unexpected redirect` | a checked URL redirects (`www.sawaa.sa` → `sawaa.sa`) | check URLs must answer 200 directly |
| `Deploy-state consistency` fails on a PR | candidate lacks current main or its release ancestry | update the task branch and rerun checks |
| `image-website` fails on `main` | `PRODUCTION_WEBSITE_API_URL` / `PRODUCTION_DEFAULT_ORG_ID` repo variables missing | values come from the production project's OpenShip env |
| Push rejected by `typecheck` hook in a fresh worktree | no `node_modules` | push from the main checkout |
