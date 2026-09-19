# Packages Phase 1 — Reserve vs Consume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate a package session that is *booked but not yet delivered* (reserved) from one that is *actually delivered* (consumed), and show the session's real value on package-funded bookings.

**Architecture:** `PackageCredit` gains a `reservedQuantity` counter alongside `usedQuantity`, and `PackageCreditUsageStatus` gains a `RESERVED` value. `book-from-credit` reserves; check-in (with complete as a safety net) consumes; cancel / no-show / expire release either state back to the bucket. Availability everywhere becomes `totalQuantity − usedQuantity − reservedQuantity`, and the outstanding-liability report counts a reserved session as still owed to the client. The booking API exposes the credit's net session value so the dashboard can show it beside a «مدفوع من الباقة» marker while the amount *due* stays zero.

**Tech Stack:** NestJS 11, Prisma 7 (split schema), Postgres advisory locks + Serializable transactions, Jest; Next.js 15 dashboard with Vitest.

**Spec:** Review report «نموذج الجلسات والحجز والباقات» v3, roadmap «المرحلة 1»; plan for phase 0: `docs/superpowers/plans/2026-09-11-packages-phase-0-fixes.md`.

## Global Constraints

- Branch `feature/packages-phase-1` from `develop`; PR targets `develop`. Never push `main`.
- Money is integer halalas. `DEFAULT_VAT_RATE = 0` — never reintroduce 15%.
- Migrations are additive only; never edit or squash an existing migration. The new column is nullable-safe with a default so existing rows need no backfill.
- Every user-facing dashboard string goes through `t('<key>')`; add both `ar.*` and `en.*` keys and run `npm run i18n:verify`.
- Any endpoint or DTO change requires `pnpm openapi:sync` and committing the regenerated `apps/backend/openapi.json`.
- Client-facing terminology is «موعد», not «حجز».
- Definition of done: green tests are not enough — the flow must be exercised live in the local dashboard before the task is reported complete.

## Owner decisions applied

| Decision | Answer | Effect in this plan |
|---|---|---|
| When is a session consumed? | Reserve on booking, consume on attendance | Tasks 1–5 |
| No-show / late cancel | Credit always returns | Already the behaviour (`package-credit-return.helper.ts`); Task 5 extends it to reserved rows |
| Booking price display | Session value shown with a «مدفوع من الباقة» marker | Tasks 8–9 |

## Roadmap context (later phases get their own plans)

