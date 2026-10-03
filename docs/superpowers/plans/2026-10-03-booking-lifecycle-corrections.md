# Booking lifecycle corrections implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development with the owner's parallel-lanes instructions. Each assigned lane uses its own worktree; no commits or remote operations are authorized by this implementation task.

**Goal:** Implement the booking rules approved in chat: reception confirmation independent of payment, deposits operationally confirmed, explicit expiry only, refunds independent of appointment cancellation, then configurable immediate client cancellation with honest refund notifications.

**Architecture:** Preserve persisted BookingStatus values and historical rows. Correct existing transition consumers and selectors, then extend client cancellation through effective settings and a server-owned policy result. Financial execution remains independently tracked and asynchronous.

**Tech Stack:** NestJS, Prisma, Next.js dashboard/website, Expo mobile, pnpm, Jest/Vitest.

**Spec:** Chat-approved lifecycle diagrams and `../specs/2026-10-03-client-cancellation-refund-policy-design.md`. Owner explicitly requested implementation after the design-only detour; do not restart approval of already settled lifecycle rules.

## Global Constraints

- No live database access, data copy, migration execution, provider calls, deployment, commit, push, merge or destructive cleanup.
- Preserve all current status codes and existing booking/payment/invoice rows. No mass state conversion or backfill.
- Never change authentication guards, DEFAULT_ORG_ID, encryption AAD, PLATFORM_SETTINGS_KEY or VAT rules.
- Workers are not alone: own only assigned paths, preserve others' work, do not spawn children. Run explicitly scoped regression tests only; parent runs integrated checks once at end.
- Read applicable CLAUDE.md. Mobile commands use `pnpm --dir apps/mobile`, website package is `@sawaa/website`.
- All lanes start at 029f01d1e724d8fadaec0ecae5ea2dd126a9fec3; its tree equals staging candidate 6d47f75e72376d368a5884b88d5633f9fb0cb2a6. Integration target is the existing release-auth-fixes worktree.

## Review Focus

- A deposit-paid appointment can check in, complete, no-show and reschedule; self-loop actions retain its persisted status and financial balance.
- No null-deadline legacy booking is expired, including direct handler and stale cron races.
- Partial or full refund alone must not cancel an appointment, release its capacity, return package credits, or delete its Zoom meeting.
- No lifecycle correction rewrites historical rows, confirms money as paid, or converts an old cancellation request automatically.
- Refund/provider failure and duplicated callbacks must not reverse a completed cancellation or duplicate money/credit effects.

### Task 1: Deposit as operational confirmation

**Target:** `/Users/tariq/.codex/worktrees/booking-deposit-confirmed/sawaa`.
**Ownership:** booking-state-machine.ts and its tests; check-in/complete/no-show/reschedule/client-reschedule handlers and focused tests; dashboard/website/mobile action selectors and labels that gate these same operations. Do not edit cron-tasks, expire-booking, refund-completed-handler, client-cancel-booking or settings files.
**Contract:** Same BookingStatus values and endpoint payloads. DEPOSIT_PAID behaves as confirmed for attendance, fulfillment and rescheduling, but does not assert full payment. CHECK_IN and RESCHEDULE preserve DEPOSIT_PAID; COMPLETE -> COMPLETED; NO_SHOW -> NO_SHOW. EXPIRE rejects DEPOSIT_PAID.

- [x] Add regression expectations before code, including:
  ```ts
  expect(assertTransition(BookingStatus.DEPOSIT_PAID, 'CHECK_IN')).toBe(BookingStatus.DEPOSIT_PAID);
  expect(assertTransition(BookingStatus.DEPOSIT_PAID, 'RESCHEDULE')).toBe(BookingStatus.DEPOSIT_PAID);
  expect(assertTransition(BookingStatus.DEPOSIT_PAID, 'COMPLETE')).toBe(BookingStatus.COMPLETED);
  expect(() => assertTransition(BookingStatus.DEPOSIT_PAID, 'EXPIRE')).toThrow();
  ```
