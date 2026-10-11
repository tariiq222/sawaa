# Sawaa deployment policy — approved 2026-09-11

This is the shared deployment policy for every AI tool and contributor working on Sawaa. It supersedes older project deployment instructions. Higher-priority platform instructions still apply.

## Meaning of the owner's commands

- **«انشر» / «ننشر» / «انشر على الاستيج»** authorizes scoped commits, pushing the task branch, a PR and merge into `develop`, and deployment to OpenShip staging after the required checks. Stop there and provide the staging URL, tested revision, change summary, and manual test steps. It never authorizes a merge into `main` or production deployment.
- **«انشر للبرودكشن» / «انشر للإنتاج» / «اعتمد وانشر للإنتاج»** authorizes the release PR from the frozen `release/<date>` branch to `main` and production deployment only after confirming the owner's manual staging test and the exact tested release content, plus successful required checks. Do not ask again for actions already covered by this command.
- Approval of this policy alone does not request a deployment. A request to implement a fix alone does not authorize committing, pushing or deploying it.

## Normal path

### Local and remote branches — owner-approved 2026-10-04

- `develop` is the primary local branch. Keep temporary task branches as needed; a local `main` branch is not required and may be removed after verifying its commits are preserved. Keep remote `main` as the production branch. Without a local `main`, run `git remote set-head origin develop` once per clone: lefthook's pre-push hook diffs new branches against the local branch named by `origin/HEAD`, and fails with `bad revision 'main'` otherwise.
- Integrate task branches through PRs into remote `develop`, then synchronize local `develop` from `origin/develop` with a fast-forward while preserving uncommitted work.
- Validate the resulting revision on staging and obtain the owner's manual acceptance before promotion.
- Promote the accepted release through a PR from frozen `release/<date>` to remote `main` only after explicit production authorization, then deploy and verify production under the rules below.
- Approval of this workflow does not itself execute branch cleanup, commit, push, merge, or deployment.

### Local `develop` workflow and automatic sync — owner-approved 2026-10-10

The owner works directly on local `develop`. Every AI tool must keep that working and keep local `develop` identical to `origin/develop`:

- **Local `develop` is a mirror of `origin/develop` plus the owner's not-yet-published commits.** Never reset, rebase, force-update or discard local `develop` or its uncommitted changes. Never push `develop` directly to GitHub.
- **Publishing local commits:** on «انشر», push the unpublished local commits to a temporary branch (`git push origin develop:refs/heads/publish/<topic>`), open a PR from it into `develop`, and merge it with a **merge commit**. Squash and rebase merges are disabled on GitHub (2026-10-10): they rewrite the owner's commits so local `develop` could never fast-forward again.
- **Automatic sync:** the launchd agent `sa.sawaa.develop-sync`, installed by `scripts/install-develop-sync.sh`, runs `scripts/sync-develop.sh` every 5 minutes. It only fast-forwards local `develop`, skips while a git operation is in progress, lets git refuse any update that would overwrite uncommitted changes, and sends a macOS notification when local `develop` has diverged or is blocked. Log: `~/Library/Logs/sawaa-develop-sync.log`. Reinstall it after editing the script.
- **After every merge into `develop` or `main`**, the AI tool that merged runs `scripts/sync-develop.sh` immediately, then confirms `git rev-parse develop` equals `git rev-parse origin/develop` (or that local `develop` is only ahead by unpublished owner commits). If it reports divergence, stop and tell the owner; do not resolve it silently.
- Task branches and worktrees remain allowed for AI tools working in parallel. Create them from `origin/develop`, merge them through PRs with merge commits, then delete the branch and worktree after the merge.

### Frozen release candidate — owner-approved 2026-10-10

- The owner's manual acceptance applies to one exact SHA, observed `ready` on OpenShip staging with that same commit. Acceptance given before staging is ready on that SHA does not count.
- When the owner starts the manual test, create `release/<YYYY-MM-DD>` from that SHA. The production PR is `release/<date>` → `main`, never `develop` → `main`, so later merges into `develop` cannot enter the release.
- If the accepted test finds a problem, fix it in `develop`, redeploy staging, retest, and cut a new `release/<date>` branch from the new SHA.
- A `cancelled`, skipped or failed required check counts as failed.
- After production is verified, sync `main` back into `develop` through a PR, record the deployment the same day, and delete the release branch.

