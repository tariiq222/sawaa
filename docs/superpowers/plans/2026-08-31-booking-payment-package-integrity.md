# Booking, Payment, Package, and Group Integrity Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Apply `superpowers:test-driven-development` to every behavioral task and `superpowers:verification-before-completion` before advancing a gate.

**Goal:** Make ordinary, package-credit, and group bookings financially safe and operationally consistent, then make package purchases and package-funded bookings unmistakable throughout the dashboard.

**Architecture:** Preserve the existing bounded-context handlers and add narrow transaction guards, immutable purchase snapshots, and a derived `BookingFunding` read model. Keep strict event publication for required consumers while making explicitly optional post-commit events non-fatal. Build dashboard package management as a two-tab hub backed by a paginated purchase endpoint, while retaining contextual balances on the client profile.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, Jest, Next.js 15/React 19, TanStack Query/Table, Vitest, Playwright, Expo SDK 55, pnpm/Turborepo.

**Safety constraints:** Use an isolated worktree after user consent. Never modify an existing Prisma migration. Prove the test database name before any destructive database command. Preserve unrelated working-tree edits. Do not commit, push, merge, deploy, or run a live charge without explicit authorization.

---

## Execution map

The plan is intentionally sequential at the integration points:

1. Event and invoice invariants land before higher-level sale flows.
2. Package snapshots and group consistency land before exposing enriched read models.
3. Backend contracts land before dashboard/mobile consumers.
4. Focused red-green verification runs per task; broad suites run only at phase gates.

## Task 0: Isolate work and capture the baseline

**Files:**

- Copy into worktree: `docs/superpowers/specs/2026-08-31-booking-payment-package-integrity-design.md`
- Copy into worktree: `docs/superpowers/plans/2026-08-31-booking-payment-package-integrity.md`

**Step 1: Create the isolated worktree after consent**

Use `.worktrees/booking-payment-package-integrity` and branch
`codex/booking-payment-package-integrity`. Verify `.worktrees/` remains ignored.

**Step 2: Install/reuse dependencies**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: exit 0 without modifying `pnpm-lock.yaml`.

**Step 3: Prove the baseline**

Run focused suites that cover the current critical surfaces:

```bash
pnpm --filter=backend test -- \
  src/infrastructure/events/event-bus.service.spec.ts \
  src/modules/finance/process-payment/process-payment.handler.spec.ts \
  src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.spec.ts \
  src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.spec.ts \
  src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts \
  src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts
pnpm --filter=dashboard test -- \
  test/unit/features/bookings/booking-column-cells.spec.tsx \
  test/unit/hooks/use-package-purchases.spec.tsx
pnpm --dir apps/mobile test -- --runInBand services/client/__tests__/bookings.test.ts
```

Expected: record all existing failures exactly. If a baseline failure prevents a
red-green cycle, stop and report it before implementation.

## Task 1: Make optional domain events non-fatal without weakening strict events

**Files:**

- Modify: `apps/backend/src/infrastructure/events/event-bus.service.ts`
- Modify: `apps/backend/src/infrastructure/events/event-bus.service.spec.ts`
- Modify: `apps/backend/src/modules/finance/create-invoice/create-invoice.handler.ts`
- Modify: `apps/backend/src/modules/finance/create-invoice/create-invoice.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.ts`
- Modify: `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts`

**Step 1: Write failing tests**

Add tests proving:

- `publish()` still rejects an unregistered required event.
- `publishOptional()` resolves when there are no consumers.
- invoice creation, cancel rejection, and program minimum-reached complete after
  commit with no optional consumer.
- real consumer failures still propagate/log according to the event contract.

**Step 2: Run the failing tests**

```bash
pnpm --filter=backend test -- \
  src/infrastructure/events/event-bus.service.spec.ts \
  src/modules/finance/create-invoice/create-invoice.handler.spec.ts \
  src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.spec.ts \
  src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts
```

