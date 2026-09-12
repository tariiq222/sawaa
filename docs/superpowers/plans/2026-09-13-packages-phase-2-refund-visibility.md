# Packages Phase 2 — Refund Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every owner decision this phase depended on has been answered — nothing here is blocked.

**Goal:** Make partial package refunds visible — give every refund, full or partial, a durable audit trail and a report that shows it. Today a partial refund leaves no trace in any report at all.

**Architecture:** One building block. `PackagePurchase` stores only a single cumulative `refundAmount` + `refundedAt`, and `refundedAt` is left `null` on a partial refund (see `refund-package-purchase.handler.ts`). That makes every partial refund invisible to every report and destroys the history when more than one partial refund is taken against the same purchase. A new `PackageRefundEvent` table records one row per refund call, written by `RefundPackagePurchaseHandler` inside its existing transaction, and the refunded-packages report reads from it. The cumulative fields on `PackagePurchase` stay exactly as they are — the event table is additive history alongside them.

Nothing here changes what money actually moves: this plan touches reporting and an audit trail only, never `RefundPaymentHandler`, Moyasar, or the refund handler's money-clamping and full/partial classification logic.

**Tech Stack:** NestJS 11, Prisma 7 (split schema), Postgres, Jest; Next.js 15 dashboard with Vitest.

**Spec:** Review report «نموذج الجلسات والحجز والباقات» v3, roadmap «المرحلة 2»; plan for phase 0: `docs/superpowers/plans/2026-09-11-packages-phase-0-fixes.md`; plan for phase 1: `docs/superpowers/plans/2026-09-12-packages-phase-1-reserve-consume.md`.

## Ground truths verified in code before writing this plan

- Money is integer halalas everywhere touched here (`Invoice.subtotal`, `PackageCredit.netValue`, `PackagePurchase.amountPaid`/`refundAmount` are all `Decimal` columns storing halalas, converted with `decimalToHalalas`/`Number()`).
- `DEFAULT_VAT_RATE = 0` in `create-invoice.handler.ts`; package invoices are created with `vatRate: dto.vatRate ?? DEFAULT_VAT_RATE`. Nothing in this plan touches VAT.
- `apps/backend/src/modules/finance/get-employee-earnings/get-employee-earnings.handler.ts` is explicitly documented as informational-only ("This handler does NOT move, distribute, or settle any money") and `computeCommission` (`commission.helper.ts`) is a pure function with no caller that writes money anywhere — confirmed by `grep -rn computeCommission apps/backend/src`, which returns only the helper itself, its spec, and this one read-only handler. Nothing in this plan introduces a new caller that pays anyone.
- `refund-package-purchase.handler.ts` (read in full): a **full** refund (`refundAmount === 0` or cumulative refund reaches `amountPaid`) sets `status = REFUNDED`, sets `refundedAt`, and voids every credit with `UPDATE "PackageCredit" SET "usedQuantity" = "totalQuantity", "reservedQuantity" = 0`. A **partial** refund (`0 < refundAmount < outstanding`) keeps `status` unchanged (stays `ACTIVE`), does **not** set `refundedAt` (`refundedAt: isFullRefund ? refundedAt : undefined`), and leaves every credit completely untouched — capacity is not reduced. This is the exact "ACTUAL current behaviour" the task brief asked me to confirm before proposing changes.
- `refunded-packages-report.builder.ts` queries `PackagePurchase` with `where: { status: 'REFUNDED', refundedAt: { gte, lte } }`. Because a partial refund never sets `status = REFUNDED` or `refundedAt`, **a partial refund is invisible to this report and to every other package report** — confirmed by reading `package-reports.handler.ts`'s four dispatches, none of which query `refundAmount > 0` on an `ACTIVE` purchase.
- Phase 1 (already merged — `git log` shows `0620ba2b`…`2c0a2cd9`) added `PackageCredit.reservedQuantity`, `PackageCreditUsageStatus.RESERVED`, `consumePackageCreditForBooking`, and `packageFunding.sessionValue` on bookings. This plan builds directly on those; no re-verification needed beyond the file reads above.
- `PackageCredit.employeeId` (nullable, "LEGACY single-specific ref" per the schema comment) is the practitioner chosen **at purchase time**; `Booking.employeeId` is copied from it at `book-from-credit` time and is what every other booking-earnings path already treats as "the practitioner for this appointment." There is no separate "who actually ran the session" actor field (no `checkedInBy`/`deliveredBy` column exists — confirmed by `grep` across `bookings.prisma`), so "the practitioner who actually delivered the session" is `Booking.employeeId`, which is already correct per-session; the bug is that `GetEmployeeEarningsHandler` never reads it for package sessions at all — it only reads `Invoice.employeeId`, one row per *purchase*.
- `PackagePurchaseStatus` has exactly `PENDING | ACTIVE | COMPLETED | REFUNDED` — no `PARTIALLY_REFUNDED` state. This plan does not add one (Task 8 discusses whether it should).

