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
| How it runs | prebuilt images via `docker/openship/compose.prebuilt.yml` | OpenShip builds on the host from `compose.yml` (until switched like staging) |

`/api/v1/health` returns `gitSha`. Images built by `build-images.yml` carry the full commit; host builds report `unknown`.

## Command meaning

- «انشر» / «ننشر»: PR into `develop`, then staging. Stop and hand over for the owner's manual test.
- «انشر للإنتاج» / «انشر للبرودكشن»: promote the accepted candidate `develop` → `main` and deploy production. Do not ask again for steps this skill lists.
- A request to fix or implement something does not authorize commit, push, merge or deploy.

## 1. Into develop

1. Work on a short task branch in its own worktree from `origin/develop`. One task branch at a time; never batch unrelated work into one integration branch.
2. Run the checks for the changed surface (root `CLAUDE.md` test matrix). Docs-only changes need `git diff --check`.
3. Push and open a PR into `develop`. The pre-push hook needs `node_modules`; if the worktree has none, push the commit from the main checkout. Never bypass hooks.
4. Merge only when `gate` and `critical-real-e2e` pass on the PR head. Use a merge commit.

## 2. Staging (automatic)

After a push to `develop`, `build-images.yml` builds and pushes the four images, then the `deploy-staging` job:
1. calls the OpenShip staging deploy webhook (secrets `OPENSHIP_STAGING_DEPLOY_HOOK_URL` / `_TOKEN`);
2. runs `scripts/openship/verify-prebuilt-deploy.mjs`: waits for a `ready` deployment of the commit with six running services and HTTP 200 checks, then requires `/api/v1/health` `gitSha` to equal the commit.

The job runs only while repository variable `STAGING_PREBUILT_DEPLOY=true`. Staging auto-deploy on git push is off; the workflow is the only trigger.

Your part: confirm the `deploy-staging` job is green for the merged commit, then give the owner the staging URL, the commit, a change summary and what to test manually. A green job is not owner acceptance.

If it fails: read the job log. `Running backend is not <sha>` means a stale image ran: check the four packages are public and the moving `:staging` tags point at the commit. Do not redeploy blindly more than once.

## 3. Production (agent-driven, on explicit command only)

Preconditions, all required:
- The owner accepted the exact candidate on staging. Staging runs the same tree you will merge (`git diff --quiet <staging sha> origin/develop`). Anything new in `develop` since acceptance stops promotion until it is tested too.
- The `develop` → `main` PR head equals that candidate; `gate` and `critical-real-e2e` pass on it.
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

Code only: redeploy the previous good deployment (`get_deployments_by_id_restore_plan`, then rollback on the target) or, for prebuilt services, point the image variables at the previous `<env>-<sha>` tag. Ask the owner first in production. Never restore an old database as part of a code rollback; that needs separate explicit authorization.

## Known failure modes

| Symptom | Cause | Action |
|---|---|---|
| `only one connection allowed`, BuildKit session failed | OpenShip 0.8.x host builds (dockerode session health) | Staging avoids it with prebuilt images. For production host builds, one retry; then stop and report. Upgrading OpenShip does not fix it as of 0.8.2. |
| TestFlight `unexpected redirect` | a checked URL redirects (`www.sawaa.sa` → `sawaa.sa`) | check URLs must answer 200 directly |
| `Deploy-state consistency` fails on a develop PR | `main` has a commit `develop` lacks | do step 3.7, then update the PR branch |
| `image-website` fails on `main` | `PRODUCTION_WEBSITE_API_URL` / `PRODUCTION_DEFAULT_ORG_ID` repo variables missing | values come from the production project's OpenShip env |
| Push rejected by `typecheck` hook in a fresh worktree | no `node_modules` | push from the main checkout |
