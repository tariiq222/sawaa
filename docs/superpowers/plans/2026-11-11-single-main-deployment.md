# Single Main Deployment Implementation Plan

> For agentic workers, use superpowers:executing-plans to implement the steps and verify the final diff.

**Goal** — Use one permanent branch with automatic staging and manual production for the exact accepted staging commit.

**Architecture** — Route GitHub events to one deployment target before building. Keep the existing scoped OpenShip hooks and runtime checks. Publish release metadata only from verified production deployment evidence.

**Tech stack** — GitHub Actions, Node.js 22, OpenShip, Bash and launchd.

**Spec** — [Single-main deployment design](../specs/2026-11-11-single-main-deployment-design.md).

## Global constraints

- Work in isolation from the user's current checkout. Use the verified develop tip as the candidate base so the existing production receipt travels with the migration.
- Preserve SHA, digest, migration, backup, rollback and infrastructure gates.
- Apply GitHub and OpenShip settings, merge, publish and delete branches only at the authorized cutover.

## Review focus

- Every GitHub event is classified, including dispatch from a topic branch and an unexpected or missing target.
- Production rejects a mismatched SHA, stale staging evidence and an unapproved original or rerun actor before firing the hook. Bind the acceptance timestamp and deployment ID to the artifact from the successful staging run.
- A head change before the hook restores candidate configuration. A change after launch is recorded alongside the observed deployment.
- GitHub Release and production TestFlight use an explicit, verified production deployment.
- Migration order blocks obsolete production workflow runs while preserving staging rollback.

## 1. Deploy routing and scripts

- [x] Add tests for event selection, exact SHA and actor admission, and supersession before and after the hook. Run `node --test scripts/openship/*.test.mjs` to establish failures for the new contract.
- [x] Update `build-images.yml`, `staging-deploy.mjs` and `production-deploy.mjs` and share one deployment job concurrency group. Bind the selected target and SHA to the built images and to deployment admission. Scope the production authorization to the production environment under a new variable name.
- [x] Run OpenShip tests and validate the workflow matrix including automatic staging, manual staging, authorized manual production, topic-branch dispatch, PR and legacy events.

## 2. Integration and release consumers

- [x] Update Apple target tests to cover explicit staging and production on main, with production rejecting the automatic event.
- [x] Update `apple-testflight.yml` and `scripts/apple-release/` to resolve the target explicitly and verify the matching OpenShip project. Publish GitHub release metadata through the verified production job and retire the legacy release workflow identity and keep the staging path separate.
- [x] Target main in merge-gate, Dependabot and changelog. Run the Apple, tag, deploy-state and workflow checks.

## 3. Procedures and local synchronization

- [x] Update the local sync scripts and hook, and verify that a temporary remote can fast-forward main while preserving local edits or unpublished commits.
- [x] Update project instructions, active deployment and release documentation. Document live configuration, failure recovery and branch-retirement order.
- [x] Verify the integrated diff, run the operational test suites and review the candidate as a whole before any cutover.


## Live cutover

- [ ] Apply the authorized [cutover runbook](../../operations/single-main-cutover.md), observe the first automatic main deployment to staging, and verify the production runtime identity.
- [ ] Retire branches after approved cleanup. Verify manual production separately on an accepted revision.