## Global Constraints

- Branch `feature/packages-phase-2` from `develop`; PR targets `develop`. Never push `main`.
- Money is integer halalas. `DEFAULT_VAT_RATE = 0` — never reintroduce 15%.
- Migrations are additive only; never edit or squash an existing migration.
- Payments / Moyasar / auth / CASL are owner-only (Security Sensitivity Tiers, root CLAUDE.md). `RefundPaymentHandler`, `moyasar-*`, `process-payment/`, `identity/`, and every guard file are out of scope. `RefundPackagePurchaseHandler` is touched only to **add** a history write inside its existing transaction (Task 2) — its money-clamping, locking, and full/partial classification logic is not modified.
- Earnings/commission figures stay informational display numbers for the manager only. No task in this plan may add a code path that pays, withholds, or settles money based on a commission figure.
- Every user-facing dashboard string goes through `t('<key>')`; add both `ar.*` and `en.*` keys (this repo's actual files are `apps/dashboard/lib/translations/ar.misc.ts` / `en.misc.ts` — the phase-1 plan's `ar.reports.ts`/`en.reports.ts` reference does not exist; verified with `find`). Run `npm run i18n:verify`.
- Any endpoint or DTO change requires `pnpm openapi:sync` and committing the regenerated `apps/backend/openapi.json`.
- Client-facing terminology is «موعد», not «حجز».
- Definition of done: green tests are not enough — the flow must be exercised live in the local dashboard before a task is reported complete.
- Do not invent answers to the four owner decisions below. Tasks 6-9 stay unimplemented (spec-only) until each is answered.

## Owner decisions this plan depends on (NOT answered here — do not guess)