Expected: new optional-event assertions fail.

**Step 3: Implement the smallest change**

Add `publishOptional()` as an explicit API; do not change the semantics of
`publish()`. Reclassify only the audited observational events. Required side
effects continue to use strict publish or the existing outbox.

**Step 4: Re-run and verify green**

Run the same command. Expected: all selected tests pass.

## Task 2: Lock invoices and reject payment on non-payable bookings

**Files:**

- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.ts`
- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/collect-booking-payment/collect-booking-payment.handler.ts`
- Modify: `apps/backend/src/modules/finance/collect-booking-payment/collect-booking-payment.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.ts`
- Modify: `apps/backend/src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.spec.ts`
- Test: `apps/backend/test/finance-payment-concurrency.e2e-spec.ts`

**Step 1: Add red tests**

Cover two distinct idempotency keys paying the same remaining balance
concurrently, and payment attempts for `CANCELLED`, `EXPIRED`, `NO_SHOW`, and
refunded bookings.

**Step 2: Prove red**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/process-payment/process-payment.handler.spec.ts \
  src/modules/finance/collect-booking-payment/collect-booking-payment.handler.spec.ts \
  src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.spec.ts
```

Expected: concurrent over-collection/status guard tests fail.

**Step 3: Implement**

- Lock the invoice row with `SELECT ... FOR UPDATE` inside the owning
  transaction before aggregating completed payments.
- Recalculate outstanding under the lock.
- Centralize `assertBookingPayable()` and call it from ensure/init/collect paths.
- Preserve same-key replay behavior.

**Step 4: Verify unit then real-DB concurrency**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/process-payment/process-payment.handler.spec.ts \
  src/modules/finance/collect-booking-payment/collect-booking-payment.handler.spec.ts \
  src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.spec.ts
pnpm --filter=backend run test:e2e -- test/finance-payment-concurrency.e2e-spec.ts
```

Expected: one payment succeeds, one is rejected/replayed, total collected never
exceeds invoice total.

## Task 3: Support deposit remainder and correct bank-transfer amount rules

**Files:**

- Modify: `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.ts`
- Modify: `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.ts`
- Modify: `apps/backend/src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.spec.ts`
- Reuse/modify: `apps/backend/src/modules/finance/deposit.helper.ts`
- Modify: `apps/backend/src/modules/finance/deposit.helper.spec.ts`

**Step 1: Add red tests**

Test online settlement from `DEPOSIT_PAID`, bank-transfer upload for exact deposit,
and bank-transfer upload for exact remaining balance after a deposit. Reject total
invoice amount when it exceeds current outstanding.

**Step 2: Run red tests**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.spec.ts \
  src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.spec.ts \
  src/modules/finance/deposit.helper.spec.ts
```

**Step 3: Implement one shared required-payment calculation**

Allow `DEPOSIT_PAID` in payment initialization, compute `alreadyPaid` and
`outstanding`, and validate uploads against the deposit-or-outstanding rule.

**Step 4: Re-run green tests**

Run the same command. Expected: all pass.

## Task 4: Make client refund requests work across multiple payments

**Files:**

- Modify: `apps/backend/src/modules/finance/refund-payment/request-refund.handler.ts`
- Modify: `apps/backend/src/modules/finance/refund-payment/request-refund.handler.spec.ts`
- Modify if required by the accepted implementation: `apps/backend/prisma/schema/finance.prisma`
- Create if schema changes: `apps/backend/prisma/migrations/<timestamp>_refund_request_batch_support/migration.sql`
- Modify: `apps/backend/src/modules/finance/refund-payment/refund-payment.handler.ts`
- Modify: `apps/backend/src/modules/finance/refund-payment/refund-payment.handler.spec.ts`

**Step 1: Add red tests**

Cover an invoice paid by deposit plus remainder, a completed prior partial refund,
a second valid refund, and aggregate over-refund rejection.

**Step 2: Choose the narrowest representation after inspecting current provider flow**

Prefer multiple child `RefundRequest` rows tied by an optional batch identifier
only if one provider request cannot span payments. Any schema change must be
additive and migration-backed.

**Step 3: Implement transactional allocation**

Allocate the requested refundable total across completed/partially-refunded
payments with remaining balance, under payment row locks. Do not permanently
block a new request because an older request is `COMPLETED`.

**Step 4: Verify**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/refund-payment/request-refund.handler.spec.ts \
  src/modules/finance/refund-payment/refund-payment.handler.spec.ts
```