1. Start a task branch (Codex default: `codex/<task>`) from current `develop`; use an isolated worktree when needed to keep concurrent work separate. Preserve unrelated work.
2. Implement and verify the scoped change. Use PRs; never push directly to `main`, force-push protected branches or bypass required checks.
3. On a staging publication command, merge the reviewed task into `develop`, deploy staging and verify that the intended revision actually runs. Automated tests do not replace the owner's manual staging test.
4. Record the staging revision and manual acceptance. If additional changes enter the release candidate, stop promotion until those changes are tested and accepted too. Never silently include unrelated/unaccepted changes from `develop`.
5. Only on an explicit production command, verify the accepted SHA matches the `release/<date>` → `main` release PR, check backup readiness and migration compatibility, merge and deploy production. Prevent concurrent updates from changing the candidate during promotion; recheck if either branch moves.
6. Verify the deployed revision and affected flows, then record release/deployment identifiers, evidence and the prior working version. A merge, tag or green CI alone is not proof of successful deployment.
7. Preserve history between the long-lived branches; synchronize `main` back into `develop` through a PR when needed. Do not rewrite/reimplement the change in reverse. Use a merge strategy that preserves their ancestry; do not squash the long-lived branch promotion.

## Fixed staging publication path — owner-approved 2026-10-11

The only staging publication path is `build-images.yml` → successful complete image build → `scripts/openship/staging-deploy.mjs` → the existing OpenShip incoming deploy hook → observed runtime verification. Do not add another trigger or fall back to host builds, the ordinary Redeploy button, mutable image tags, or ad-hoc SSH container replacement when this path fails. Diagnose and repair this path.

- OpenShip staging project `proj_7M0RNj59nQnafh1m` follows `develop`, uses `docker/openship/compose.prebuilt.yml`, and keeps git `autoDeploy=false`.
- The build matrix emits SHA-bound digest artifacts. Only after all build jobs succeed does the deployment job update the three application image variables to `ghcr.io/tariiq222/sawaa-<service>@sha256:<digest>` and call the hook. Moving tags never select the runtime.
- Before changing image variables, the orchestrator selects the candidate full SHA as the staging project’s temporary Git ref. The hook freezes that immutable source/config snapshot before the ref returns to `develop`; a concurrent push cannot mix source and image revisions. If a run stops before triggering, it restores previous image refs; a lost trigger response fails for investigation. An interrupted job that leaves a SHA selected blocks subsequent publication until this same staging configuration is repaired.
- The hook targets exactly backend, dashboard and website with strict service scope. PostgreSQL, Redis, MinIO, their image variables and persistent mounts are outside an application deployment. Their container identities must remain unchanged.
- The prebuilt backend starts with `node dist/src/main.js`, without a migration credential or migration command. The orchestrator reads `_prisma_migrations` in a `BEGIN READ ONLY` transaction before and after publication; missing/failed/modified/unknown migrations block publication. The three exact historical checksum pairs already documented on 3 October are preserved as provenance in the staging verifier; this is not a repair, and no new exception is inferred. Schema changes require separately authorized migration work; do not bypass this gate.
- Both push-to-develop and manual `gh workflow run build-images.yml --ref develop` use the same deployment job and serialization group. An older run stops if superseded before its hook call. A push after that check may leave a verified frozen older candidate briefly active; its receipt marks `sourceSuperseded=true` and the queued newer workflow follows. Never label older images with a newer source SHA.
- Required repository variables are `STAGING_PREBUILT_DEPLOY=true` and `OPENSHIP_STAGING_HOOK_ID`; required secrets are `OPENSHIP_STAGING_DEPLOY_TOKEN` (a project-scoped staging read/write token), `OPENSHIP_STAGING_DEPLOY_HOOK_TOKEN`, and the existing staging read token for other read-only release checks. Missing activation or credentials fails visibly rather than skipping publication. Never widen the deployment token to production or shared-server access.
- Updating the incoming hook's `actionConfig` or execution authority can rotate its token. Configure the final staging-only service scope first, then privately transfer the current hook credential directly into `OPENSHIP_STAGING_DEPLOY_HOOK_TOKEN`; never print it or include it in logs, reports or artifacts. HTTP 404 can mask a credential or execution-authority mismatch: diagnose and correct this same path, then rerun its failed GitHub deployment job using the existing build artifacts. A full manual publication still uses `build-images.yml` on `develop`.
- A successful deployment requires the hook-returned deployment to be active and ready, the three running image references to match the exact digests, backend `gitSha` to match the source SHA, HTTP 200 checks for API/website and the internal dashboard, unchanged infrastructure containers and unchanged migration metadata. Evidence is saved as the workflow artifact `staging-deployment-<sha>`.
- OpenShip `ready` can precede Docker health readiness. The staging verifier polls application `starting` for at most 20 observations, 15 seconds apart; each observation rechecks the active deployment, exact image refs and unchanged infrastructure. Unhealthy services, invalid identities or digest drift fail immediately. Success requires all six services `running`; a startup timeout fails the workflow.
- OpenShip may leave `commitSha` empty for a fully image-backed deployment. Only this staging path accepts that case: the recorded branch must be the exact immutable candidate SHA, all application digests must match the build artifacts, and live backend health must independently report that SHA. A populated contradictory commit still fails. Never infer production source from this staging exception.
- Docs-only/mobile-only commits can leave server containers on a previous SHA. State that explicitly and verify unchanged server inputs; do not claim the runtime has a newer SHA merely because OpenShip or GitHub reports it. A manual workflow run can publish the current develop SHA through the same path.
- The owner manually accepts the observed staging SHA before production promotion. Production retains its existing host-build runtime and `main` trigger until a separate explicit production migration is approved; this staging change never authorizes switching or deploying it.