| Phase | Scope |
|---|---|
| 0 (done, PR #69) | Client overlap, credit duration on reschedule, reports contract, clinic names, discount column, delivery + channel display, credit net value, credit-panel path |
| 1 (this plan) | Reserve vs consume, availability from reserved+used, liability counts reserved, session value on bookings |
| 2 | Refund cases, partial-refund reports, earnings from net, actual-practitioner attribution |
| 3 | Practitioner-owned packages with choose-one options, 4-step editor, shared booking validation |
| 4 | Website/app packages catalog, purchase, «رصيدي», book from credit |

## File map

| File | Change | Responsibility |
|---|---|---|
| `apps/backend/prisma/schema/bookings.prisma` | Modify | `reservedQuantity` on `PackageCredit`; `RESERVED` in `PackageCreditUsageStatus` |
| `apps/backend/prisma/migrations/20260912090000_add_package_credit_reserved/migration.sql` | Create | Additive column + enum value |
| `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.ts` | Modify | Reserve instead of consume; capacity check counts both counters |
| `apps/backend/src/modules/bookings/package-credit-consume.helper.ts` | Create | `consumePackageCreditForBooking` — RESERVED → CONSUMED |
| `apps/backend/src/modules/bookings/package-credit-return.helper.ts` | Modify | Release a RESERVED row too; reclaim restores the right state |
| `apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts` | Modify | Consume the credit on attendance |
| `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts` | Modify | Safety net: consume if the booking was completed without a check-in |
| `apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler.ts` | Modify | Expose `reservedQuantity` + `availableQuantity` |
| `apps/backend/src/modules/ops/generate-report/outstanding-credit-report.builder.ts` | Modify | Reserved sessions stay liability; report them separately |
| `apps/backend/src/modules/bookings/booking-row.mapper.ts` | Modify | `packageFunding.sessionValue`, `usageStatus` union gains `RESERVED` |
| `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts` | Modify | Feed `netValue` into the funding relation |
| `apps/backend/src/modules/bookings/get-booking/get-booking.handler.ts` | Modify | Same for the detail endpoint |
| `apps/dashboard/lib/types/booking.ts` | Modify | Types for the new funding fields |
| `apps/dashboard/components/features/bookings/booking-column-cells.tsx` | Modify | Amount cell shows the session value + package marker |
| `apps/dashboard/components/features/bookings/booking-details-body.tsx` | Modify | Payment card shows the session value for package bookings |
| `apps/dashboard/lib/translations/{ar,en}.bookings.ts` | Modify | New keys |

---

### Task 1: Schema and migration for the reserved counter

**Files:**
- Modify: `apps/backend/prisma/schema/bookings.prisma` (`PackageCreditUsageStatus` at line 350, `PackageCredit` model)
- Create: `apps/backend/prisma/migrations/20260912090000_add_package_credit_reserved/migration.sql`

**Interfaces:**
- Produces: `PackageCredit.reservedQuantity: Int` (default `0`, non-null) and `PackageCreditUsageStatus.RESERVED`, used by every later task.

- [ ] **Step 1: Add the enum value and the column to the schema**

In `apps/backend/prisma/schema/bookings.prisma`, replace the enum comment and body:

```prisma
// استهلاك الرصيد لكل دلو: محجوز للموعد (RESERVED)، مستهلك بعد الحضور
// (CONSUMED)، أو مُرجَع للرصيد (RETURNED) عند الإلغاء/عدم الحضور.
enum PackageCreditUsageStatus {
  RESERVED
  CONSUMED
  RETURNED
}
```

In the `PackageCredit` model, add the counter directly under `usedQuantity`:

```prisma
  // الجلسات المحجوزة لمواعيد قائمة ولم تُقدَّم بعد. السعة المتاحة =
  // totalQuantity - usedQuantity - reservedQuantity.
  reservedQuantity Int @default(0)
```

- [ ] **Step 2: Write the migration by hand**

Create `apps/backend/prisma/migrations/20260912090000_add_package_credit_reserved/migration.sql`:

```sql
-- Additive: existing credits keep reservedQuantity = 0, so nothing to backfill.
ALTER TABLE "PackageCredit" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Postgres allows adding an enum value without rewriting existing rows.
ALTER TYPE "PackageCreditUsageStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run from `apps/backend`:

```bash
pnpm prisma migrate deploy && pnpm prisma generate
```

Expected: migration applied, no drift reported.

> Note for the implementer: `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction that then uses the new value in some Postgres versions. It is alone in its own migration file here, which is what keeps it safe. Do not merge this migration with a later data migration that writes `'RESERVED'`.

- [ ] **Step 4: Verify the column exists**

```bash
psql "$DATABASE_URL" -c '\d "PackageCredit"' | grep reservedQuantity
```

Expected: one row showing `reservedQuantity | integer | not null default 0`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/bookings.prisma apps/backend/prisma/migrations/20260912090000_add_package_credit_reserved
git commit -m "feat(packages): add a reserved-session counter to package credits"
```

---

### Task 2: Book from credit reserves instead of consuming

**Files:**
- Modify: `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.ts` (the `FOR UPDATE` recount ~line 250, usage create ~line 330, increment ~line 337, auto-complete ~line 366)
- Test: `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts`

**Interfaces:**
- Consumes: `reservedQuantity` and `RESERVED` from Task 1.
- Produces: a booking created from credit now leaves `usedQuantity` untouched, `reservedQuantity` incremented by 1, and a `PackageCreditUsage` row with `status = 'RESERVED'`.

- [ ] **Step 1: Write the failing tests**

Add to `book-from-credit.handler.spec.ts`:

```ts
it('reserves the session instead of consuming it', async () => {
  await handler.execute(cmd);

  expect(tx.packageCredit.update).toHaveBeenCalledWith({
    where: { id: 'credit-1' },
    data: { reservedQuantity: { increment: 1 } },
  });
  expect(tx.packageCreditUsage.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'RESERVED' }),
    }),
  );
});