Expected: multi-payment and repeated-partial scenarios pass with no over-refund.

## Task 5: Make reception package sales atomic and request-idempotent

**Files:**

- Modify: `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.dto.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.spec.ts`
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_package_purchase_idempotency_and_snapshot/migration.sql`
- Modify: `apps/dashboard/lib/types/package-purchase.ts`
- Modify: `apps/dashboard/components/features/clients/sell-package-form.tsx`
- Modify: `apps/dashboard/components/features/bookings/wizard-steps/step-package.tsx`

**Step 1: Add red tests**

Test payment failure rollback, duplicate submission with the same key, and key
reuse with a different payload.

**Step 2: Prove red**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.spec.ts
```

**Step 3: Implement**

- Add request `idempotencyKey` and canonical request fingerprint.
- Keep purchase, immutable item snapshots/credits, invoice, and manual payment in
  one owner transaction by passing the transaction to `ProcessPaymentHandler`.
- Publish deferred payment and optional invoice events only after commit.
- Return a prior matching result on replay; reject mismatched reuse.

**Step 4: Verify backend and dashboard callers**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/package-purchases/create-package-purchase/create-package-purchase.handler.spec.ts
pnpm --filter=dashboard test -- \
  test/unit/lib/package-purchases-api.spec.ts \
  test/unit/hooks/use-package-purchases.spec.tsx
```

## Task 6: Freeze self-purchase item snapshots and eliminate init races

**Files:**

- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Modify: migration created in Task 5 or create a second additive migration
- Modify: `apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.dto.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/activate-package-purchase/activate-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/activate-package-purchase/activate-package-purchase.handler.spec.ts`
- Test: `apps/backend/test/package-purchase-concurrency.e2e-spec.ts`

**Step 1: Add red tests**

Test simultaneous init with the same key, retry with a changed payload, package
definition edits between init and webhook, and duplicate webhook activation.

**Step 2: Prove red**

Run the two focused handler specs. Expected: race/snapshot tests fail.

**Step 3: Implement immutable snapshots and uniqueness**

- Persist per-item service/employee/duration, constraints, quantities, unit price,
  discount inputs, and display names at init.
- Add a unique purchase idempotency key/fingerprint.
- Create/reuse the pending purchase under a transaction-safe unique constraint.
- Activate credits exclusively from purchase snapshots.
- Preserve the in-flight gateway reconciliation guard.

**Step 4: Verify unit and real-DB race**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler.spec.ts \
  src/modules/finance/package-purchases/activate-package-purchase/activate-package-purchase.handler.spec.ts
pnpm --filter=backend run test:e2e -- test/package-purchase-concurrency.e2e-spec.ts
```

## Task 7: Protect package refunds from active future bookings

**Files:**

- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.spec.ts`
- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.dto.ts`
- Modify: `apps/dashboard/components/features/clients/client-package-balances-panel.tsx`
- Modify: dashboard i18n files resolved by existing locale layout

**Step 1: Add red tests**

Test a full refund blocked by a future confirmed package-funded booking, full
refund after explicit cancellation, and partial financial refund retaining
active credits with a warning.

**Step 2: Implement under locks**

Lock the purchase and credits; resolve active linked bookings through credit
usages. Return structured blocking booking IDs. Never silently cancel bookings.

**Step 3: Show actionable dashboard errors**

