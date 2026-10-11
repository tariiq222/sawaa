---
name: sawaa-release
description: Use for any Sawaa publish, staging deploy, production promotion, rollback or deployment verification. Triggers on «انشر», «ننشر», «انشر للإنتاج», «انشر للبرودكشن», deploy, release, staging, production, rollback, OpenShip, build-images, GHCR.
---

# Sawaa release

The fixed path from a merged change to a verified production release. It implements
[the deployment policy](../../../docs/operations/deployment-policy.md); the policy wins on any conflict.
Work only on Sawaa (`tariiq222/sawaa`); never touch other projects on the shared server or in shared folders.

## Fixed facts

| | Staging | Production |
|---|---|---|
| Branch | `develop` | `main` |
| OpenShip project | `proj_7M0RNj59nQnafh1m` | `proj_tsxe0sAW3u2AMSGO` |
| Server | `f2c67bb9-d9bf-415d-a92f-66663ca512c5` (shared with other projects) | same |
| Public checks | `https://staging.sawaa.sa/` and `/api/v1/health/ready` | `https://sawaa.sa/`, `https://admin.sawaa.sa/`, `https://api.sawaa.sa/api/v1/health/ready`, `https://files.sawaa.sa/minio/health/live` |
| Images | `ghcr.io/tariiq222/sawaa-{postgres,backend,dashboard,website}:staging[-<sha>]` | `…:production[-<sha>]` |
| How it runs | digest-pinned application images via `docker/openship/compose.prebuilt.yml` | OpenShip builds on the host from `compose.yml` (until switched like staging) |

`/api/v1/health` returns `gitSha`. Images built by `build-images.yml` carry the full commit; host builds report `unknown`.

## Command meaning

- «انشر» / «ننشر»: PR into `develop`, then staging. Stop and hand over for the owner's manual test.
- «انشر للإنتاج» / «انشر للبرودكشن»: promote the accepted frozen candidate `release/<date>` → `main` and deploy production. Do not ask again for steps this skill lists.
- A request to fix or implement something does not authorize commit, push, merge or deploy.

## 1. Into develop

1. Work on a short task branch in its own worktree from `origin/develop`. One task branch at a time; never batch unrelated work into one integration branch.
2. Run the checks for the changed surface (root `CLAUDE.md` test matrix). Docs-only changes need `git diff --check`.
3. Push and open a PR into `develop`. The pre-push hook needs `node_modules`; if the worktree has none, push the commit from the main checkout. Never bypass hooks.
4. Merge only when `gate` and `critical-real-e2e` pass on the PR head. Use a merge commit.

## 2. Staging — the single fixed path