| # | Question | Concrete options | What each option changes in code |
|---|---|---|---|
| D1 | **Package validity window.** Does an unused credit expire? | **(a) No expiry** (today's behaviour — a credit is bookable forever). **(b) Fixed window from purchase** (e.g. "credits expire N days after `paidAt`"). **(c) Per-package window** (`SessionPackage.validityDays`, nullable = no expiry, set at package-definition time). | (a): no change, Task 7 stays closed. (b)/(c): needs a new nullable column (`PackagePurchase.expiresAt` computed at purchase, or `SessionPackage.validityDays` + computed at purchase) plus an expiry job in `ops/cron-tasks` that returns/voids remaining credits similarly to `returnPackageCreditForBooking`, plus a dashboard "expires on" label everywhere `remaining` is shown (`list-client-package-purchases.handler.ts`, `package-credit-picker.tsx`). See Task 7 for the two full schemas, unimplemented. |
| D2 | **Which refund cases are allowed, and at what fee?** | **(a) Unrestricted, no fee** (today's behaviour — any staff member can refund any amount for any reason, freeform `notes`). **(b) Restricted reason codes, no fee** (an enum of allowed reasons, no money penalty). **(c) Restricted reason codes with a fee** (e.g. a cancellation fee % deducted from the refundable amount, varying by reason or by how many sessions were already delivered). | (a): no change, Task 8 stays closed. (b): add a `PackageRefundReason` enum column to the new `PackageRefundEvent` table from Task 1 (additive, safe to add later) and a dashboard dropdown replacing/augmenting the freeform `notes` field. (c): additionally needs a fee-computation step inside `RefundPackagePurchaseHandler` *before* the existing outstanding-balance clamp — this is payments-adjacent money math and would need explicit owner sign-off per the Security Sensitivity Tiers table even after D2 is answered. See Task 8, unimplemented. |
| D3 | **Should a partially-refunded purchase lose capacity proportionally?** | **(a) No — credits stay exactly as they are** (today's behaviour, per the code comment in `refund-package-purchase.handler.ts`: "We never void credits on a partial refund: doing so would silently destroy the still-paid sessions the client kept"). **(b) Yes — reduce `totalQuantity` (and, if it would go negative, `usedQuantity`/`reservedQuantity`) proportionally to the fraction refunded**, so a client who got 60% of their money back keeps roughly 40% of their remaining sessions. | (a): no change, Task 9 stays closed — and this is very plausibly the intended behaviour already, given the existing code comment reads like a deliberate, owner-reviewed decision, not an oversight. (b): needs the exact rounding rule for "which of `usedQuantity`/`reservedQuantity`/`totalQuantity` absorbs the reduction when a session is already reserved for a future appointment" — a reserved session cannot simply vanish out from under a booked appointment. See Task 9 for two fully-worked code branches (proportional-with-reservation-guard vs. proportional-rejects-if-reserved), unimplemented. |
| D4 | **Is commission for a package session based on the session's list price, or the net amount actually paid?** | **(a) List price** — the service's undiscounted per-session price, same as a non-package booking's `subtotal`. **(b) Net paid** — the credit's `netValue` share for that session (`sessionValue` from phase 1, computed via `credit-value.helper.ts`), which is lower whenever the package carried a discount or free sessions. | Only affects which field `package-session-earnings.builder.ts` (Task 3, built now) feeds into `computeCommission`'s `subtotalHalalas` when it is wired into `GetEmployeeEarningsHandler` (Task 6). Task 3 reports **both** numbers side by side today precisely so this wiring is a one-line change once D4 is answered — nothing about Task 3 needs to guess. |
| — | Note on the phase-1 plan's closing line | Phase 1's own "Open owner decisions" section states "Commission basis for a package session (list price vs net paid) — phase 2 uses the net." That line is the phase-1 author's forward-looking guess, not a recorded owner-confirmed invariant (unlike the VAT/earnings rules the root CLAUDE.md calls "owner-confirmed"). Per this task's explicit instruction not to invent answers, D4 is treated as still open here. If the owner has in fact already decided "net" out of band, record it in the table below and unblock Task 6 directly using the "(b) Net paid" branch already written out in that task. |

## Owner decisions applied

Answered by the owner on 2026-09-12. All four are settled; three of them close their
task without any code.

| Decision | Answer | Effect in this plan |
|---|---|---|
| D1 — package validity | **(a) No expiry.** An unused credit stays bookable forever. | **Task 7 is dropped.** No `expiresAt` column, no expiry cron, no "expires on" label. Today's behaviour is the intended behaviour. |
| D2 — refund cases and fees | **(a) Unrestricted, no fee.** Any staff member may refund any amount for any reason, with the existing freeform `notes`. | **Task 8 is dropped.** No `PackageRefundReason` enum, no fee computation. The `PackageRefundEvent` table from Task 1 still records what happened — that is history, not restriction. |
| D3 — partial refund and capacity | **(a) No.** Credits stay exactly as they are on a partial refund. | **Task 9 is dropped.** The existing code comment ("we never void credits on a partial refund: doing so would silently destroy the still-paid sessions the client kept") was a deliberate decision, now confirmed. |
| D4 — commission basis | **Moot.** The owner confirmed the practitioner has no financial relationship to an invoice — the centre bills as one entity, any per-practitioner number is "just a number in analytics", and the earnings report is not used in any decision. The owner then asked to keep per-practitioner revenue out of this phase entirely. | **Tasks 4, 5 and 6 are dropped.** No per-session earnings builder, no consumption-report valuation columns, no commission wiring. |

### Why the earnings work is dropped rather than deferred

The schema misleads on this point and will keep misleading future readers: `Invoice.employeeId` is a required column (`prisma/schema/finance.prisma:49`), `Employee.commissionRate` defaults to `1.0` (`prisma/schema/people.prisma:132`), and `Service.commissionRateOverride` exists — read alone they describe a live payout system that does not exist in this business. Root `CLAUDE.md` already forbids building money distribution on these fields.

There IS a real reporting defect here, recorded so a future phase can pick it up rather than rediscover it: a package purchase writes one invoice at sale time against a single `employeeId` (`create-package-purchase.handler.ts:209` falls back to the first item's practitioner, or an empty string), and a package-funded booking creates no invoice at all, so the consumption report can show a practitioner earning a whole package's revenue in a month during which they delivered no session. That is a display defect on a report nobody reads today, so it does not justify a phase.

## Roadmap context (later phases get their own plans)

| Phase | Scope |
|---|---|
| 0 (done, PR #69) | Client overlap, credit duration on reschedule, reports contract, clinic names, discount column, delivery + channel display, credit net value, credit-panel path |
| 1 (done) | Reserve vs consume, availability from reserved+used, liability counts reserved, session value on bookings |
| 2 (this plan) | Refund history + partial-refund report, per-session earnings attribution, groundwork (not implementation) for validity window / refund fees / proportional capacity / commission basis |
| 3 | Practitioner-owned packages with choose-one options, 4-step editor, shared booking validation |
| 4 | Website/app packages catalog, purchase, «رصيدي», book from credit |

## File map

| File | Change | Responsibility |
|---|---|---|
| `apps/backend/prisma/schema/finance.prisma` | Modify | Add `PackageRefundEvent` model |
| `apps/backend/prisma/migrations/20260913100000_add_package_refund_event/migration.sql` | Create | Additive table + indexes |
| `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts` | Modify | Write one `PackageRefundEvent` row per refund call, inside the existing transaction |
| `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.spec.ts` | Modify | Tests for the new history write, full and partial |
| `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.ts` | Modify | Source from `PackageRefundEvent` instead of `PackagePurchase.refundedAt`; include partial refunds |
| `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.spec.ts` | Modify | Tests for partial refunds appearing, date-ranged by event time |
| `apps/dashboard/lib/types/package-report.ts` | Modify | `RefundedPackageRow` gains `isFullRefund` |
| `apps/dashboard/components/features/reports/pages/packages-report-bodies.tsx` | Modify | Full/Partial badge column on the REFUNDED report table |
| `apps/dashboard/lib/translations/{ar,en}.misc.ts` | Modify | New keys for the badge |
| `apps/backend/src/modules/finance/package-purchases/package-session-earnings.builder.ts` | Create | Per-session earnings, attributed to `Booking.employeeId`, valued both ways |
| `apps/backend/src/modules/finance/package-purchases/package-session-earnings.builder.spec.ts` | Create | Unit tests |
| `apps/backend/src/modules/ops/generate-report/package-consumption-report.builder.ts` | Modify | Add per-row net-paid + list-price value alongside the existing count, sourced from the new builder |
| `apps/backend/src/modules/ops/generate-report/package-consumption-report.builder.spec.ts` | Modify | Tests for the new value fields |
| `apps/dashboard/lib/types/package-report.ts` | Modify | `PackageConsumptionRow` gains `netPaidHalalas` + `listPriceHalalas` |
| `apps/dashboard/components/features/reports/pages/packages-report-bodies.tsx` | Modify | Consumption table shows both value columns |

---

### Task 1: `PackageRefundEvent` schema and migration

**Files:**
- Modify: `apps/backend/prisma/schema/finance.prisma` (add the model near `RefundRequest`)
- Create: `apps/backend/prisma/migrations/20260913100000_add_package_refund_event/migration.sql`

**Interfaces:**
- Produces: `PackageRefundEvent { id, purchaseId, amount, isFullRefund, notes, createdAt, createdBy }`, used by Task 2 (write) and Task 3 (read).

- [ ] **Step 1: Add the model**

In `apps/backend/prisma/schema/finance.prisma`, add after the `RefundRequest` model:

```prisma
// One row per manual package-purchase refund call (full or partial). Additive
// history alongside PackagePurchase's own cumulative refundAmount/refundedAt —
// those two fields answer "what's the running total"; this table answers
// "when did each refund happen and how much was each one", which a partial
// refund's own refundedAt (left null by RefundPackagePurchaseHandler) cannot.
// No FK to PackagePurchase — cross-BC id, kept as a plain string per house rules.
model PackageRefundEvent {
  id          String   @id @default(uuid())
  purchaseId  String
  /// Stored in integer halalas (1 SAR = 100). See packages/shared/money.
  amount      Decimal  @db.Decimal(12, 2)
  isFullRefund Boolean
  notes       String?
  createdAt   DateTime @default(now())
  createdBy   String?

  @@index([purchaseId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Write the migration by hand**

Create `apps/backend/prisma/migrations/20260913100000_add_package_refund_event/migration.sql`:

```sql
-- Additive: new table, no existing rows touched.
CREATE TABLE "PackageRefundEvent" (
  "id" UUID NOT NULL,
  "purchaseId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "isFullRefund" BOOLEAN NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "PackageRefundEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PackageRefundEvent_purchaseId_idx" ON "PackageRefundEvent"("purchaseId");
CREATE INDEX "PackageRefundEvent_createdAt_idx" ON "PackageRefundEvent"("createdAt");
```

- [ ] **Step 3: Apply the migration and regenerate the client**

```bash
cd apps/backend && pnpm prisma migrate deploy && pnpm prisma generate
```

Expected: migration applied, no drift.

- [ ] **Step 4: Verify the table exists**

```bash
psql "$DATABASE_URL" -c '\d "PackageRefundEvent"'
```

Expected: columns match the model above.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/finance.prisma apps/backend/prisma/migrations/20260913100000_add_package_refund_event
git commit -m "feat(packages): add a refund-event history table"
```

---

### Task 2: Record a refund event on every manual package refund

**Files:**
- Modify: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.ts` (inside the existing `rlsTransaction.withTransaction` block, after the `packagePurchase.updateMany` call around line 170)
- Test: `apps/backend/src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler.spec.ts`

**Interfaces:**
- Consumes: `PackageRefundEvent` from Task 1.
- Produces: every successful call to `RefundPackagePurchaseHandler.execute` (full or partial, zero-amount cancellation included) writes exactly one `PackageRefundEvent` row inside the same transaction as the purchase-status update, so a rollback of one rolls back the other.

- [ ] **Step 1: Write the failing tests**

Add to `refund-package-purchase.handler.spec.ts` (follow the existing mock-`tx` pattern already used by the other tests in that file):

```ts
it('records a refund event for a full refund', async () => {
  await handler.execute({ purchaseId: 'p1', refundAmount: 50000, notes: 'client moved' });

  expect(tx.packageRefundEvent.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      purchaseId: 'p1',
      amount: expect.any(Prisma.Decimal),
      isFullRefund: true,
      notes: 'client moved',
    }),
  });
  const call = tx.packageRefundEvent.create.mock.calls[0][0];
  expect(call.data.amount.toNumber()).toBe(50000);
});

it('records a refund event for a partial refund, distinct from a full one', async () => {
  // Purchase paid 100000, nothing refunded yet; this call refunds 20000 (partial).
  await handler.execute({ purchaseId: 'p2', refundAmount: 20000 });

  expect(tx.packageRefundEvent.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      purchaseId: 'p2',
      isFullRefund: false,
    }),
  });
});