Display links to blocking bookings and distinguish partial reimbursement from
full package cancellation.

**Step 4: Verify**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.spec.ts
pnpm --filter=dashboard test -- \
  test/unit/features/clients/client-package-balances-panel.spec.tsx
```

## Task 8: Keep program enrollment, booking, seat count, and refund consistent

**Files:**

- Modify: `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.ts`
- Modify: `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/cancel-booking/cancel-booking.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/restore-no-show-booking/restore-no-show-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/restore-no-show-booking/restore-no-show-booking.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/program/program-capacity.service.ts`
- Modify: `apps/backend/src/modules/bookings/program/program-capacity.service.spec.ts`
- Test: `apps/backend/test/program-capacity-concurrency.e2e-spec.ts`

**Step 1: Add red tests**

Cover direct booking refund/cancel for a group enrollment, simultaneous last-seat
enroll/cancel, no-show restore into a full program, and repeated cancellation.

**Step 2: Implement one seat transition service**

Under a program row lock or atomic conditional update, transition enrollment and
seat count exactly once. Route group booking cancellation/refund through it.

**Step 3: Verify**

```bash
pnpm --filter=backend test -- \
  src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts \
  src/modules/bookings/cancel-booking/cancel-booking.handler.spec.ts \
  src/modules/bookings/restore-no-show-booking/restore-no-show-booking.handler.spec.ts \
  src/modules/bookings/program/program-capacity.service.spec.ts
pnpm --filter=backend run test:e2e -- test/program-capacity-concurrency.e2e-spec.ts
```

## Task 9: Unify client booking, cancel, and paid-program contracts

**Files:**

- Modify: `apps/backend/src/modules/bookings/public/create-public-booking.dto.ts`
- Modify: relevant mobile/client DTO under `apps/backend/src/modules/bookings/client/`
- Modify: `apps/backend/src/api/mobile/client/bookings.controller.ts`
- Modify: `apps/backend/src/api/mobile/client/bookings.controller.spec.ts`
- Modify: `packages/api-client/src/modules/bookings.ts`
- Modify: `packages/api-client/src/types/booking.ts`
- Modify: `packages/api-client/src/types/group.ts`
- Modify: `packages/api-client/src/modules/__tests__/dashboard-modules.test.ts`
- Modify: `apps/mobile/services/client/bookings.ts`
- Modify: `apps/mobile/services/client/__tests__/bookings.test.ts`
- Modify: paid program enrollment screen/service resolved by `rg` before edit

**Step 1: Add red contract tests**

Prove `deliveryType` is accepted, client cancel uses `PATCH` and
`ClientCancelBookingHandler`, and paid group enrollment returns `invoiceId` plus
`nextAction: PAY` rather than a success state.

**Step 2: Implement shared response contract**

Return `bookingId`, `status`, `funding`, optional `invoiceId`, and `nextAction`
from create/enroll paths. Update clients without guessing payment state.

**Step 3: Synchronize contracts**

```bash
pnpm openapi:sync
```

Then update the handwritten API client manually.

**Step 4: Verify**

```bash
pnpm --filter=backend test -- src/api/mobile/client/bookings.controller.spec.ts
pnpm --filter=@sawaa/api-client test
pnpm --dir apps/mobile test -- --runInBand services/client/__tests__/bookings.test.ts
pnpm --dir apps/mobile typecheck
```

## Task 10: Add the canonical `BookingFunding` read model

**Files:**

- Modify/create helper near: `apps/backend/src/modules/bookings/booking-row.mapper.ts`
- Modify: `apps/backend/src/modules/bookings/booking-row.mapper.spec.ts`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.dto.ts`
- Modify: `apps/dashboard/lib/types/booking.ts`

**Step 1: Add red mapper/list/detail tests**

Cover package-funded, invoice-funded, pay-at-clinic, free, and legacy historical
bookings. Assert list and detail return the same funding semantics.