- [x] Run focused tests red, implement minimal guards/labels, run focused tests green. Keep financial fields unchanged and terminal restrictions intact.
- [x] Review consumers of the changed transitions for duplicated CONFIRMED-only gates, including reschedule/Zoom permission eligibility; report any file outside ownership to parent.
- [x] Record exact changed files, tests and exit codes in lane report. Return uncommitted patch to integration, including new tests.

### Task 2: Explicit expiry and deposit automation

**Target:** `/Users/tariq/.codex/worktrees/booking-expiry-safe/sawaa`.
**Ownership:** apps/backend/src/modules/ops/cron-tasks booking-expiry/booking-autocomplete/booking-noshow and shared cron-tasks.service plus their tests; apps/backend/src/modules/bookings/expire-booking/**. Do not edit booking-state-machine.ts or other task paths.
**Contract:** Expiry requires non-historical PENDING/AWAITING_PAYMENT with an explicit past expiresAt at mutation time. Deposit-confirmed appointments are eligible for existing attendance-aware auto-completion/no-show timing; do not invent new grace periods.

- [x] Add failing behavior tests for old createdAt + expiresAt=null remaining unchanged; future deadline and historic record unchanged; explicit elapsed deadline expires; DEPOSIT_PAID unchanged.
- [x] Test stale cron selection when deadline is extended/status changes before execute. Preserve atomic mutation and existing audit events.
- [x] Remove createdAt-based fallback and enforce eligibility in handler, including atomic expiry deadline predicate. Add DEPOSIT_PAID to completion/no-show selection while preserving checkedInAt and suppression guards.
- [x] Run only the owned focused Jest specs red/green. Task 1 supplies transition acceptance after integration; record this dependency if a full handler run needs it.

### Task 3: Refund does not cancel appointment

**Target:** `/Users/tariq/.codex/worktrees/booking-refund-separate/sawaa`.
**Ownership:** apps/backend/src/modules/bookings/refund-completed-handler/** and booking-side registration/Zoom refund-event consumers as strictly needed. Do not change finance/refund-payment or provider implementation, cancellation handlers, state machine or cron files.
**Contract:** finance.refund.completed is a financial outcome, not an appointment cancellation command. No full/partial refund triggers booking mutation/capacity/credit/Zoom cleanup. Explicit booking cancellation events must retain their existing cleanup.

- [x] Add failing tests using partial and full refund events on active/terminal bookings, asserting no lifecycle mutations or booking cancellation event; confirm explicit cancellation cleanup still executes.
- [x] Remove the implied appointment cancellation consumer behavior and refund-only Zoom cleanup. Prefer clear removal of unused wiring over a misleading no-op class; preserve version compatibility and idempotency in remaining consumers.
- [x] Run the specific refund/Zoom registration specs only. Report integration concerns without changing other lane files.

### Task 4: Integrate, then cancellation settings and client outcome

**Owner:** coordinator, or next bounded delegates after these lanes complete.
**Dependency:** Tasks 1–3 reviewed and integrated by file-scoped patch. Integration order: deposit -> expiry -> refund.

- [x] Review every patch for scope/spec compliance and apply with `git apply --check` then `git apply`; no Git commits/merges are needed.
- [x] Implement effective configurable cancellation cutoff separately from refund-window timing, independent early/late percentages, and automatic/review execution per the spec. Preserve existing numeric values; no production activation or backfill.
- [x] Implement a server-derived cancellation preview/result, direct eligible cancellation and durable financial follow-up; update settings, web/mobile presentation and notification copy. New API contracts require OpenAPI sync and handwritten API-client updates together.
- [x] Add focused cases for zero cutoff, deadline boundaries, deposit/paid/unpaid/multiple payments, receipt of payment during preview, repeated cancellation, manual vs automatic refund outcomes, provider failure and old CANCEL_REQUESTED preservation.
- [x] Run integrated backend tests, relevant web/dashboard/mobile checks, dashboard smoke and disposable database acceptance. Use only isolated local infrastructure. If provider sandbox credentials are unavailable, finish local work and identify sandbox acceptance as an explicit remaining gate; never borrow production credentials.
- [x] Independent final review of actual integrated diff; resolve important findings before reporting completion.

## Progress

Implementation starts with the approved lifecycle corrections; cancellation settings are the dependent next batch, not a substitute for those corrections. No previous lifecycle source changes existed when this plan was created.

## Integrated validation record (2026-10-03, local candidate)

All changes are in the release-auth-fixes integration worktree, uncommitted. No production/staging database, remote migration, or deployment was used. The additive settings migration was applied only to disposable local PostgreSQL databases.

- Backend affected scope: 36 suites / 556 tests passed. Follow-up aggregate entitlement/expiry tests: 36 passed; later refund outcome producer/consumer tests: 66 passed; final denial transaction wrapper: 3 passed. Counts overlap and must not be summed.
- Dashboard components: 106 passed; website components: 35 passed; mobile components/hooks: 170 passed; handwritten API-client contract: 11 passed.
- Real SQL/HTTP: 20 lifecycle/cancellation cases passed, plus a later denial → durable event → one client notification replay case. The latter was rerun after the required transaction-wrapper correction and passed. Providers are mocked in this lane.
- Existing dashboard browser smoke: 42 passed against candidate dashboard5219/backend5218.
- Backend build and backend/dashboard/website/mobile/API-client types passed. Changed source lint passed after corrections; one preexisting unused Avatar import warning remains in AppointmentCard.tsx.
- OpenAPI snapshot and dashboard types regenerated from explicit localhost5218; API-client manifest66 calls and dashboard171 calls verified; OpenAPI coverage299 routes,0 new gaps. Translation parity, legacy-scaffolding guard and git diff checks passed.
- Independent source review identified and verified corrections for cross-capture aggregate refund limits and later denial/failure/review notification producers. No remaining actionable P1/P2 in the bounded review.

TesterArmy frontend acceptance is assigned to native GPT-6 Luna high at the owner's request. The browser and isolated iOS simulator journeys are recorded separately in the local SDD evidence directory; component tests are not claimed as complete browser/device acceptance.

Release gates: Moyasar sandbox execution, external SMS/push delivery, physical-device acceptance, owner staging acceptance, and production rollout remain separate. Existing NO_SHOW payment collection restrictions were not expanded. Old binaries with refund-triggered cancellation must be fully retired during any future authorized rollout.

Browser acceptance follow-up: native Luna used TesterArmy e2e0.16.0/web0.11.2 against the actual local API. Verified manual-cash preview35SAR → immediate cancellation → pending review → same-request staff manual settlement → client persisted COMPLETED35SAR while booking remains CANCELLED. Unpaid cancellation and390×844 preview passed. Reception confirmed-unpaid check-in preserved no-payment; deposit check-in+completion preserved100paid/200remaining. Browser testing found a repeated check-in dropdown action after attendance; StatusCell now hides it, two new regression cases failed before correction,30 focused tests passed afterward, final dashboard types passed, and Luna confirmed the actual menu/complete journey. Native simulator acceptance still in progress.

Web/dashboard QA complete: stale quote requires explicit reconfirmation, attendance blocks client cancellation, late zero-refund cancellation succeeds, deposit rescheduling retains financial state, and BEFORE_CHECK_IN/automatic-refund settings save and restore correctly. Final successful runner JSON reports were inspected by the coordinator. Detailed matrix: `.superpowers/sdd/2026-10-03-booking-lifecycle-corrections/e2e-qa/luna-e2e-report.md`; consolidated acceptance: `../reports/2026-10-03-booking-lifecycle-local-acceptance.md`. Native iOS has installed/launched on the dedicated simulator and remains under test.

Final native acceptance: Luna completed login, deposit balance, paid/unpaid cancellation, persisted outcomes, attendance restriction, in-app notifications and stale-quote reconfirmation through the interactive agent-device engine. TesterArmy native runner setup/UI attempts are recorded separately and are not a passing native suite. A redundant English global alert was corrected in the cancellation hook, with two failing regression cases before the fix,49 focused hook/detail tests passing after it, types/lint passing, and an actual simulator retest proving the Arabic-only message and second confirmation. The disposable mobile branch policy was restored35 after each scenario. No further local implementation work remains; provider/physical-device/staging/production gates above remain separate.