it('rejects a booking when reserved plus used already fills the bucket', async () => {
  // 3 sessions: 2 delivered, 1 already booked for a future appointment.
  tx.$queryRaw.mockResolvedValueOnce([
    { id: 'credit-1', totalQuantity: 3, usedQuantity: 2, reservedQuantity: 1 },
  ]);

  await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
  expect(tx.booking.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- book-from-credit.handler.spec.ts
```

Expected: FAIL — the handler still increments `usedQuantity` and writes `CONSUMED`.

- [ ] **Step 3: Change the handler**

Include the new counter in the locking recount so the overdraw guard sees reservations:

```ts
const locked = await tx.$queryRaw<
  { id: string; totalQuantity: number; usedQuantity: number; reservedQuantity: number }[]
>`SELECT "id", "totalQuantity", "usedQuantity", "reservedQuantity"
    FROM "PackageCredit" WHERE "id" = ${credit.id} FOR UPDATE`;
const row = locked[0];
if (!row) throw new ConflictException('Package credit not found');
// A reserved session belongs to an appointment that has not happened yet;
// it occupies a seat exactly like a delivered one.
if (row.usedQuantity + row.reservedQuantity >= row.totalQuantity) {
  throw new ConflictException('Package credit has no remaining sessions');
}
```

Then write the usage row as reserved and move the counter:

```ts
await tx.packageCreditUsage.create({
  data: {
    creditId: credit.id,
    bookingId: booking.id,
    status: PackageCreditUsageStatus.RESERVED,
  },
});

await tx.packageCredit.update({
  where: { id: credit.id },
  data: { reservedQuantity: { increment: 1 } },
});
```

- [ ] **Step 4: Fix the purchase auto-complete rule**

A purchase must not auto-complete while sessions are only reserved — they have not been delivered. Change the auto-complete condition so it fires on the consume path only; in this handler, delete the auto-complete block and leave a comment:

```ts
// A purchase completes when its last session is DELIVERED, not when it is
// booked — the auto-complete moved to `consumePackageCreditForBooking`.
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- book-from-credit.handler.spec.ts
```

Expected: PASS, including the pre-existing overlap and concurrency tests.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/bookings/book-from-credit
git commit -m "feat(packages): reserve a package session when the appointment is booked"
```

---

### Task 3: Consume the credit on attendance

**Files:**
- Create: `apps/backend/src/modules/bookings/package-credit-consume.helper.ts`
- Test: `apps/backend/src/modules/bookings/package-credit-consume.helper.spec.ts`

**Interfaces:**
- Produces: `consumePackageCreditForBooking(tx: Prisma.TransactionClient, bookingId: string): Promise<boolean>` — flips the booking's RESERVED usage to CONSUMED, moves one unit from `reservedQuantity` to `usedQuantity`, and auto-completes the purchase when the bucket is fully delivered. Returns `false` when there is no reserved usage (idempotent). Used by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/bookings/package-credit-consume.helper.spec.ts`:

```ts
import { consumePackageCreditForBooking } from './package-credit-consume.helper';

function buildTx(usage: unknown, credit?: unknown) {
  return {
    packageCreditUsage: {
      findFirst: jest.fn().mockResolvedValue(usage),
      update: jest.fn().mockResolvedValue({}),
    },
    packageCredit: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(credit ?? null),
    },
    packagePurchase: { update: jest.fn().mockResolvedValue({}) },
  } as never;
}

describe('consumePackageCreditForBooking', () => {
  it('moves the session from reserved to used', async () => {
    const tx = buildTx({ id: 'u1', creditId: 'c1' }, {
      purchaseId: 'p1', totalQuantity: 2, usedQuantity: 1, reservedQuantity: 0,
    });

    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(true);

    expect((tx as never as ReturnType<typeof buildTx>).packageCredit.update)
      .toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { reservedQuantity: { decrement: 1 }, usedQuantity: { increment: 1 } },
      });
  });

  it('does nothing when the booking has no reserved session', async () => {
    const tx = buildTx(null);
    await expect(consumePackageCreditForBooking(tx, 'b1')).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter=backend test -- package-credit-consume.helper.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

```ts
import { Prisma, PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';

/**
 * Consume a session that was reserved for a booking, once the session has
 * actually been delivered (check-in, or completion without a check-in).
 *
 * Scoping the lookup to RESERVED makes the call idempotent: a booking already
 * consumed yields no row, so checking in twice cannot double-charge the bucket.
 * A booking that never reserved a credit (paid bookings) also yields nothing.
 *
 * @returns `true` when a session was consumed, `false` when there was nothing
 *          to consume.
 */
export async function consumePackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.RESERVED },
    select: { id: true, creditId: true },
  });
  if (!usage) return false;

  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: { status: PackageCreditUsageStatus.CONSUMED },
  });

  await tx.packageCredit.update({
    where: { id: usage.creditId },
    data: {
      reservedQuantity: { decrement: 1 },
      usedQuantity: { increment: 1 },
    },
  });

  // A purchase completes when its last session is delivered — this is the only
  // path that delivers one, so the auto-complete rule lives here.
  const credit = await tx.packageCredit.findUnique({
    where: { id: usage.creditId },
    select: { purchaseId: true, totalQuantity: true, usedQuantity: true, reservedQuantity: true },
  });
  if (credit && credit.usedQuantity >= credit.totalQuantity) {
    const siblings = await tx.packageCredit.findMany({
      where: { purchaseId: credit.purchaseId },
      select: { totalQuantity: true, usedQuantity: true },
    });
    const allDelivered = siblings.every((c) => c.usedQuantity >= c.totalQuantity);
    if (allDelivered) {
      await tx.packagePurchase.update({
        where: { id: credit.purchaseId },
        data: { status: PackagePurchaseStatus.COMPLETED },
      });
    }
  }

  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter=backend test -- package-credit-consume.helper.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/package-credit-consume.helper.ts apps/backend/src/modules/bookings/package-credit-consume.helper.spec.ts
