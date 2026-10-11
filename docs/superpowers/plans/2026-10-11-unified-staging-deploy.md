# Unified staging deployment implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and one independent final review. The owner's 2026-10-11 execution instruction approves the existing design in `/Users/tariq/.codex/reports/sawaa-deployment-audit-20261011.md`.

**Goal:** Make the existing GitHub build → scoped OpenShip hook → verified staging deployment the only staging publication path.

**Architecture:** GitHub retains the current image build matrix, exports SHA/digest artifacts, and runs one staging orchestrator after every required build succeeds. The orchestrator refuses other branches/projects, checks migration compatibility read-only, temporarily pins the staging source ref to the full candidate SHA, pins application image digests, invokes the existing hook scoped to three application services, verifies all image identities and backend SHA, and proves infrastructure containers unchanged. The derived prebuilt compose starts backend directly, without executing migrations.

**Tech Stack:** Node 22, GitHub Actions, existing OpenShip APIs, GHCR, PostgreSQL read-only migration metadata.

**Spec:** Owner-approved deployment audit above, with the added absolute scope: staging only; no production configuration/release and no migration/seed/customer-data changes.

## Global constraints

- Only `develop` and project `proj_7M0RNj59nQnafh1m` can deploy; production write access is denied by the automation token.
- Target only backend/dashboard/website. Preserve postgres/redis/minio container IDs and mounts.
- Run no live database migration, seed, cleanup, booking or payment test. Stop if migration names/checksums do not match the deployed schema.
- Publish reviewed task branch through a merge-commit PR, then synchronize local develop. Preserve unrelated untracked skills and the other worktree.
- Existing task branches and main must be ancestors of the final develop revision; do not delete them.

## Review focus

- Missing activation variables or secrets fail visibly, rather than skipping a deployment job.
- Partial matrix builds never change runtime references or invoke the hook.
- Manual redeploy uses exactly the same orchestrator; a superseded SHA stops before the hook; image configuration is restored if superseded during preparation. The hook snapshots an immutable source; a concurrent later push is reported without mixing revisions.
- Unexpected service IDs, production targets, mutable refs or pending/modified migrations fail closed.
- Verification rejects mixed/stale application digests and any replaced infrastructure container.

### Task 1: Safe staging contract and orchestration

**Files:** `scripts/openship/staging-deploy.mjs`, `scripts/openship/staging-deploy.test.mjs`, `scripts/openship/prebuilt-compose.mjs`, `scripts/openship/prebuilt-compose.test.mjs`, generated `docker/openship/compose.prebuilt.yml`.

**Interfaces:** Input: full source SHA and three image build artifacts `{service, sha, digest, environment}`. APIs: project/services/containers, scoped incoming hook, temporary staging source-ref selection, PATCH project env, backend exec for a read-only migration query. Output: sanitized exact-source deployment receipt, image refs, preserved infrastructure identities and migration fingerprint.

- [x] Add failing regression checks for stale refs, wrong project, hook broad scope, migration drift, changed infra and generated backend startup command.
- [x] Run `node --test scripts/openship/*.test.mjs` and observe intended failures.
- [x] Implement the contract/orchestrator and regenerate prebuilt compose. Re-run the complete focused suite.

### Task 2: Workflow and permanent instructions

**Files:** `.github/workflows/build-images.yml`, `.github/workflows/merge-gate.yml`, `AGENTS.md`, `CLAUDE.md`, `.claude/skills/sawaa-release/SKILL.md`, `docs/operations/deployment-policy.md`, `docs/operations/current-state.md`.

**Interfaces:** Build jobs publish digest artifacts; deploy job downloads them and calls Task 1 once. Missing activation causes an explicit failure; push/manual develop executions share the same job. Production retains its existing runtime until separately authorized.

- [x] Wire digest artifacts and the new orchestrator, removing the old bare curl path and silent activation skip.
- [x] Make CI execute the complete OpenShip regression suite; document one canonical staging path and frozen-release production boundary.
- [x] Run focused tests and workflow parse checks; run `pnpm test:premerge` on the exact candidate if the changed surface requires it.

### Task 3: Review, live setup and authorized staging publication

**Responsibility:** Coordinator, scoped OpenShip staging configuration and GitHub secrets/variable only.

- [x] Independent Sol 6.1 review of the actual diff; resolve material findings with regression tests.
- [x] Capture baseline infrastructure/production identities and read-only migration state. Scope the existing hook, prepare direct backend startup, mint a staging-only API token and save it directly into GitHub secret input without displaying it.
- [x] Commit/push task branch, open/attach PR, wait for required checks and merge with a merge commit. Run `scripts/sync-develop.sh` and confirm equality.
- [ ] Observe GitHub build/deploy success, verify public read-only discovery/UI and exact image digests; rerun the same workflow for the same SHA and verify again.

### Task 4: Evidence and branch acceptance

**Files:** dated staging receipt/current-state update and private evidence outside Git.

- [x] Record live source/deployment IDs, HTTP checks, digest identities, unchanged infrastructure/production containers, migration metadata and branch ancestor results.
- [ ] Land documentation evidence through a merge-commit PR into develop, synchronize and verify its source/server-input relationship with the accepted runtime. No deployment for docs-only updates.
- [ ] Report automated evidence and any remaining owner/device/provider acceptance limits.

## Live verification correction

The first scoped image deployment became ready, but the workflow verifier rejected OpenShip’s intentionally absent commit metadata for fully image-backed snapshots. Add a staging-only null-metadata regression, retain exact frozen ref/digest/live-health SHA proof and production’s existing commit binding. Correct the historical website image override without a container action. Publish the correction and dated initial evidence in one reviewed PR, then prove green automatic and unchanged-source manual publication. Final workflow receipts remain the authoritative successful-publication evidence.
