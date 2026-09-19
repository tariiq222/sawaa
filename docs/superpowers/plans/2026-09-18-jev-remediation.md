# Jev audit remediation implementation plan

> **For agentic workers:** use subagent-driven-development; project ownership, native Luna/high routing and no-commit rules override skill defaults.

**Goal:** repair verified audit failures while preserving existing behavior and unrelated work.
**Architecture:** independent isolated worktrees for test gates, mobile contracts, finance/booking safety; dedicated mobile body-token endpoints preserve web cookie security. Coordinator integrates generated contracts and owns final validation.
**Tech Stack:** NestJS11/Prisma7/Postgres, Next15, Expo55/React19.2.0, Jest/Vitest, Node22.
**Spec:** /Users/tariq/.codex/visualizations/2026/09/18/01a0b538-f0ef-75c3-bcf2-ec7d9244d5ca/sawaa-jev-review/report.md and accepted three-stage remediation in user conversation.

## Global Constraints
- Preserve main dirty checkout. Develop a4f5d759 is integration base per deployment policy.
- No commits/push/merge/deploy or destructive DB operations.
- No weakening web cookies/guards, no duplicate financial operations, no existing migration edits.
- Separate worktrees and explicit file ownership; only focused regression diagnostics in workers, central final checks.
- Coordinator owns generated OpenAPI/types and shared dependency state.

### Task 1: Test gates and runtime consistency
- [x] Gate implementation reviewed: preserve develop header-normalization fix; scope Node Blob to the download test and restore jsdom Blob; align renderer to React19.2.0 via a mobile-only workspace/lock; configure SARIF + nonzero security gate. Node22 local/CI pin does not alter Docker runtime.
- [x] Review exact diff against develop, run focused tests and integrated typecheck.

### Task 2: Mobile contract repair
- [x] Execute /tmp/sawaa-jev-fix/mobile-brief.md; real route/method/payload/response fixtures first, current endpoint adapters, preserve schedule exceptions and receipt MIME.
- [x] Add employee-owned GET availability and client-detail endpoints with exact response contracts and relationship checks. Preserve multiple windows, inactive shifts and exceptions on save.
- [x] Review consumers and focused tests; mobile typecheck and full unit final.

### Task 3: Finance/booking consistency
- [x] Execute /tmp/sawaa-jev-fix/finance-brief.md; prove late-paid/cancel interleaving, idempotent compensation through existing RefundRequest/outbox, terminal join rejection and retryable booking-only cascade.
- [x] Review transaction and lock order; isolated real DB tests and Dashboard smoke.
- [ ] External Moyasar Sandbox verification remains unavailable; do not claim release readiness.

### Task 4: Native session repair (separate sequential package)
- [x] Add POST /mobile/auth/refresh body {refreshToken}, response {accessToken,refreshToken}; POST /mobile/auth/logout body {refreshToken}, 204. Reuse token hashing/selector/user lock semantics with atomic rotation/revocation; no userId trust from input; preserve web endpoints.
- [x] Switch mobile refresh/logout to these routes; generation fence prevents late refresh restoring logout/session switch; preserve session on transient network error.
- [x] Tests: body token valid/invalid/reused/inactive user; rotation rollback and logout race; concurrent native401 refresh once; late response after logout ignored; web cookie-only unchanged.

### Integration and acceptance
- [x] Import only task-owned deltas with baseline conflict check.
- [x] Rescore coherent implementation with Jev, inspect weak dimensions, improve where evidenced, compare previousEvaluation unchanged.
- [x] Generate OpenAPI+dashboard types, check API drift, run relevant suites/typecheck and required smoke/real DB; report exact pass/fail/skip and unavailable external gates.
- [x] Final independent Astra review of actual combined diff; leave uncommitted worktree for owner.

## Verification outcome
- Dashboard unit243suites/2041passed. Backend unit7539passed/1environment-failure/1skip; affected31-test suite passed after removing runner PUBLIC_WEBSITE_URL override.
- Critical realDB18suites/172passed/0skip plus native session5passed/0skip. Provider calls mocked.
- Dashboard Playwright41passed/1skip (unseeded disposable conversation). Root8typecheck tasks successful; mobile and regenerated dashboard types pass; backend build, OpenAPI sync,54api-client and168dashboard call drift checks pass. Changed backend ESLint and diff-check pass.
- Independent Astra source review closed findings after corrections.
- Mobile final145passed/0failed; final rerun exits naturally0 in3.5seconds after test mutation timer cleanup;145passed/0failed.
- External release gates are NOT checked off by source completion: Moyasar sandbox unavailable; User/Client native customer identity mismatch remains a separate design issue; no mobile device test, CI security workflow not executed remotely, Docker Node20 unchanged. No commit/push/merge/deploy.
- Final evidence report: /Users/tariq/.codex/visualizations/2026/09/18/01a0b538-f0ef-75c3-bcf2-ec7d9244d5ca/sawaa-jev-remediation/report.md