The operational procedure is [the sawaa-release skill](../../.claude/skills/sawaa-release/SKILL.md). Changes to this path require a scoped reviewed PR, regression checks and live staging evidence; new instructions cannot silently redefine the mechanism.

## Data and failure boundaries

- Staging and production have separate databases and credentials. Promote code and compatible additive migrations, never staging data into production.
- If a gate fails, stop at that gate and report the evidence. Do not promote automatically just because CI passed.
- A code rollback does not authorize restoring an old production database or losing newer customer data. Assess compatibility and obtain explicit authorization for destructive recovery.
- Keep credentials out of Git, logs and reports.

## Merge checks for `develop` — owner direction, 2026-10-01

Local Woodpecker CI was removed on 2026-10-01 by owner decision. Do not run, reintroduce or require it. GitHub Actions was re-enabled for the repository on 2026-10-01 by the owner. The `merge-gate` workflow runs on pull requests into `develop` and `main` and on pushes to `main`, with two jobs: `gate` and `critical-real-e2e` (the `test:e2e:critical` real-database suite on a disposable Postgres service). CI supplements the local checks below; it does not replace them.

Before a PR merges into `develop`, run the local checks that match the changed surface, using the test matrix in the root `CLAUDE.md` (for example backend Jest specs and `pnpm openapi:sync` for endpoint changes, dashboard Vitest and smoke for dashboard flows, `pnpm --dir apps/mobile test`/`typecheck`/`lint` for mobile). Documentation-only changes need only `git diff --check`. Record the commands, the candidate SHA and the results in the PR. A failed or skipped required check blocks the merge; if the candidate changes after verification, verify the new content before merging.

Checks use local disposable test infrastructure. Never use development, staging or production credentials or databases. Passing checks do not replace live verification of the changed flow or the owner's manual staging test.

The production promotion rules above remain in force.

## Enforcement status

This file records the approved policy. It does not itself configure GitHub protections or OpenShip automation. Verify those settings live before claiming automated enforcement.

The repository release workflow creates code-release tags and GitHub Releases only; it must never write a “latest deployed” commit directly to `main`. The former `.github/DEPLOY_STATE.json` has been retired. A tag is not a deployment record. Record observed deployment evidence separately using [the deployment-record contract](deployments/README.md), and keep [the dated operations summary](current-state.md) current. This local workflow change does not enable GitHub protection, apply itself to remote branches, or authorize deployment. Live enforcement must still be verified independently.