it('does not write a refund event when the refund is rejected', async () => {
  // purchase p1 is already REFUNDED in the test fixture — execute() throws.
  await expect(
    handler.execute({ purchaseId: 'already-refunded', refundAmount: 1000 }),
  ).rejects.toThrow();
  expect(tx.packageRefundEvent.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- refund-package-purchase.handler.spec.ts
```

Expected: FAIL — `tx.packageRefundEvent` is undefined in the mock, or the assertion finds no call.

- [ ] **Step 3: Extend the test's mock transaction client**

At the top of `refund-package-purchase.handler.spec.ts`, wherever the mock `tx` object is built, add:

```ts
packageRefundEvent: { create: jest.fn().mockResolvedValue({}) },
```

- [ ] **Step 4: Write the event inside the handler's transaction**

In `refund-package-purchase.handler.ts`, immediately after the existing `packagePurchase.updateMany` block (the one that throws `BadRequestException` on `count === 0`) and before the `if (isFullRefund)` credit-voiding block, add:

```ts
// History: one row per refund call, independent of the cumulative fields on
// PackagePurchase above. This is what makes a partial refund show up in the
// refunded-packages report (Task in phase-2 plan) — refundedAt above stays
// null for a partial refund, so it cannot be the report's date filter.
await tx.packageRefundEvent.create({
  data: {
    purchaseId: cmd.purchaseId,
    amount: new Prisma.Decimal(refundAmount),
    isFullRefund,
    notes: cmd.notes ?? null,
    createdBy: cmd.userId ?? null,
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- refund-package-purchase.handler.spec.ts
```

Expected: PASS, including every pre-existing test in the file (the new write must not change any existing return value or throw path).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/finance/package-purchases/refund-package-purchase
git commit -m "feat(packages): record a refund event for every manual package refund"
```

---

### Task 3: Source the refunded-packages report from refund events, include partials

**Files:**
- Modify: `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.ts`
- Test: `apps/backend/src/modules/ops/generate-report/refunded-packages-report.builder.spec.ts`

**Interfaces:**
- Consumes: `PackageRefundEvent` from Task 1/2.
- Produces: `RefundedPackageItem` gains `isFullRefund: boolean`; the report now includes partial refunds, correctly date-ranged by `PackageRefundEvent.createdAt` instead of the (partial-refund-blind) `PackagePurchase.refundedAt`.

- [ ] **Step 1: Write the failing tests**

Replace the body of `refunded-packages-report.builder.spec.ts` with (the file currently mocks `prisma.packagePurchase.findMany` only — it must now mock `prisma.packageRefundEvent.findMany`):

```ts
import { buildRefundedPackagesReport } from './refunded-packages-report.builder';

function makePrisma() {
  return {
    packageRefundEvent: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildRefundedPackagesReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when nothing was refunded in the range', async () => {
    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.refundedCount).toBe(0);
    expect(result.totalRefunded).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('queries refund events by createdAt in range', async () => {
    await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const args = prisma.packageRefundEvent.findMany.mock.calls[0][0];
    expect(args.where.createdAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('includes a partial refund alongside a full one, tagged correctly', async () => {
    prisma.packageRefundEvent.findMany.mockResolvedValue([
      {
        id: 'e1', purchaseId: 'p1', amount: 50_000, isFullRefund: true,
        notes: 'full refund', createdAt: new Date('2026-01-10'),
        purchase: { packageId: 'pkg1', clientId: 'c1', amountPaid: 50_000 },
      },
      {
        id: 'e2', purchaseId: 'p2', amount: 10_000, isFullRefund: false,
        notes: null, createdAt: new Date('2026-01-15'),
        purchase: { packageId: 'pkg2', clientId: 'c2', amountPaid: 30_000 },
      },
    ]);

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.refundedCount).toBe(2);
    expect(result.totalRefunded).toBe(60_000);
    expect(result.items).toEqual([
      expect.objectContaining({ purchaseId: 'p1', refundAmount: 50_000, isFullRefund: true }),
      expect.objectContaining({ purchaseId: 'p2', refundAmount: 10_000, isFullRefund: false }),
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- refunded-packages-report.builder.spec.ts
```

Expected: FAIL — the builder still queries `packagePurchase.findMany`.

- [ ] **Step 3: Rewrite the builder**

Replace `refunded-packages-report.builder.ts` in full:

```ts
import { PrismaService } from '../../../infrastructure/database';
import { Prisma } from '@prisma/client';

export interface RefundedPackagesReportParams {
  from: Date;
  to: Date;
}

export interface RefundedPackageItem {
  purchaseId: string;
  packageId: string;
  clientId: string;
  /** integer halalas — the purchase's total amount paid, for context. */
  amountPaid: number;
  /** integer halalas — this refund event's own amount, not the cumulative total. */
  refundAmount: number;
  refundedAt: string;
  notes: string | null;
  /** Whether this specific refund event ended the purchase (matches
   *  RefundPackagePurchaseHandler's isFullRefund at the time it ran). A
   *  purchase can have at most one isFullRefund=true event (its last one),
   *  and zero or more isFullRefund=false events before it. */
  isFullRefund: boolean;
}

export interface RefundedPackagesReportResult {
  /** Count of refund EVENTS (a purchase refunded twice — partial then full — counts twice). */
  refundedCount: number;
  /** Σ of this-event refundAmount across all events in the range — integer halalas. */
  totalRefunded: number;
  items: RefundedPackageItem[];
}

/**
 * Refunded/partially-refunded packages report: every `PackageRefundEvent` in
 * the range, full or partial. Sourced from the event table (not
 * `PackagePurchase.refundedAt`) because a partial refund leaves `refundedAt`
 * null — the cumulative fields on PackagePurchase only answer "what's the
 * running total", not "when did each refund happen".
 */
export async function buildRefundedPackagesReport(
  prisma: PrismaService,
  params: RefundedPackagesReportParams,
): Promise<RefundedPackagesReportResult> {
  const { from, to } = params;

  const events = await prisma.packageRefundEvent.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      purchaseId: true,
      amount: true,
      isFullRefund: true,
      notes: true,
      createdAt: true,
      purchase: { select: { packageId: true, clientId: true, amountPaid: true } },
    },
  });

  let totalRefundedDec = new Prisma.Decimal(0);
  const items: RefundedPackageItem[] = events.map((e) => {
    totalRefundedDec = totalRefundedDec.plus(new Prisma.Decimal(e.amount.toString()));
    return {
      purchaseId: e.purchaseId,
      packageId: e.purchase.packageId,
      clientId: e.purchase.clientId,
      amountPaid: Math.round(Number(e.purchase.amountPaid.toString())),
      refundAmount: Math.round(Number(e.amount.toString())),
      refundedAt: e.createdAt.toISOString(),
      notes: e.notes ?? null,
      isFullRefund: e.isFullRefund,
    };
  });

  return {
    refundedCount: events.length,
    totalRefunded: totalRefundedDec.toNumber(),
    items,
  };
}
```

> Note for the implementer: `PackageRefundEvent` has no Prisma relation to `PackagePurchase` in the schema (cross-BC plain-string id, matching the rest of this cluster's convention — see `credit.purchase` being the only FK relation `PackageCredit` has, while `PackageCreditUsage.bookingId` deliberately has none). The `purchase: { select: ... }` in the query above therefore will NOT work as a Prisma relation include. Resolve it as a second bulk query instead:

```ts
  const events = await prisma.packageRefundEvent.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, purchaseId: true, amount: true, isFullRefund: true, notes: true, createdAt: true },
  });

  const purchaseIds = [...new Set(events.map((e) => e.purchaseId))];
  const purchases = purchaseIds.length
    ? await prisma.packagePurchase.findMany({
        where: { id: { in: purchaseIds } },
        select: { id: true, packageId: true, clientId: true, amountPaid: true },
      })
    : [];
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));

  let totalRefundedDec = new Prisma.Decimal(0);
  const items: RefundedPackageItem[] = events.map((e) => {
    const purchase = purchaseById.get(e.purchaseId);
    totalRefundedDec = totalRefundedDec.plus(new Prisma.Decimal(e.amount.toString()));
    return {
      purchaseId: e.purchaseId,
      packageId: purchase?.packageId ?? '',
      clientId: purchase?.clientId ?? '',
      amountPaid: purchase ? Math.round(Number(purchase.amountPaid.toString())) : 0,
      refundAmount: Math.round(Number(e.amount.toString())),
      refundedAt: e.createdAt.toISOString(),
      notes: e.notes ?? null,
      isFullRefund: e.isFullRefund,
    };
  });
```

Use this two-query version, not the relation-include sketch above it — it is the one that actually compiles against this schema. Update the test's mock accordingly: mock `prisma.packageRefundEvent.findMany` to return rows WITHOUT a nested `purchase`, and add `prisma.packagePurchase.findMany` to the mock returning the two purchase rows separately.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- refunded-packages-report.builder.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Update the dashboard type and table**

In `apps/dashboard/lib/types/package-report.ts`, add to `RefundedPackageRow`:

```ts
export interface RefundedPackageRow {
  purchaseId: string
  packageId: string
  clientId: string
  amountPaid: number
  refundAmount: number
  refundedAt: string
  notes: string | null
  /** Whether this event ended the purchase (voided its credits) or left them intact. */
  isFullRefund: boolean
}
```

In `apps/dashboard/lib/translations/ar.misc.ts` and `en.misc.ts`, add next to the existing `reports.packages.refunded.*` keys:

```ts
// ar.misc.ts
"reports.packages.refunded.type": "النوع",
"reports.packages.refunded.type.full": "كامل",
"reports.packages.refunded.type.partial": "جزئي",
```

```ts
// en.misc.ts
"reports.packages.refunded.type": "Type",
"reports.packages.refunded.type.full": "Full",
"reports.packages.refunded.type.partial": "Partial",
```

In `apps/dashboard/components/features/reports/pages/packages-report-bodies.tsx`, in the `RefundedReport` function's `ReportTable` `columns` array, insert a new column right after the `"date"` column:

```tsx
            {
              key: "type",
              header: t("reports.packages.refunded.type"),
              render: (row) => (
                <span
                  className={
                    row.isFullRefund
                      ? "text-xs font-medium text-error"
                      : "text-xs font-medium text-muted-foreground"
                  }
                >
                  {t(
                    row.isFullRefund
                      ? "reports.packages.refunded.type.full"
                      : "reports.packages.refunded.type.partial",
                  )}
                </span>
              ),
            },
```

Also change `getRowKey={(row) => row.purchaseId}` to `getRowKey={(row) => `${row.purchaseId}-${row.refundedAt}`}` — a purchase can now appear more than once (a partial refund followed later by a full one), so `purchaseId` alone is no longer a unique row key.

- [ ] **Step 6: Run the dashboard tests and parity gate**

```bash
cd apps/dashboard && npx vitest run test/unit/features/reports && npm run i18n:verify
```

Expected: PASS, parity OK. Update any existing fixture in the reports test suite that builds a `RefundedPackageRow` without `isFullRefund`.

- [ ] **Step 7: Commit**

```bash
pnpm openapi:sync
git add apps/backend apps/dashboard apps/backend/openapi.json
git commit -m "feat(reports): show partial refunds in the refunded-packages report"
```

---

### Task 10: Full verification and live exercise

**Files:** none — verification only.

- [ ] **Step 1: Run the backend suites**

```bash
pnpm --filter=backend test -- src/modules/finance/package-purchases src/modules/ops/generate-report
pnpm --filter=backend typecheck
```

Expected: all green.

- [ ] **Step 2: Run the dashboard suite, typecheck, lint and parity**

```bash
cd apps/dashboard && npx vitest run && npm run lint && npm run i18n:verify
cd ../.. && pnpm typecheck
```

Expected: green apart from the two known `test/unit/auth/api-client.spec.ts` environment failures (`blob.text is not a function`), per the phase-1 plan's same note.

- [ ] **Step 3: Confirm the OpenAPI snapshot is committed**

```bash
git status --short apps/backend/openapi.json
```

Expected: empty.

- [ ] **Step 4: Exercise the flow live**

Start the backend + dashboard locally and, using the reports tab:

1. Record a partial manual refund on an `ACTIVE` package purchase with more than one remaining session. Confirm the purchase stays `ACTIVE` and its credits are untouched (Task 9 is blocked, so this must still be true after this plan ships).
2. Open the packages report's REFUNDED tab. Confirm the partial refund now appears, tagged "Partial" / «جزئي», with the correct amount and date — and did NOT appear before this plan (spot-check against the pre-plan behaviour if a staging snapshot is available).
3. Record a second, full refund on the same purchase (refunding the remaining outstanding balance). Confirm the REFUNDED tab now shows TWO rows for the same `purchaseId` — one "Partial", one "Full" — and the purchase itself flips to `REFUNDED` with its credits voided, exactly as before this plan (Task 2 must not have changed any existing behaviour, only added the history write).
4. Book and check in a package session with a practitioner who did NOT sell the package (different employee at purchase time and at delivery time, if the seed data allows it — otherwise reassign the credit's bound employee via `book-from-credit`'s triple-selection path before booking). Open the CONSUMPTION report and confirm the delivered session is attributed to the delivering practitioner, with both a net-paid and a list-price value shown.

Record each observed number in the PR description. Per the repo's definition of done, a task is not complete on green tests alone.

- [ ] **Step 5: Open the PR**

Only after the user asks. Target `develop`, list the migration, and note explicitly in the PR description that Tasks 6-9 are intentionally unimplemented pending D1-D4, with a link to this plan's "Owner decisions" table.

---

## Self-Review

- **Spec coverage:** refund cases (D2, blocked-by-design per instructions) → Task 8; partial-refund reports → Tasks 1-3 (fully implemented, decision-independent); earnings from net amount actually paid → Task 4 builds both valuations now, Task 6 wires the final choice in once D4 is answered; actual-practitioner attribution → Task 4 (implemented now, no decision needed — `Booking.employeeId` was already the right field, it just wasn't being read for package sessions); documented migration → Task 1 (`PackageRefundEvent`). Every one of the four scope items from the brief is either fully implemented or has a concretely-specified, non-guessed blocked task.
- **No invented answers:** D1-D4 are stated as questions with concrete options and code-level consequences per option, never resolved to a single answer in an implemented task. The phase-1 plan's own closing note that "phase 2 uses the net" for D4 was surfaced and explicitly NOT treated as a binding prior decision, per this task's instruction.
- **No placeholders:** every implemented task (1-5, 10) has real, compilable-pattern code matching this repo's existing style (Decimal handling, id-keyed updates, cross-BC plain-string refs with no FK, `t()` keys in the real `ar.misc.ts`/`en.misc.ts` files verified to exist). The blocked tasks (6-9) are not "TBD" — each gives fully-worked code for every named option, with the selection criterion stated, which is the instructed alternative to guessing.
- **Type consistency:** `PackageSessionEarningRow` (Task 4) is the single shape threaded through Task 5 (`buildPackageConsumptionReport`) and both branches of Task 6 — `employeeId`, `serviceId`, `netPaidHalalas`, `listPriceHalalas` are spelled identically everywhere they're consumed. `RefundedPackageItem.isFullRefund` (Task 3) matches the `isFullRefund` field written by Task 2 onto `PackageRefundEvent` (Task 1) — same name, same boolean semantics, no silent renaming across the chain.
- **Known follow-up surfaced, not buried:** Task 6 flags that giving the selling employee a cut alongside per-session attribution is itself an undecided policy question that emerged only while grounding this task — it is called out explicitly rather than silently resolved either way (keeping the double-count, or silently zeroing the seller's existing invoice-based commission for package sales).
