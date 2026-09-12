# Packages Phase 1 Hardening Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Project instructions override skill defaults: independent owned packages run together, workers do not commit or run broad validation, coordinator reviews and validates.

**Goal:** Close the two real-Postgres failures found at 6f05f757 and prove the repaired package flow locally.

**Architecture:** Preserve checkedInAt as attendance only; use an additive nullable Booking.autoNoShowSuppressedAt marker for restored bookings. Serialize package purchase state decisions across all affected credit lifecycle helpers using the purchase row lock before credit/usage mutation. Require the full package real-e2e files in CI.

**Tech Stack:** NestJS 11, Prisma 7, Postgres, Jest, Next.js 15, Playwright.

**Spec:** /Users/tariq/.codex/visualizations/2026/09/12/01a095f2-e198-7f23-9fe7-b6cc2d79977f/sawaa-packages-audit/audit.md and diagnostic fixtures beside it.

## Global Constraints

- Worktree: /Users/tariq/code/sawaa/.worktrees/packages-phase-1-hardening; base 6f05f757eabf91914a92f1c21acfd8ef4282ce5f.
- No commit, push, merge, deployment, branch deletion, or unrelated edits.
- No auth/CASL/provider changes. Immutable migrations remain unchanged.
- Only coordinator runs generation, migrations, builds, lint, suites and browser QA. Existing red evidence is diagnostic.json and race.json in the spec directory.
- Workers are not alone; preserve all other edits and do not spawn more agents.
- Keep current reserve/consume/refund/no-expiry policies. Do not implement phases 2-4 here.
- Database contract: Booking.autoNoShowSuppressedAt DateTime?; migration 20260912190000_add_booking_auto_no_show_suppressed_at adds TIMESTAMP(3) nullable. Coordinator owns schema, migration, generated outputs.
- Test contract: existing session-packages.real-e2e-spec.ts and reserve-consume-lifecycle.real-e2e-spec.ts remain; new package-credit-concurrency.real-e2e-spec.ts contains purchase state concurrency tests.

### Task 1: Repair attendance and purchase-state lifecycle (Luna high)

**Owned files:** backend bookings restore-no-show, reschedule, check-in/complete as required; package-credit-consume.helper.ts, package-credit-return.helper.ts and a focused purchase-lock helper; relevant finance/bookings call sites only where required for lock consistency; ops cron no-show/autocomplete and corresponding unit tests; test/e2e/packages lifecycle/concurrency fixtures. Excludes schema/migrations/package.json/CI.

**Interfaces:** consumes the additive marker above and existing handler commands. Produces correct attendance, correct ACTIVE/COMPLETED/REFUNDED state, and the named concurrency spec for Task 2.

- [x] Port audit cases into permanent real-DB tests: restore then real check-in; repeated no-show/restore; restored unattended booking excluded from autocomplete; restored attended booking eligible for autocomplete; reschedule resets suppression. Unit coverage verifies the no-show cron's suppression query. Add bounded, deterministic refund/consume, independent-credit consume/cancel, and simultaneous final-consumption cases.
- [x] Restore preserves existing checkedInAt, sets autoNoShowSuppressedAt to now and noShowAt null. Cron no-show excludes marked bookings; explicit reschedule clears suppression. Update misleading lifecycle comments and unit expectations.
- [x] Add a shared purchase row lock before mutations. Read mutable usage/status and siblings after the lock. Apply purchase-before-credit locking to consume, return, reclaim, credit booking and transfer. Derive purchase completion under lock, never overwrite REFUNDED. The existing refund path already locks the purchase.
- [x] Preserve idempotency, booked/used counter meaning and existing CHECK constraints; verify competing operations with real Postgres transactions.
- [x] Workers report changed paths and requested coordinator checks; coordinator performs all validation.

### Task 2: Make package checks mandatory (Luna high; independent edits)

**Owned files:** apps/backend/package.json and .github/workflows/ci.yml only.

**Interfaces:** consumes the three package test filenames above; both the Jest explicit path list and --required assertion list must include them. The existing audit-trail and cancel-path files stay required.

- [x] Add session-packages.real-e2e-spec.ts, reserve-consume-lifecycle.real-e2e-spec.ts and package-credit-concurrency.real-e2e-spec.ts to both lists in test:e2e:critical.
- [x] Extend pull_request base branch filters to feature/packages-phase-* so stacked package PRs receive CI. Keep push triggers on main/develop and all existing checks.
- [x] Report exact changed paths; subsequent explicitly assigned unit mock repairs are recorded separately in the SDD ledger.

### Task 3: Integrate and verify locally (coordinator)

- [x] Add the agreed nullable marker and immutable new migration; generate Prisma after dependencies are installed.
- [x] Coordinator (Astra) reviews actual integrated diffs and lock callers. A separate reviewer could not be started because the runtime agent thread limit was reached; no independent-review approval is claimed.
- [x] Apply all 101 migrations to two isolated local DBs. Execute the permanent audit regressions and full critical-real lane (170/170, including 37 package tests, zero skips); full backend suite (7,495 passed, one unrelated legacy-import test skipped); forced root typecheck (8/8, zero cached); OpenAPI sync; changed-source lint and migration immutability checks.
- [x] Run a local backend on 5210 and a built dashboard on 5213 with separate seeded DB and isolated Redis. Use local fake/test provider configuration.
- [x] Run dashboard smoke (42/42, zero skips) and exercise credit booking, check-in, no-show/restore, completion and outstanding balance through the browser, checking persisted counters. Revalidate observed failures and the final integrated patch.
- [x] Save final evidence and report limitations; leave work uncommitted for review.

## Verification record — 2026-09-12

Evidence: `/Users/tariq/.codex/visualizations/2026/09/12/01a095f2-e198-7f23-9fe7-b6cc2d79977f/sawaa-packages-audit/local-hardening-report.md`.

Backend and dashboard builds passed. Critical-real guard rejects missing database configuration and reports containing skipped required tests. The one skipped full-unit test is `legacy-import.writer.spec.ts`, which requires a separate legacy-schema database; it is unrelated to packages. Mobile, real external payment/provider transactions, remote CI execution, and deployment are outside this local result. The new migration does not reinterpret historical attendance timestamps; previously restored bookings need a data audit before release.