**Step 2: Implement batched enrichment**

Resolve package purchase/name/credit/usage and invoice aggregates in bounded
batch queries. Do not introduce per-row queries. Add funding-source filtering.

**Step 3: Synchronize OpenAPI and verify**

```bash
pnpm --filter=backend test -- \
  src/modules/bookings/booking-row.mapper.spec.ts \
  src/modules/bookings/list-bookings/list-bookings.handler.spec.ts \
  src/modules/bookings/get-booking/get-booking.handler.spec.ts
pnpm openapi:sync
pnpm typecheck
```

## Task 11: Add a paginated center-wide package-purchases endpoint

**Files:**

- Create: `apps/backend/src/modules/finance/package-purchases/list-package-purchases/list-package-purchases.dto.ts`
- Create: `apps/backend/src/modules/finance/package-purchases/list-package-purchases/list-package-purchases.handler.ts`
- Create: `apps/backend/src/modules/finance/package-purchases/list-package-purchases/list-package-purchases.handler.spec.ts`
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts`
- Modify: `apps/backend/src/api/dashboard/finance.controller.spec.ts`
- Modify: `apps/backend/src/modules/finance/finance.module.ts`
- Modify: `apps/dashboard/lib/types/package-purchase.ts`
- Modify: `apps/dashboard/lib/api/package-purchases.ts`
- Modify: `apps/dashboard/hooks/use-package-purchases.ts`
- Modify corresponding unit tests.

**Step 1: Add red handler/controller tests**

Cover pagination, search by client/package, status/date filters, balances, payment
source, permission guard, and stable sort.

**Step 2: Implement batched query and response**

Return purchase summary plus `totalQuantity`, `usedQuantity`,
`remainingQuantity`, payment summary, and active-linked-booking count.

**Step 3: Synchronize and verify**

```bash
pnpm --filter=backend test -- \
  src/modules/finance/package-purchases/list-package-purchases/list-package-purchases.handler.spec.ts \
  src/api/dashboard/finance.controller.spec.ts
pnpm openapi:sync
pnpm --filter=dashboard test -- \
  test/unit/lib/package-purchases-api.spec.ts \
  test/unit/hooks/use-package-purchases.spec.tsx
```

## Task 12: Turn `/packages` into a catalog + purchases hub

**Files:**

- Modify: `apps/dashboard/app/(dashboard)/packages/page.tsx`
- Modify: `apps/dashboard/components/features/packages/package-list-page.tsx`
- Create: `apps/dashboard/components/features/packages/package-purchases-tab.tsx`
- Create: `apps/dashboard/components/features/packages/package-purchase-columns.tsx`
- Create: `apps/dashboard/components/features/packages/package-purchase-detail-sheet.tsx`
- Modify: `apps/dashboard/components/sidebar-config.ts`
- Add/modify tests under `apps/dashboard/test/unit/features/packages/`
- Modify Arabic and English message files discovered by `rg`.

**Step 1: Add red component tests**

Test URL-backed tabs, loading/empty/error states, filters, purchase totals,
remaining credits, and opening purchase details.

**Step 2: Implement the hub**

Keep current catalog CRUD under «تعريفات الباقات» and add «مشتريات العملاء».
Use existing table, tabs, sheet, badge, pagination, and design tokens. Keep files
within dashboard size rules by extracting columns/detail components.

**Step 3: Verify unit and route behavior**

```bash
pnpm --filter=dashboard test -- test/unit/features/packages
pnpm --filter=dashboard typecheck
```

## Task 13: Make package-funded bookings obvious in list, detail, and client profile

**Files:**

- Modify: `apps/dashboard/components/features/bookings/booking-columns.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-column-cells.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-detail-sheet.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-details-body.tsx`
- Modify: `apps/dashboard/components/features/clients/client-package-balances-panel.tsx`
- Modify: relevant dashboard i18n files
- Modify/add focused component tests.

**Step 1: Add red UI tests**

Assert that package-funded rows show «من باقة» and «مدفوع مسبقًا», never a lone
zero price; detail shows package/purchase/credit/usage/remaining; invoice-funded
and legacy rows remain correct.

**Step 2: Implement from `BookingFunding` only**

Do not infer from price or duplicate mapping logic. Add a funding-source filter,
links to purchase/client context, and credit usage/return timeline.

**Step 3: Verify**

```bash
pnpm --filter=dashboard test -- \
  test/unit/features/bookings/booking-column-cells.spec.tsx \
  test/unit/features/bookings/booking-details-body.spec.tsx \
  test/unit/features/clients/client-package-balances-panel.spec.tsx