git commit -m "feat(packages): add a helper that consumes a reserved session on attendance"
```

---

### Task 4: Wire consumption into check-in and complete

**Files:**
- Modify: `apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts:20-44`
- Modify: `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts:46-78`
- Test: the two sibling `.spec.ts` files

**Interfaces:**
- Consumes: `consumePackageCreditForBooking` from Task 3.

- [ ] **Step 1: Write the failing tests**

In `check-in-booking.handler.spec.ts`:

```ts
it('consumes the reserved package session at check-in', async () => {
  await handler.execute({ bookingId: 'b1', actorId: 'u1' });
  expect(tx.packageCreditUsage.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { bookingId: 'b1', status: 'RESERVED' } }),
  );
});
```

In `complete-booking.handler.spec.ts`:

```ts
it('consumes the session when a booking is completed without a check-in', async () => {
  await handler.execute({ bookingId: 'b1', actorId: 'u1' });
  expect(tx.packageCredit.update).toHaveBeenCalledWith({
    where: { id: 'c1' },
    data: { reservedQuantity: { decrement: 1 }, usedQuantity: { increment: 1 } },
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- check-in-booking.handler.spec.ts complete-booking.handler.spec.ts
```

Expected: FAIL — neither handler touches the credit today.

- [ ] **Step 3: Call the helper from both handlers**

In `check-in-booking.handler.ts`, inside the existing transaction, after the `checkedInAt` update:

```ts
if (booking.packageCreditId) {
  await consumePackageCreditForBooking(tx, cmd.bookingId);
}
```

In `complete-booking.handler.ts`, inside the existing transaction, after the status flip. The helper is idempotent, so a booking that already consumed at check-in is unaffected:

```ts
if (booking.packageCreditId) {
  // Safety net: a booking completed without a check-in still delivered the
  // session. The helper is scoped to RESERVED, so a checked-in booking is a
  // no-op here.
  await consumePackageCreditForBooking(tx, cmd.bookingId);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- check-in-booking.handler.spec.ts complete-booking.handler.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/check-in-booking apps/backend/src/modules/bookings/complete-booking
git commit -m "feat(packages): consume the package session when the appointment is attended"
```

---

### Task 5: Release reserved sessions on cancel, no-show, expire and restore

**Files:**
- Modify: `apps/backend/src/modules/bookings/package-credit-return.helper.ts`
- Test: `apps/backend/src/modules/bookings/package-credit-return.helper.spec.ts`

**Interfaces:**
- Consumes: `reservedQuantity`, `RESERVED` from Task 1.
- Produces: `returnPackageCreditForBooking` handles a RESERVED **or** CONSUMED usage; `reclaimPackageCreditForBooking` restores the state the booking had.

**Context:** cancel, no-show and expire already call `returnPackageCreditForBooking`, and restore-no-show already calls `reclaimPackageCreditForBooking` — those call sites need no change. Today both helpers are hard-scoped to CONSUMED / RETURNED and would silently do nothing for a reserved booking, which is the bug this task prevents.

- [ ] **Step 1: Write the failing tests**

```ts
it('releases a reserved session back to the bucket on cancel', async () => {
  const tx = buildTx({ id: 'u1', creditId: 'c1', status: 'RESERVED' });

  await expect(returnPackageCreditForBooking(tx, 'b1')).resolves.toBe(true);

  expect(tx.packageCredit.update).toHaveBeenCalledWith({
    where: { id: 'c1' },
    data: { reservedQuantity: { decrement: 1 } },
  });
});

it('returns a consumed session to used, not reserved', async () => {
  const tx = buildTx({ id: 'u1', creditId: 'c1', status: 'CONSUMED' });

  await returnPackageCreditForBooking(tx, 'b1');

  expect(tx.packageCredit.update).toHaveBeenCalledWith({
    where: { id: 'c1' },
    data: { usedQuantity: { decrement: 1 } },
  });
});

it('reclaims a restored no-show back to reserved when it was never attended', async () => {
  const tx = buildTx(
    { id: 'u1', creditId: 'c1', status: 'RETURNED' },
    { totalQuantity: 2, usedQuantity: 0, reservedQuantity: 0 },
    { checkedInAt: null },
  );

  await reclaimPackageCreditForBooking(tx, 'b1');

  expect(tx.packageCreditUsage.update).toHaveBeenCalledWith({
    where: { id: 'u1' },
    data: { status: 'RESERVED', returnedAt: null },
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- package-credit-return.helper.spec.ts
```

Expected: FAIL — the lookup is scoped to CONSUMED only.

- [ ] **Step 3: Widen the return helper**

Replace the lookup and the decrement:

```ts
const usage = await tx.packageCreditUsage.findFirst({
  where: {
    bookingId,
    // A booking can hold a session in either state: RESERVED before the
    // appointment happened, CONSUMED after it did. Both go back to the
    // bucket — the owner's policy returns the credit in every terminal
    // non-completed case, with no burn window.
    status: {
      in: [PackageCreditUsageStatus.RESERVED, PackageCreditUsageStatus.CONSUMED],
    },
  },
  select: { id: true, creditId: true, status: true },
});
if (!usage) return false;

await tx.packageCreditUsage.update({
  where: { id: usage.id },
  data: { status: PackageCreditUsageStatus.RETURNED, returnedAt: new Date() },
});

await tx.packageCredit.update({
  where: { id: usage.creditId },
  data:
    usage.status === PackageCreditUsageStatus.RESERVED
      ? { reservedQuantity: { decrement: 1 } }
      : { usedQuantity: { decrement: 1 } },
});
```

- [ ] **Step 4: Make reclaim restore the right state**

In `reclaimPackageCreditForBooking`, the capacity guard must count both counters, and the restored status must match whether the session was actually attended:

```ts
const credit = await tx.packageCredit.findUnique({
  where: { id: usage.creditId },
  select: { totalQuantity: true, usedQuantity: true, reservedQuantity: true },
});
if (!credit) {
  throw new BadRequestException('Package credit not found for this booking');
}
if (credit.usedQuantity + credit.reservedQuantity >= credit.totalQuantity) {
  throw new BadRequestException(
    'Package credit has no remaining sessions to reclaim',
  );
}

// A no-show that is restored goes back to the state it held before: a session
// it actually attended is CONSUMED, one it never attended is only RESERVED.
const booking = await tx.booking.findUnique({
  where: { id: bookingId },
  select: { checkedInAt: true },
});
const attended = !!booking?.checkedInAt;

await tx.packageCreditUsage.update({
  where: { id: usage.id },
  data: {
    status: attended
      ? PackageCreditUsageStatus.CONSUMED
      : PackageCreditUsageStatus.RESERVED,
    returnedAt: null,
  },
});

await tx.packageCredit.update({
  where: { id: usage.creditId },
  data: attended
    ? { usedQuantity: { increment: 1 } }
    : { reservedQuantity: { increment: 1 } },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- package-credit-return.helper.spec.ts cancel-booking no-show-booking expire-booking restore-no-show-booking
```

Expected: PASS across all five suites.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/bookings/package-credit-return.helper.ts apps/backend/src/modules/bookings/package-credit-return.helper.spec.ts
git commit -m "fix(packages): release reserved sessions back to the bucket on cancel and no-show"
```

---

### Task 6: Report available capacity to the credits panel

**Files:**
- Modify: `apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler.ts`
- Test: `.../list-client-package-purchases.handler.spec.ts`

**Interfaces:**
- Produces: each credit in the response gains `reservedQuantity: number` and `availableQuantity: number` (`totalQuantity − usedQuantity − reservedQuantity`, floored at 0). Consumed by the dashboard credit picker.

- [ ] **Step 1: Write the failing test**

```ts
it('reports a reserved session as unavailable', async () => {
  prisma.packagePurchase.findMany.mockResolvedValue([
    buildPurchase({ credits: [{ ...baseCredit, totalQuantity: 5, usedQuantity: 1, reservedQuantity: 2 }] }),
  ]);

  const result = await handler.execute({ clientId: 'cl1' });

  expect(result.items[0].credits[0]).toMatchObject({
    usedQuantity: 1,
    reservedQuantity: 2,
    availableQuantity: 2,
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter=backend test -- list-client-package-purchases.handler.spec.ts
```

Expected: FAIL — `reservedQuantity` and `availableQuantity` are undefined.

- [ ] **Step 3: Add the fields**

Add `reservedQuantity: true` to the credit `select`, then in the mapping:

```ts
reservedQuantity: credit.reservedQuantity,
availableQuantity: Math.max(
  0,
  credit.totalQuantity - credit.usedQuantity - credit.reservedQuantity,
),
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter=backend test -- list-client-package-purchases.handler.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Point the dashboard picker at the new field**

In `apps/dashboard/lib/types/package-purchase.ts`, add `reservedQuantity: number` and `availableQuantity: number` to the credit interface. Then in `apps/dashboard/components/features/bookings/package-credit-picker.tsx`, replace every `totalQuantity - usedQuantity` remaining-count computation with `credit.availableQuantity`, and filter out credits whose `availableQuantity` is 0.

- [ ] **Step 6: Run the dashboard tests**

```bash
cd apps/dashboard && npx vitest run test/unit/features/bookings/package-credit-picker.spec.tsx test/unit/features/bookings/step-package.spec.tsx
```

Expected: PASS (update the test fixtures to carry the two new fields).

- [ ] **Step 7: Sync the API contract and commit**

```bash
pnpm openapi:sync
git add apps/backend apps/dashboard packages apps/backend/openapi.json
git commit -m "feat(packages): report available session capacity separately from used"
```

---

### Task 7: Reserved sessions stay on the liability report

**Files:**
- Modify: `apps/backend/src/modules/ops/generate-report/outstanding-credit-report.builder.ts`
- Test: `.../outstanding-credit-report.builder.spec.ts`

**Interfaces:**
- Consumes: `remainingCreditValue` / `allocatePurchaseNet` from `credit-value.helper.ts` (phase 0).
- Produces: liability keeps counting a reserved session as owed, and each row gains `reservedSessions`.

**Why:** the phase-0 builder values the remainder from `usedQuantity` alone. With Task 2 in place, a booked-but-not-delivered session no longer touches `usedQuantity`, so its value correctly stays in the liability — but the report should also say how much of that liability is already booked, which is what the owner needs to plan capacity.

- [ ] **Step 1: Write the failing test**

```ts
it('keeps a booked-but-undelivered session inside the liability and labels it', () => {
  const rows = buildOutstandingRows([
    {
      amountPaid: 1750_00,
      refundAmount: 0,
      credits: [
        { unitPriceSnapshot: 400_00, netValue: 1750_00, totalQuantity: 6, usedQuantity: 1, reservedQuantity: 2 },
      ],
    },
  ]);

  // 5 of 6 sessions are still owed; 2 of those already have appointments.
  expect(rows[0].outstandingValue).toBe(1458_00);
  expect(rows[0].reservedSessions).toBe(2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter=backend test -- outstanding-credit-report.builder.spec.ts
```

Expected: FAIL — `reservedSessions` is undefined.

- [ ] **Step 3: Add the field**

Add `reservedQuantity: true` to the credit `select` and carry it into each row:

```ts
reservedSessions: credits.reduce((sum, c) => sum + c.reservedQuantity, 0),
```

Leave the value math alone: `remainingCreditValue` already measures from `usedQuantity`, which is now exactly "delivered".

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter=backend test -- outstanding-credit-report.builder.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Show the column in the dashboard report**

Add the column to the outstanding-credit report table in `apps/dashboard/components/features/reports/` (the package reports tab), with `t("reports.packages.outstanding.reservedSessions")` added to both `ar.reports.ts` and `en.reports.ts`. Arabic label: «جلسات محجوزة».

- [ ] **Step 6: Verify parity and commit**

```bash
cd apps/dashboard && npm run i18n:verify
git add apps/backend apps/dashboard
git commit -m "feat(reports): show how much outstanding credit is already booked"
```

---

### Task 8: Expose the session value on package-funded bookings

**Files:**
- Modify: `apps/backend/src/modules/bookings/booking-row.mapper.ts:27-34`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts:343-359`
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.ts:115-120`
- Test: the three sibling `.spec.ts` files

**Interfaces:**
- Produces: `packageFunding.sessionValue: number | null` (halalas, the net amount the client actually paid for this one session) and `usageStatus: 'RESERVED' | 'CONSUMED' | 'RETURNED'`. Consumed by Task 9.

- [ ] **Step 1: Write the failing tests**

In `booking-row.mapper.spec.ts`:

```ts
it('carries the session value on package-funded bookings', () => {
  const funding = {
    creditId: 'c1', purchaseId: 'p1', packageId: 'pk1',
    packageNameAr: 'باقة', packageNameEn: null,
    usageStatus: 'RESERVED' as const, sessionValue: 291_00,
  };
  const result = mapBookingRow(mockBooking, {
    ...relations,
    packageFundingByBookingId: new Map([[mockBooking.id, funding]]),
  });
  expect(result.packageFunding?.sessionValue).toBe(291_00);
});
```

In `list-bookings.handler.spec.ts`, extend the existing `packageFunding` expectation with `sessionValue`.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter=backend test -- booking-row.mapper.spec.ts list-bookings.handler.spec.ts get-booking.handler.spec.ts
```

Expected: FAIL — `sessionValue` is not on the type.

- [ ] **Step 3: Extend the relation type**

In `booking-row.mapper.ts`:

```ts
export interface BookingPackageFundingRelation {
  creditId: string;
  purchaseId: string;
  packageId: string;
  packageNameAr: string;
  packageNameEn: string | null;
  usageStatus: 'RESERVED' | 'CONSUMED' | 'RETURNED';
  /**
   * Net halalas the client actually paid for this single session — the
   * credit's own net value divided by its session count. Null for credits
   * purchased before `netValue` existed. This is a reporting figure: the
   * amount DUE on a package booking is always zero.
   */
  sessionValue: number | null;
}
```

- [ ] **Step 4: Populate it in both handlers**

Add `netValue: true, totalQuantity: true` to the credit `select` in each handler, then compute one session's share:

```ts
const sessionValue =
  credit.netValue != null && credit.totalQuantity > 0
    ? Math.floor(Number(credit.netValue) / credit.totalQuantity)
    : null;

packageFundingByBookingId.set(row.id, {
  creditId: credit.id,
  purchaseId: purchase.id,
  packageId: pkg.id,
  packageNameAr: pkg.nameAr,
  packageNameEn: pkg.nameEn ?? null,
  usageStatus: usage.status as 'RESERVED' | 'CONSUMED' | 'RETURNED',
  sessionValue,
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --filter=backend test -- booking-row.mapper.spec.ts list-bookings.handler.spec.ts get-booking.handler.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Sync the contract and commit**

```bash
pnpm openapi:sync
git add apps/backend apps/dashboard/lib apps/backend/openapi.json
git commit -m "feat(bookings): expose the paid session value on package-funded appointments"
```

---

### Task 9: Show the session value with a package marker

**Files:**
- Modify: `apps/dashboard/lib/types/booking.ts`
- Modify: `apps/dashboard/components/features/bookings/booking-column-cells.tsx` (amount cell)
- Modify: `apps/dashboard/components/features/bookings/booking-details-body.tsx:174-195`
- Modify: `apps/dashboard/lib/translations/{ar,en}.bookings.ts`
- Test: `apps/dashboard/test/unit/features/bookings/booking-column-cells.test.tsx`, `.../booking-package-funding.spec.tsx`

**Interfaces:**
- Consumes: `packageFunding.sessionValue` and the widened `usageStatus` from Task 8.

- [ ] **Step 1: Add the translation keys**

In `ar.bookings.ts`:

```ts
"bookings.amount.fromPackage": "مدفوع من الباقة",
```

In `en.bookings.ts`:

```ts
"bookings.amount.fromPackage": "Paid from package",
```

- [ ] **Step 2: Write the failing test**

In `booking-column-cells.test.tsx`:

```tsx
it("shows the session value and the package marker for a package booking", () => {
  render(
    <AmountCell
      booking={buildBooking({
        payment: null,
        priceSnapshot: null,
        packageFunding: { ...funding, sessionValue: 29100 },
      })}
    />,
  )

  expect(screen.getByText(/291/)).toBeInTheDocument()
  expect(screen.getByText("bookings.amount.fromPackage")).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/dashboard && npx vitest run test/unit/features/bookings/booking-column-cells.test.tsx
```

Expected: FAIL — the cell renders "—" because there is no payment and no snapshot.

- [ ] **Step 4: Update the type and the cell**

In `lib/types/booking.ts`, add to the `packageFunding` shape:

```ts
sessionValue: number | null
usageStatus: "RESERVED" | "CONSUMED" | "RETURNED"
```

In the amount cell, insert the package branch ahead of the existing fallback chain — package funding is more specific than a service list price:

```tsx
// A package booking collects nothing at the desk; the figure shown is what
// the client already paid for this session inside their package.
if (booking.packageFunding?.sessionValue != null) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <FormattedCurrency value={booking.packageFunding.sessionValue} />
      <span className="text-xs text-muted-foreground">
        {t("bookings.amount.fromPackage")}
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Mirror it in the details sheet**

In `booking-details-body.tsx`, inside the payment card, render the same pair when `booking.packageFunding?.sessionValue != null` and there is no `payment`.

- [ ] **Step 6: Run the tests and the parity gate**

```bash
cd apps/dashboard && npx vitest run test/unit/features/bookings/ && npm run i18n:verify
```

Expected: PASS, parity OK.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard
git commit -m "feat(bookings): show the paid session value on package appointments"
```

---

### Task 10: Full verification and live exercise

**Files:** none — verification only.

- [ ] **Step 1: Run the backend suites**

```bash
pnpm --filter=backend test -- src/modules/bookings src/modules/finance src/modules/ops
```

Expected: all green.

- [ ] **Step 2: Run the dashboard suite, typecheck, lint and parity**

```bash
cd apps/dashboard && npx vitest run && npm run lint && npm run i18n:verify
cd ../.. && pnpm typecheck
```

Expected: green apart from the two known `test/unit/auth/api-client.spec.ts` environment failures (`blob.text is not a function`).

- [ ] **Step 3: Confirm the OpenAPI snapshot is committed**

```bash
git status --short apps/backend/openapi.json
```

Expected: empty — the snapshot was committed with its task.

- [ ] **Step 4: Exercise the flow live**

Start `backend-phase0` / `dashboard-phase0` (or the phase-1 equivalents) and, in the dashboard:

1. Book an appointment from a client's package credit. Confirm the credits panel drops the available count by one **and** that the package reports still show the session as outstanding liability.
2. Check the appointment in. Confirm the liability drops and the reserved count drops.
3. Cancel a second booked-from-credit appointment. Confirm the available count goes back up.
4. Mark a third one no-show, then restore it. Confirm the credit returns and then re-reserves.
5. Open the bookings table and the appointment details. Confirm the amount shows the session value with «مدفوع من الباقة».

Record each observed number in the PR description. Per the repo's definition of done, a task is not complete on green tests alone.

- [ ] **Step 5: Open the PR**

Only after the user asks. Target `develop`, and list the migration plus the live figures from Step 4.

---

## Open owner decisions (not blocking this plan)

- Package validity window (does an unused credit expire?) — phase 2.
- Refund cases and fees — phase 2.
- The zero-price public option for أ. محمد الحمزة.
- Commission basis for a package session (list price vs net paid) — phase 2 uses the net.
