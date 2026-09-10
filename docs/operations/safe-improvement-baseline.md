# Safe improvement baseline — 2026-09-05

## Authorization and scope

Implementation was authorized in the execution task, including planned financial corrections and safe local verification. The planning documents retain their original proposal status as historical input; that wording does not withdraw the later execution authorization. No commit, push, merge, deployment, production-data modification, historical manifest application, real charge/refund, or external messaging is authorized by this task.

## Verified source

- Audited and implementation base: `703e944487a55ebadc579e241e50015c913e56d8`.
- Isolated Codex worktree: `/Users/tariq/.codex/worktrees/ecfc/sawaa`, externally managed detached HEAD.
- Source checkout: `/Users/tariq/code/sawaa`, main at the same SHA. Its only initial changes were six untracked planning/spec files; only those documents were copied into this worktree.
- Live `git ls-remote origin refs/heads/main refs/heads/develop`: main = `f6e41f9e619bce976b01af88827f26d2d87e09c1`; no develop ref returned. Seven preceding local commits are explicitly outside this execution diff and require separate integration review. No branch transfer or release approval is implied.
- Published SHA/image digest: **not verified**. Remote Git state is not deployment evidence.
- The August 31 integrity plan already covers invoice locking, deposit/remainder, package idempotency/funding and real-DB fixtures. Existing source/tests will be preserved and strengthened only where the September audit proves a gap.

## Isolated data and outbound

- Created dedicated containers `sawaa-safe-ecfc-postgres` (pgvector/pgvector:pg16) and `sawaa-safe-ecfc-redis` (redis:7-alpine), label `codex.task=ecfc-safe-improvement`.
- Postgres allowed target: `127.0.0.1:35453 / sawaa_safe_test_ecfc`; Redis: `127.0.0.1:35454`.
- Before migrations, SQL `current_database(), current_user` returned `sawaa_safe_test_ecfc, sawaa_test`; Redis returned PONG. These were newly created empty containers, not existing project databases.
- All **95** existing immutable migrations and vector index hooks applied successfully. No production migration or seed was run. Credentials are generated for these containers and stored only in a protected local artifact, never in Git.
- Root dependencies installed with `pnpm install --frozen-lockfile --ignore-scripts`; Prisma client generated (7.8.0); runtime Node 26.7.0, pnpm 10.10.0.
- DB E2E helper mocks Redis/BullMQ and external providers. Its success proves DB behavior only. O1 uses a separate real transport lane and test-scoped names/faults.
- Production backup/restore, customer-data inventory, sandbox verification and published UI proof remain release gates requiring the relevant access; absence does not block independent local corrections.

## Decisions and measurements

- Collection after refund: **pending owner decision**, asked at execution start. Conservative proposal is not approval. Dependent F1 policy wiring waits; independent work continues.
- Financial report date basis: retain current `createdAt`; do not change to processedAt silently.
- Chart amount measure: preserve current representative-payment semantics; do not relabel it net cash.
- Reserved additive migration names (not created/applied yet): `20260905000100_intake_response_history`; `20260905000200_intake_current_unique`. Existing latest migration = `20260831120000_normalize_ai_provider_to_openrouter`.
- Production/customer totals, restore duration, p95, RSS, pool usage and queue lag: **unmeasured**. Synthetic local measurements will be labeled accordingly; production capacity cannot be inferred.

## Evidence

Local protected artifact directory: `/Users/tariq/.codex/visualizations/2026/09/05/01a0716c-25f3-7600-8ef2-1cf624b89a7f/safe-improvement`.

`base-git.txt` records preceding commits, `base-prior-commits.diff` their separate diff, `base-migrations.txt` immutable migration inventory, `b0-migrations.log` migration rehearsal. Current check results and commands are appended to `safe-improvement-release-log.md`; no historical test count is treated as a new result.