Use the mechanism in [the deployment policy](../../../docs/operations/deployment-policy.md#fixed-staging-publication-path--owner-approved-2026-10-11). Do not create another deploy recipe when it fails.

1. `build-images.yml` builds all four images on GitHub and emits application SHA/digest artifacts. No runtime changes occur after a partial build.
2. `scripts/openship/staging-deploy.mjs` accepts only develop and staging project `proj_7M0RNj59nQnafh1m`, with `autoDeploy=false` and prebuilt compose. It rejects missing activation, wrong hook scope or unsafe backend startup.
3. It reads migration metadata with a SELECT-only read-only transaction. Pending/failed/unknown/new checksum drift blocks deployment. Three exact historical checksum pairs from the existing provenance report are preserved, never repaired. The prebuilt backend starts directly without migrations or migration credentials.
4. It temporarily selects the immutable candidate SHA as the staging Git ref, pins only backend/dashboard/website image variables to the build digests, then invokes the existing token-authenticated hook scoped to exactly those three service IDs with strict scope. The hook snapshots that SHA before the selected ref returns to `develop`. PostgreSQL/Redis/MinIO retain their containers, images and mounts. A superseding push is reported explicitly; never substitute its source files into an older image set.
5. It verifies the returned deployment is active/ready for the expected SHA, all three runtime digests match, backend health reports that SHA, public API/website and internal dashboard answer 200, infrastructure containers are unchanged and migration metadata is identical. It saves the sanitized artifact `staging-deployment-<sha>`.

Required variables: `STAGING_PREBUILT_DEPLOY=true`, `OPENSHIP_STAGING_HOOK_ID`. Required automation secrets: `OPENSHIP_STAGING_DEPLOY_TOKEN` (read/write limited to this staging project) and `OPENSHIP_STAGING_DEPLOY_HOOK_TOKEN`. The existing `OPENSHIP_STAGING_READ_TOKEN` remains for other read-only release gates. Do not log tokens or read-back hook secrets.

Manual publication or retry: `gh workflow run build-images.yml --repo tariiq222/sawaa --ref develop`. This uses exactly the same job and concurrency group. Do not use ordinary Redeploy, host rebuilds, moving tags or SSH container operations as a substitute. Read the failure, repair the path, then allow at most one bounded transient retry. Never claim success from build/ready alone.

Docs/mobile-only commits may be ahead of the server image because automatic server publication ignores them. Verify and record unchanged server inputs; for a fresh exact-SHA runtime use the manual workflow on current develop through this same path.

Give the owner the staging URL, actual runtime SHA, deployment id, verified evidence and relevant manual test steps. Automated success is not owner acceptance.

## 3. Production (agent-driven, on explicit command only)

Preconditions, all required:
- The owner accepted the exact candidate on staging. Cut `release/<YYYY-MM-DD>` from the exact staging SHA after it is ready and the owner starts its manual test. The accepted release branch stays frozen; later develop changes cannot enter it.
- The `release/<date>` → `main` PR head equals that accepted candidate; `gate` and `critical-real-e2e` pass on it.
- New migrations are additive only (read their SQL).

Steps:
1. **Backup** on the server: `pg_dumpall` (gzip), `pg_dump -Fc`, Redis `SAVE` + tar, MinIO data tar, row counts (finished migrations, `Client`, `Booking`, `Payment`) and `SHA256SUMS`, into `/var/backups/sawaa/pre-production-<UTC>/` with mode 700/600. Use the container credentials through `sh -c '… "$POSTGRES_USER" …'`; never print secrets.
2. **Restore test**: restore `db.dump` into a throwaway container with `--network none` from the production Postgres image and compare the counts. Stop if they differ.
3. Record the rollback point: current `main` SHA and active deployment id.
4. Mark the PR ready if it is a draft, then `gh pr merge <n> --merge --match-head-commit <candidate sha>`. Never squash the promotion.
5. Production auto-deploys from `main`. Poll the deployment to `ready` (`get_projects_by_id_deployments` with `perPage: 1`, or host `docker ps`); answer no prompts by guessing.
6. **Verify**: six containers healthy with the new deployment label; the public checks above return 200; finished migrations = before + new, zero failed; the row counts equal the backup; backend log shows no ` ERROR ` after start.
7. **Sync**: open a PR `main` → `develop` (no code change), wait for its checks, merge with a merge commit. Without it, the next develop PR fails `Deploy-state consistency`.
8. **Receipt**: write a private evidence JSON (shape of `docs/operations/deployments/evidence.example.json`) from observed values, run `node scripts/record-deployment.mjs <evidence> docs/operations/deployments/<date>-production-<dep id>.json` within 24 hours, add a dated top entry to `docs/operations/current-state.md`, and land both through a PR into `develop`.

Report to the owner: commit, deployment id, checks, backup path and restore result, rollback point, and what was not tested (for example real payments or the mobile app).

## Rollback

Staging code rollback: review a revert, merge it into `develop` through a PR, and publish it through `build-images.yml` → `staging-deploy.mjs`, including fresh build manifests and verification. Bare OpenShip rollback/redeploy and selecting old digests are not supported staging shortcuts.

Production code rollback requires the owner's separate explicit authorization and its own reviewed restore-plan. Never restore an old database as part of a code rollback; that needs separate explicit authorization.

## Known failure modes

| Symptom | Cause | Action |
|---|---|---|
| `only one connection allowed`, BuildKit session failed | OpenShip 0.8.x host builds (dockerode session health) | Staging avoids it with prebuilt images. For production host builds, one retry; then stop and report. Upgrading OpenShip does not fix it as of 0.8.2. |
| TestFlight `unexpected redirect` | a checked URL redirects (`www.sawaa.sa` → `sawaa.sa`) | check URLs must answer 200 directly |
| `Deploy-state consistency` fails on a develop PR | `main` has a commit `develop` lacks | do step 3.7, then update the PR branch |
| `image-website` fails on `main` | `PRODUCTION_WEBSITE_API_URL` / `PRODUCTION_DEFAULT_ORG_ID` repo variables missing | values come from the production project's OpenShip env |
| Push rejected by `typecheck` hook in a fresh worktree | no `node_modules` | push from the main checkout |
