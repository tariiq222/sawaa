# Production prebuilt publication plan

> Execute inline with superpowers:executing-plans; final review uses a fresh GPT-6.1 Sol reviewer.

**Goal:** Promote the owner's accepted Sawaa application content through the same digest-pinned GitHub image publication mechanism as staging.

**Approved design:** Extend the existing application-only OpenShip workflow to the production project, preserving PostgreSQL, Redis and MinIO. Production requires an explicit accepted staging SHA, a frozen release branch, a successful current backup/restore receipt, unchanged migrations after the separately authorized additive migration, exact main/release tree identity, successful CI and observed runtime verification.

**Acceptance already received:** Owner approved the mechanism, production promotion and migration `20261011090000_add_invoice_receipt_fields` after backup/restore validation. Initial staging SHA: `4d7a69780f6bc1bd5f7ad0e9ae345e73a9cece23`, deployment `dep_s5ixwAMnoMoeZ0nA`. Tooling changes must deploy to staging first; any replacement candidate requires the exact-SHA owner acceptance gate before production.

**Scope:** `.github/workflows/build-images.yml`, `scripts/openship/production-deploy.mjs`, its regression tests, the Apple release verifier for production prebuilt identity, deployment documentation and mirrored AGENTS/CLAUDE instructions. No application behavior or existing migration edits.

## Constraints and review focus

- Production project is exactly `proj_tsxe0sAW3u2AMSGO`, branch `main`, prebuilt compose, git auto-deploy disabled.
- Staging credentials never authorize production; use production-scoped credentials and an application-only incoming hook.
- A source change before the hook blocks deployment and compensates image references. An unknown hook result stops without retrying.
- Production image-backed metadata must be verified through a frozen SHA ref, exact application digests and independent live backend SHA. Infrastructure identity and migration metadata stay unchanged.
- The image workflow must fail on missing approval, backup, activation or credentials; main tree must equal the accepted release tree. Never infer manual acceptance from CI.
- Backup and migration tests must preserve old table data; no production booking/payment test writes or notification replays.

## Task 1: Production orchestrator and regression coverage

- [ ] Write tests with a controlled HTTP boundary for accepted-source/tree identity, backup freshness, production-only image manifests, exact hook scope, migration gates, compensation, failed/unknown trigger, health and infrastructure preservation. Run `node --test scripts/openship/production-deploy.test.mjs` and observe missing behavior fail.
- [ ] Add a production orchestrator based on the existing staging flow; preserve the independent staging implementation and scope guards. Add production-specific admission checks before mutation. Run `node --test scripts/openship/*.test.mjs` and compare every rejection and mutation assertion.
- [ ] Extend the existing Apple deployment verifier to recognize production image-backed identity only with prebuilt project settings, frozen source, canonical digests and independent health. Add and run the matching regression tests.

## Task 2: Workflow and operating contract

- [ ] Add the `deploy-production` job after all image builds, with production-scoped secrets, approval/release variables and a verified backup receipt. Preserve the existing develop-only job.
- [ ] Update deployment policy, release skill and mirrored project instructions with the explicitly approved production path. Explain one-release authorization and migration separation.
- [ ] Run `node --test scripts/openship/*.test.mjs scripts/apple-release/*.test.mjs`, prebuilt compose parity and `git diff --check`; review the whole actual diff with a fresh Sol reviewer. Use the root checkout for hook-backed pushes if dependencies are absent in the worktree.
- [ ] PR to develop, wait for `gate` and `critical-real-e2e` and image dry run, merge with a merge commit, run `scripts/sync-develop.sh`, verify develop mirror, and verify the fixed staging workflow. Obtain exact replacement-SHA acceptance before production.

## Task 3: Production backup, migration and activation

- [ ] Capture rollback SHA/deployment and immutable runtime/config identities. Take protected full PostgreSQL/globals, Redis and MinIO backups with checksums and compare restore row counts in a network-none disposable PostgreSQL container.
- [ ] Apply the new immutable migration to the restored database using `prisma migrate deploy`, compare original-column row signatures and verify the 120 expected migrations. Apply the same authorized migration to production only after this evidence passes; keep application deployment migration-free.
- [ ] Configure production prebuilt compose, disable git auto-deploy, preserve existing data images/mounts, and configure a strict three-application hook. Privately transfer scoped credentials to GitHub secrets; request action-time authorization if UI security permission grants require it.
- [ ] Create frozen `release/2026-10-11` from the owner-accepted ready staging SHA; set accepted SHA, release ref and backup receipt. Open release-to-main PR, require successful head checks, merge without rewriting ancestry.

## Task 4: Observed production acceptance and reconciliation

- [ ] Verify the GitHub build and scoped hook deployment, all six services running, exact application digests and live backend SHA, public website/dashboard/API/files 200, unchanged data containers and migration metadata, no backend startup errors and preserved data.
- [ ] PR main back into develop, pass checks, merge with a merge commit, sync local develop. Record observed deployment/backup/restore/rollback evidence through the repository receipt tooling and a documentation PR. Preserve unrelated changes throughout.
- [ ] Report concrete production evidence. Then inspect mobile current configuration and latest store/TestFlight state without assuming permission to submit or publish a mobile release.
