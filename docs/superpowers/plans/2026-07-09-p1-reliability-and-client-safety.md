# P1 Reliability and Client-Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the next verified reliability and client-account security gaps while preserving existing public API behaviour and the user’s dirty dashboard work.

**Architecture:** Consolidate metrics into exported singleton providers, make shutdown request accounting idempotent, reclaim retryable webhook/DLR events instead of permanently deduplicating them, and route client self-service changes through the already safer profile policy.

**Tech Stack:** NestJS 11, Prisma 7, Jest, Docker/Compose, GitHub Actions.

## Global Constraints

- Preserve all existing user changes and do not stage or commit.
- No destructive database commands and no edits to existing migrations.
- Any schema change requires a new additive migration and explicit tests.
- Do not change payment semantics without handler tests; retain idempotency for terminal events.
- Keep existing client profile payload compatibility while rejecting administrative-only fields.

---

## Task 1: Share one telemetry registry across all metric producers and the scrape endpoint

**Files:** `apps/backend/src/infrastructure/telemetry/*`, `apps/backend/src/app.module.ts`, `apps/backend/src/api/public/public.module.ts`, `apps/backend/src/modules/ops/ops.module.ts`, `apps/backend/src/modules/finance/finance.module.ts`, relevant specs.

- [ ] Add a failing integration/module-level test showing a metric recorded by the HTTP/audit/DB producer appears in the public scrape output.
- [ ] Replace duplicate direct providers with one exported `TelemetryModule` that owns `AppMetricsService` and `DbMetricsService` singleton instances.
- [ ] Import that module wherever metrics are consumed; remove shadow providers.
- [ ] Run focused telemetry tests and backend typecheck.

## Task 2: Make graceful shutdown count each in-flight request once

**Files:** `apps/backend/src/main.ts`, new focused unit test for extracted shutdown/request tracker if needed.

- [ ] Add a failing test for normal `finish` followed by `close`, proving the counter decrements once and shutdown waits for active work.
- [ ] Extract a small testable tracker or add a once-guarded completion callback; preserve current signal handling and timeout behaviour.
- [ ] Run the focused test and backend typecheck.

## Task 3: Reclaim retryable webhook and SMS DLR reservations safely

**Files:** `apps/backend/src/modules/finance/moyasar-webhook/*`, `apps/backend/src/modules/comms/sms-dlr/*`, plus a new additive migration only if the current schema cannot represent a safe retry claim.

- [ ] Add regression tests for a transient failure followed by a provider retry; terminal processed events must remain idempotent.
- [ ] Implement an atomic claim/reclaim strategy for error or expired-processing reservations; do not allow concurrent duplicate mutation.
- [ ] Run handler tests, Prisma validation, and OpenAPI sync only if an endpoint shape changes.

## Task 4: Restrict mobile client profile changes to client-owned fields

**Files:** `apps/backend/src/api/mobile/client/profile.controller.ts`, identity client-profile handler/specs, mobile controller specs.

- [ ] Add failing tests that reject notes/source/isActive and clear or require verification when email/phone changes.
- [ ] Route mobile updates through the established self-service profile handler instead of the administrative update handler, preserving allowed name/contact/avatar fields.
- [ ] Run focused tests and backend typecheck.

## Task 5: Enforce migration history immutability in CI

**Files:** `.github/workflows/ci.yml`, a repository script/test if needed.

- [ ] Add a base-ref diff gate that rejects edits/deletions beneath `apps/backend/prisma/migrations/` but permits new migration directories.
- [ ] Keep fresh-database migration deployment; add shadow-database drift validation only when CI has the required service configuration.
- [ ] Validate workflow YAML and run the script locally against the current base where possible.

## Task 6: Cross-cutting verification

- [ ] Run affected backend handler/module suites, `prisma validate`, direct typechecks, and `git diff --check`.
- [ ] Compare the changed-file list with the initial dirty dashboard list; report separately.
- [ ] Do not commit, stage, or push.