pnpm --filter=dashboard typecheck
```

## Task 14: Build and run the end-to-end matrix

**Files:**

- Modify: `apps/dashboard/e2e/flows/packages/packages-lifecycle.spec.ts`
- Modify/create: `apps/dashboard/e2e/flows/bookings/booking-funding-visibility.spec.ts`
- Modify/create: `apps/dashboard/e2e/flows/payments/payment-concurrency-and-deposit.spec.ts`
- Modify/create: `apps/dashboard/e2e/flows/programs/program-enrollment-payment.spec.ts`
- Modify shared fixtures only where required.

**Step 1: Confirm isolated E2E database**

Print the resolved DB host/name and refuse destructive setup unless the name is
the configured E2E database.

**Step 2: Implement matrix**

Cover catalog creation, package sale, hub/profile visibility, credit booking,
credit return, normal full/deposit/at-clinic payment, paid/free group enrollment,
capacity, cancellation, no-show restore, retries, and no duplicate financial or
seat mutations.

**Step 3: Run focused E2E specs**

```bash
pnpm --filter=dashboard run e2e -- \
  e2e/flows/packages/packages-lifecycle.spec.ts \
  e2e/flows/bookings/booking-funding-visibility.spec.ts \
  e2e/flows/payments/payment-concurrency-and-deposit.spec.ts \
  e2e/flows/programs/program-enrollment-payment.spec.ts
```

Expected: all named scenarios pass with retained traces/screenshots on failure.

## Task 15: Perform visual dashboard QA and full verification gates

**Files:**

- No product edits until failures are classified.
- Store QA artifacts under the existing Playwright output conventions, not in
  tracked source unless explicitly requested.

**Step 1: Visual QA in browser**

Inspect `/packages?tab=definitions`, `/packages?tab=purchases`, a client with
multiple purchases, bookings table filters, package-funded detail, ordinary
invoice detail, empty/error/loading states, desktop, narrow desktop, and mobile
viewport. Verify Arabic RTL and English LTR.

**Step 2: Focused smoke**

```bash
pnpm --filter=backend run test:smoke
pnpm --filter=dashboard run e2e:smoke
```

**Step 3: Full gates**

```bash
pnpm --filter=backend run test
pnpm --filter=backend run test:e2e
pnpm --filter=dashboard test
pnpm --filter=website test
pnpm --dir apps/mobile test -- --runInBand
pnpm --dir apps/mobile typecheck
pnpm openapi:sync
git diff --exit-code -- apps/backend/openapi.json apps/dashboard/lib/types/api.generated.ts || true
pnpm typecheck
pnpm lint
pnpm build
pnpm test
git diff --check
```

Record every pre-existing or environmental failure separately; never collapse a
partial pass into a full completion claim.

**Step 4: Moyasar sandbox gate**

After explicit authorization and current official-document verification, test
successful payment, decline/failure, webhook replay, callback interruption,
deposit remainder, and package purchase activation in sandbox. If credentials or
authorization are unavailable, report this gate as unverified rather than mocked.

**Step 5: Finish without unauthorized Git mutations**

Use `superpowers:finishing-a-development-branch`, present verified status and
integration options, but do not commit/push/merge unless the user explicitly
chooses one.
