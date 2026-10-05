# Sawaa deployment policy — approved 2026-09-11

This is the shared deployment policy for every AI tool and contributor working on Sawaa. It supersedes older project deployment instructions. Higher-priority platform instructions still apply.

## Meaning of the owner's commands

- **«انشر» / «ننشر» / «انشر على الاستيج»** authorizes scoped commits, pushing the task branch, a PR and merge into `develop`, and deployment to OpenShip staging after the required checks. Stop there and provide the staging URL, tested revision, change summary, and manual test steps. It never authorizes a merge into `main` or production deployment.
- **«انشر للبرودكشن» / «انشر للإنتاج» / «اعتمد وانشر للإنتاج»** authorizes the release PR from `develop` to `main` and production deployment only after confirming the owner's manual staging test and the exact tested release content, plus successful required checks. Do not ask again for actions already covered by this command.
- Approval of this policy alone does not request a deployment. A request to implement a fix alone does not authorize committing, pushing or deploying it.

## Normal path

### Local and remote branches — owner-approved 2026-10-04

- `develop` is the primary local branch. Keep temporary task branches as needed; a local `main` branch is not required and may be removed after verifying its commits are preserved. Keep remote `main` as the production branch.
- Integrate task branches through PRs into remote `develop`, then synchronize local `develop` from `origin/develop` with a fast-forward while preserving uncommitted work.
- Validate the resulting revision on staging and obtain the owner's manual acceptance before promotion.
- Promote the accepted release through a PR from remote `develop` to remote `main` only after explicit production authorization, then deploy and verify production under the rules below.
- Approval of this workflow does not itself execute branch cleanup, commit, push, merge, or deployment.

1. Start a task branch (Codex default: `codex/<task>`) from current `develop`; use an isolated worktree when needed to keep concurrent work separate. Preserve unrelated work.
2. Implement and verify the scoped change. Use PRs; never push directly to `main`, force-push protected branches or bypass required checks.
3. On a staging publication command, merge the reviewed task into `develop`, deploy staging and verify that the intended revision actually runs. Automated tests do not replace the owner's manual staging test.
4. Record the staging revision and manual acceptance. If additional changes enter the release candidate, stop promotion until those changes are tested and accepted too. Never silently include unrelated/unaccepted changes from `develop`.
5. Only on an explicit production command, verify the accepted content matches the `develop` → `main` release PR, check backup readiness and migration compatibility, merge and deploy production. Prevent concurrent updates from changing the candidate during promotion; recheck if either branch moves.
6. Verify the deployed revision and affected flows, then record release/deployment identifiers, evidence and the prior working version. A merge, tag or green CI alone is not proof of successful deployment.
7. Preserve history between the long-lived branches; synchronize `main` back into `develop` through a PR when needed. Do not rewrite/reimplement the change in reverse. Use a merge strategy that preserves their ancestry; do not squash the long-lived branch promotion.

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
