# Packages & Bookings Phase 0 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the independent defects found in the booking/package review without touching payments, Moyasar, migrations, or pricing semantics.

**Architecture:** Six small, independently shippable fixes. Three are backend guards/contracts inside `apps/backend/src/modules/{bookings,ops}`; three are dashboard display fixes inside `apps/dashboard/components/features/{packages,bookings}` backed by pure, unit-tested helpers. No schema change, no endpoint shape change except adding a `kind` discriminator the dashboard already declares.

**Tech Stack:** NestJS 11 + Prisma 7 + Jest (backend), Next.js 15 + React 19 + TanStack Query + Vitest (dashboard).

**Spec:** Review report «نموذج الجلسات والحجز والباقات» v3 (https://claude.ai/code/artifact/22e01b9f-e2c1-4f01-ad82-254718701338), sections E-1, F-6, R-1, K-2, K-3, B-2, and roadmap «المرحلة 0».

## Global Constraints

- Branch `feature/packages-phase-0` from `develop`; PR targets `develop`. Never push `main`.
- Migrations are immutable; this plan adds none.
- Payments / Moyasar / auth / CASL are owner-only: no file under `modules/finance/payments`, `moyasar-*`, `identity`, or guards is modified.
- Money stays integer halalas.
- Client-facing copy says «موعد», not «حجز»; no marketing superlatives.
- Run `pnpm openapi:sync` only if an endpoint's declared schema changes (Task 3 changes a runtime body whose OpenAPI response is untyped; verify the snapshot is unchanged).
- Definition of done: tests + typecheck + lint pass AND the affected dashboard flows are exercised live locally; if live verification is not possible, say so explicitly.

## Roadmap context (later phases get their own plans)

| Phase | Scope |
|---|---|
| 0 (this plan) | Client overlap on credit booking, credit duration on reschedule, package reports contract, clinic names in package form, real discount column, delivery display |
| 1 | Net snapshot per item, fixed-value credit units, reserve vs consume, due vs service value on bookings |
| 2 | Refund cases, partial-refund reports, earnings from net, actual-practitioner attribution, documented migration |
| 3 | Practitioner-owned packages with choose-one options, 4-step editor, shared booking validation |
| 4 | Website/app packages catalog, purchase, «رصيدي», book from credit |

## File map

| File | Change | Responsibility |
|---|---|---|
| `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.ts` | Modify | Add client advisory lock + client overlap guard inside the Serializable tx |
| `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts` | Modify | Tests for client overlap; keep employee-overlap test targeted |
| `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts` | Modify | Reject duration change on package-funded bookings |
| `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.spec.ts` | Modify | Tests for the guard |
| `apps/backend/src/modules/ops/generate-report/package-reports.handler.ts` | Modify | Tag every report body with `kind` |
| `apps/backend/src/modules/ops/generate-report/package-reports.handler.spec.ts` | Modify | Assert `kind` per report |
| `apps/dashboard/components/features/packages/service-option-label.ts` | Create | Pure label: clinic name for hidden (DIRECT) services, `clinic › service` otherwise |
| `apps/dashboard/hooks/use-services.ts` | Modify | Picker fetch includes hidden services |
| `apps/dashboard/components/features/packages/package-item-row.tsx` | Modify | Use the label helper |
| `apps/dashboard/components/features/packages/package-savings.ts` | Create | Pure discount/free-value derivation from computed price fields |
| `apps/dashboard/components/features/packages/package-columns.tsx` | Modify | Discount column shows real discount + free-session value |
| `apps/dashboard/lib/booking-delivery.ts` | Create | Normalize wire delivery values (`online`/`ONLINE`) |
| `apps/dashboard/components/features/bookings/booking-header-badges.tsx` | Create | Delivery badge + non-individual booking-type badge |
| `apps/dashboard/components/features/bookings/booking-detail-sheet.tsx` | Modify | Use header badges |
| `apps/dashboard/components/features/bookings/booking-columns.tsx` | Modify | Normalize delivery before icon lookup |
| `apps/dashboard/test/unit/features/packages/*.spec.ts`, `apps/dashboard/test/unit/features/bookings/booking-header-badges.spec.tsx`, `apps/dashboard/test/unit/lib/booking-delivery.spec.ts` | Create | Unit tests |

---

### Task 1: Client overlap guard when booking from package credit

**Files:**
- Modify: `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.ts` (transaction block starting at the `lockPersonReferences` call)
- Test: `apps/backend/src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts` (describe `availability + conflict checks`)

**Interfaces:**
- Consumes: `ACTIVE_BOOKING_STATUSES` from `../active-booking-statuses`; `hashToInt32` from `../booking-lifecycle.helper`.
- Produces: `ConflictException('Client already has an overlapping appointment')` — same message as `create-booking.handler.ts`.

- [ ] **Step 1: Write the failing tests**

In the `availability + conflict checks` describe, replace the employee-overlap test and add two tests:

```ts
    it('rejects with 409 when the employee already has an overlapping booking', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx();
      tx.booking.findFirst
        .mockResolvedValueOnce(null) // client overlap: none
        .mockResolvedValueOnce({ id: 'other-booking' }); // employee overlap present
      const { handler } = buildHandler({ prisma, tx });

      await expect(handler.execute(baseCmd())).rejects.toThrow(
        'Employee already has a booking in this time slot',
      );
      expect(tx.booking.create).not.toHaveBeenCalled();
    });

    it('rejects with 409 when the client already has an overlapping active appointment', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const tx = buildTx();
      tx.booking.findFirst.mockResolvedValueOnce({ id: 'client-other-booking' });
      const { handler } = buildHandler({ prisma, tx });

      await expect(handler.execute(baseCmd())).rejects.toThrow(
        new ConflictException('Client already has an overlapping appointment'),
      );
      expect(tx.booking.create).not.toHaveBeenCalled();
      expect(tx.packageCreditUsage.create).not.toHaveBeenCalled();
    });

    it('scopes the client overlap query to live, non-historical active statuses of this client', async () => {
      const prisma = buildPrisma();
      mockResolvedCredit(prisma);
      const { handler, tx } = buildHandler({ prisma });

      await handler.execute(baseCmd());

      const clientQuery = tx.booking.findFirst.mock.calls[0][0];
      expect(clientQuery.where).toEqual(
        expect.objectContaining({
          clientId: CLIENT_ID,
          isHistoricalImport: false,
          status: { in: expect.arrayContaining(['CONFIRMED', 'PENDING', 'AWAITING_PAYMENT']) },
          scheduledAt: { lt: expect.any(Date) },
          endsAt: { gt: FUTURE },
        }),
      );
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=backend test -- src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts -t "conflict checks"`
Expected: the client-overlap tests FAIL (booking is created / first findFirst call is the employee query).

- [ ] **Step 3: Implement the guard**

Import `ACTIVE_BOOKING_STATUSES` next to the existing `STAFF_TIME_BLOCKING_BOOKING_STATUSES` import:

```ts
import {
  ACTIVE_BOOKING_STATUSES,
  STAFF_TIME_BLOCKING_BOOKING_STATUSES,
} from '../active-booking-statuses';
```

At the top of the `withTransaction(async (tx) => {` callback, before `lockPersonReferences`, take the same client lock `create-booking` takes (global lock order: client → employee/slot → booking number):

```ts
        const clientLockKey1 = hashToInt32('client_booking');
        const clientLockKey2 = hashToInt32(cmd.clientId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${clientLockKey1}::int, ${clientLockKey2}::int)`;
```

Immediately after `lockPersonReferences(...)`, before the employee advisory lock:

```ts
        const clientConflict = await tx.booking.findFirst({
          where: {
            clientId: cmd.clientId,
            isHistoricalImport: false,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            scheduledAt: { lt: endsAt },
            endsAt: { gt: scheduledAt },
          },
          select: { id: true },
        });
        if (clientConflict) {
          throw new ConflictException('Client already has an overlapping appointment');
        }
```

- [ ] **Step 4: Run the whole spec file**

Run: `pnpm --filter=backend test -- src/modules/bookings/book-from-credit/book-from-credit.handler.spec.ts`
Expected: PASS (all existing tests + 3 new/updated).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/book-from-credit/
git commit -m "fix(bookings): reject overlapping client appointments when booking from package credit"
```

### Task 2: Keep the credit duration on reschedule

**Files:**
- Modify: `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts:72`
- Test: `apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.spec.ts`

**Interfaces:**
- Consumes: `booking.packageCreditId: string | null`, `booking.durationMins: number` from `fetchBookingOrFail`.
- Produces: `BadRequestException('Package-funded bookings keep the duration of their package credit')`.

- [ ] **Step 1: Write the failing tests** (append inside the describe)

```ts
  it('15. rejects a duration change on a package-funded booking', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ durationMins: 60, packageCreditId: 'credit-1' }),
    );
    const prisma = buildPrisma();
    const availability = buildAvailabilityHandler();
    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      availability as never,
    );

    await expect(
      handler.execute({ bookingId: 'book-1', newScheduledAt: futureDate, changedBy: 'user-1', newDurationMins: 30 }),
    ).rejects.toThrow(new BadRequestException('Package-funded bookings keep the duration of their package credit'));
    expect(availability.execute).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('16. allows rescheduling a package-funded booking when the duration is unchanged or omitted', async () => {
    (fetchBookingOrFail as jest.Mock).mockResolvedValue(
      makeBooking({ durationMins: 60, packageCreditId: 'credit-1' }),
    );
    const prisma = buildPrisma();
    prisma.booking.update = jest.fn().mockResolvedValue(makeBooking());
    const handler = new RescheduleBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      buildSettingsHandler() as never,
      buildZoomService() as never,
      buildAvailabilityHandler() as never,
    );

    await handler.execute({ bookingId: 'book-1', newScheduledAt: futureDate, changedBy: 'user-1', newDurationMins: 60 });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationMins: 60 }) }),
    );
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=backend test -- src/modules/bookings/reschedule-booking/reschedule-booking.handler.spec.ts -t "package-funded"`
Expected: test 15 FAILS (no rejection).

- [ ] **Step 3: Implement** — replace line 72 (`const durationMins = cmd.newDurationMins ?? booking.durationMins;`) with:

```ts
    if (
      booking.packageCreditId &&
      cmd.newDurationMins != null &&
      cmd.newDurationMins !== booking.durationMins
    ) {
      // The credit fixes the session length; changing it would book a
      // different service unit than the one the client pre-paid for.
      throw new BadRequestException('Package-funded bookings keep the duration of their package credit');
    }
    const durationMins = cmd.newDurationMins ?? booking.durationMins;
```

- [ ] **Step 4: Run the spec file**

Run: `pnpm --filter=backend test -- src/modules/bookings/reschedule-booking/reschedule-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/reschedule-booking/
git commit -m "fix(bookings): keep package credit duration when rescheduling"
```

### Task 3: Package reports carry the `kind` discriminator

**Files:**
- Modify: `apps/backend/src/modules/ops/generate-report/package-reports.handler.ts:39-50`
- Test: `apps/backend/src/modules/ops/generate-report/package-reports.handler.spec.ts`

**Interfaces:**
- Produces: `{ kind: 'SALES' | 'OUTSTANDING_CREDIT' | 'CONSUMPTION' | 'REFUNDED', ...builderResult }` — matches `apps/dashboard/lib/types/package-report.ts`.

- [ ] **Step 1: Add the failing assertions** — in each routing test add `expect(result).toHaveProperty('kind', '<TYPE>')`, e.g.:

```ts
    expect(result).toHaveProperty('kind', 'SALES');
```
(`'OUTSTANDING_CREDIT'`, `'CONSUMPTION'`, `'REFUNDED'` in the other three tests.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=backend test -- src/modules/ops/generate-report/package-reports.handler.spec.ts`
Expected: 4 FAIL on missing `kind`.

- [ ] **Step 3: Implement** — replace the switch body:

```ts
    switch (cmd.report) {
      case PackageReportType.SALES:
        return { kind: cmd.report, ...(await buildPackageSalesReport(this.prisma, { from, to })) };
      case PackageReportType.OUTSTANDING_CREDIT:
        return { kind: cmd.report, ...(await buildOutstandingCreditReport(this.prisma, { from, to })) };
      case PackageReportType.CONSUMPTION:
        return { kind: cmd.report, ...(await buildPackageConsumptionReport(this.prisma, { from, to })) };
      case PackageReportType.REFUNDED:
        return { kind: cmd.report, ...(await buildRefundedPackagesReport(this.prisma, { from, to })) };
      default:
        throw new BadRequestException(`Unsupported package report type: ${cmd.report}`);
    }
```

- [ ] **Step 4: Run spec + confirm OpenAPI unaffected**

Run: `pnpm --filter=backend test -- src/modules/ops/generate-report/package-reports.handler.spec.ts`
Expected: PASS. The controller declares only a description for this 200 response, so `apps/backend/openapi.json` does not change.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ops/generate-report/package-reports.handler*.ts
git commit -m "fix(reports): tag package report bodies with kind so the dashboard renders them"
```

### Task 4: Clinic names in the package service picker

**Files:**
- Create: `apps/dashboard/components/features/packages/service-option-label.ts`
- Create: `apps/dashboard/test/unit/features/packages/service-option-label.spec.ts`
- Modify: `apps/dashboard/hooks/use-services.ts:90-97`
- Modify: `apps/dashboard/components/features/packages/package-item-row.tsx:91-94`

**Interfaces:**
- Produces: `serviceOptionLabel(service: Pick<Service, "nameAr" | "nameEn" | "isHidden" | "category">, locale: "ar" | "en"): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest"
import { serviceOptionLabel } from "@/components/features/packages/service-option-label"

const clinic = (mode: "DIRECT" | "SERVICES") => ({
  id: "c1", nameAr: "عيادة السعادة", nameEn: "Happiness Clinic", bookingMode: mode,
})

describe("serviceOptionLabel", () => {
  test("hidden service of a direct-booking clinic shows the clinic name", () => {
    const s = { nameAr: "خدمة داخلية", nameEn: "internal", isHidden: true, category: clinic("DIRECT") }
    expect(serviceOptionLabel(s as never, "ar")).toBe("عيادة السعادة")
    expect(serviceOptionLabel(s as never, "en")).toBe("Happiness Clinic")
  })

  test("visible service inside a clinic shows clinic › service", () => {
    const s = { nameAr: "مقاييس نفسية", nameEn: "Psychological Scales", isHidden: false, category: { ...clinic("SERVICES"), nameAr: "القياس والتقويم", nameEn: "Assessment" } }
    expect(serviceOptionLabel(s as never, "ar")).toBe("القياس والتقويم › مقاييس نفسية")
  })

  test("service without a clinic shows its own name, falling back to Arabic", () => {
    const s = { nameAr: "استشارة", nameEn: null, isHidden: false, category: null }
    expect(serviceOptionLabel(s as never, "en")).toBe("استشارة")
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=dashboard test -- test/unit/features/packages/service-option-label.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

```ts
/**
 * Package service picker label — Sawaa Dashboard
 *
 * Direct-booking clinics book through one hidden internal service, so the
 * clinic name is the only meaningful label for it. Services inside a
 * multi-service clinic read as «clinic › service».
 */

import type { Service } from "@/lib/types/service"

type LabelledService = Pick<Service, "nameAr" | "nameEn" | "isHidden" | "category">

export function serviceOptionLabel(service: LabelledService, locale: "ar" | "en"): string {
  const pick = (ar: string, en?: string | null) => (locale === "ar" ? ar : en || ar)
  const category = service.category
  if (!category) return pick(service.nameAr, service.nameEn)
  const clinicName = pick(category.nameAr, category.nameEn)
  if (service.isHidden) return clinicName
  return `${clinicName} › ${pick(service.nameAr, service.nameEn)}`
}
```

- [ ] **Step 4: Wire it** — `use-services.ts`:

```ts
export function useAllServices() {
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.services.all, "picker", { includeHidden: true }],
    // Package items must be able to reference direct-booking clinics, which
    // book through a hidden internal service.
    queryFn: () => fetchServices({ page: 1, limit: 100, includeHidden: true }),
    staleTime: 5 * 60 * 1000,
  })
  return { data: data?.items ?? [], isLoading, error }
}
```

`package-item-row.tsx` (import `serviceOptionLabel` from `./service-option-label`):

```ts
  const serviceOptions: MultiSelectOption[] = services.map((s) => ({
    value: s.id,
    label: serviceOptionLabel(s, locale),
  }))
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter=dashboard test -- test/unit/features/packages/service-option-label.spec.ts` then `pnpm --filter=dashboard typecheck`
Expected: PASS / no errors (confirm `ServiceListQuery` already has `includeHidden`).

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/features/packages/service-option-label.ts apps/dashboard/components/features/packages/package-item-row.tsx apps/dashboard/hooks/use-services.ts apps/dashboard/test/unit/features/packages/service-option-label.spec.ts
git commit -m "fix(dashboard): show clinic names for direct-booking services in the package form"
```

### Task 5: Real discount in the packages list

**Files:**
- Create: `apps/dashboard/components/features/packages/package-savings.ts`
- Create: `apps/dashboard/test/unit/features/packages/package-savings.spec.ts`
- Modify: `apps/dashboard/components/features/packages/package-columns.tsx` (discount column cell)

**Interfaces:**
- Produces: `packageSavings(p: Pick<SessionPackage, "discountAmount" | "freeValue">): { discount: number; freeValue: number }` (halalas, non-negative integers).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest"
import { packageSavings } from "@/components/features/packages/package-savings"

describe("packageSavings", () => {
  test("reads computed per-item discount and free-session value (Decimal strings)", () => {
    expect(packageSavings({ discountAmount: "100000", freeValue: "0" })).toEqual({ discount: 100000, freeValue: 0 })
    expect(packageSavings({ discountAmount: 70000, freeValue: 50000 })).toEqual({ discount: 70000, freeValue: 50000 })
  })

  test("treats missing or invalid values as zero", () => {
    expect(packageSavings({ discountAmount: "abc", freeValue: undefined })).toEqual({ discount: 0, freeValue: 0 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=dashboard test -- test/unit/features/packages/package-savings.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/**
 * Package savings — Sawaa Dashboard
 *
 * Discounts live on package items; the package-level discount fields are
 * deprecated and always zero. The list reads the server-computed totals.
 */

import type { SessionPackage } from "@/lib/types/package"

const halalas = (v: number | string | undefined) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function packageSavings(p: Pick<SessionPackage, "discountAmount" | "freeValue">) {
  return { discount: halalas(p.discountAmount), freeValue: halalas(p.freeValue) }
}
```

Discount column cell in `package-columns.tsx`:

```tsx
      cell: ({ row }) => {
        const { discount, freeValue } = packageSavings(row.original)
        return (
          <div className="flex flex-col">
            <span className="tabular-nums text-sm text-muted-foreground">{formatPrice(discount)}</span>
            {freeValue > 0 && (
              <span className="tabular-nums text-xs text-muted-foreground">
                {label("packages.col.freeValue", "Free sessions")} {formatPrice(freeValue)}
              </span>
            )}
          </div>
        )
      },
```

Add translation keys: `apps/dashboard/lib/translations/ar.services.ts` → `"packages.col.freeValue": "جلسات مجانية",`; `en.services.ts` → `"packages.col.freeValue": "Free sessions",` (next to `packages.col.discount`).

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter=dashboard test -- test/unit/features/packages/package-savings.spec.ts` then `pnpm --filter=dashboard typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/features/packages/package-savings.ts apps/dashboard/components/features/packages/package-columns.tsx apps/dashboard/lib/translations/ar.services.ts apps/dashboard/lib/translations/en.services.ts apps/dashboard/test/unit/features/packages/package-savings.spec.ts
git commit -m "fix(dashboard): show the real item discount and free-session value in the packages list"
```

### Task 6: Correct delivery type in booking details and table icon

**Files:**
- Create: `apps/dashboard/lib/booking-delivery.ts`
- Create: `apps/dashboard/test/unit/lib/booking-delivery.spec.ts`
- Create: `apps/dashboard/components/features/bookings/booking-header-badges.tsx`
- Create: `apps/dashboard/test/unit/features/bookings/booking-header-badges.spec.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-detail-sheet.tsx:109`
- Modify: `apps/dashboard/components/features/bookings/booking-columns.tsx:105`

**Interfaces:**
- Produces: `normalizeDeliveryType(value: string | null | undefined): DeliveryType | null`; `BookingHeaderBadges({ booking }: { booking: Pick<Booking, "type" | "deliveryType" | "status"> })`.

- [ ] **Step 1: Write failing tests**

`test/unit/lib/booking-delivery.spec.ts`:

```ts
import { describe, expect, test } from "vitest"
import { normalizeDeliveryType } from "@/lib/booking-delivery"

describe("normalizeDeliveryType", () => {
  test("accepts the lowercase wire alias and the enum spelling", () => {
    expect(normalizeDeliveryType("online")).toBe("ONLINE")
    expect(normalizeDeliveryType("in_person")).toBe("IN_PERSON")
    expect(normalizeDeliveryType("ONLINE")).toBe("ONLINE")
  })
  test("returns null for empty or unknown values", () => {
    expect(normalizeDeliveryType(null)).toBeNull()
    expect(normalizeDeliveryType("walk_in")).toBeNull()
  })
})
```

`test/unit/features/bookings/booking-header-badges.spec.tsx`:

```tsx
import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { BookingHeaderBadges } from "@/components/features/bookings/booking-header-badges"

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k, locale: "ar" }) }))
vi.mock("@sawaa/ui", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/features/status-badge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
  BookingTypeBadge: ({ type }: { type: string }) => <span>type:{type}</span>,
}))

describe("BookingHeaderBadges", () => {
  test("an individual online booking shows the online delivery label, not in-person", () => {
    render(<BookingHeaderBadges booking={{ type: "in_person", deliveryType: "online", status: "completed" } as never} />)
    expect(screen.getByText("bookings.col.type.online")).toBeInTheDocument()
    expect(screen.queryByText("bookings.col.type.inPerson")).not.toBeInTheDocument()
    expect(screen.queryByText(/^type:/)).not.toBeInTheDocument()
  })

  test("a group booking keeps its booking-type badge next to the delivery label", () => {
    render(<BookingHeaderBadges booking={{ type: "group", deliveryType: "in_person", status: "confirmed" } as never} />)
    expect(screen.getByText("bookings.col.type.inPerson")).toBeInTheDocument()
    expect(screen.getByText("type:group")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=dashboard test -- test/unit/lib/booking-delivery.spec.ts test/unit/features/bookings/booking-header-badges.spec.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`lib/booking-delivery.ts`:

```ts
/**
 * Booking delivery normalization — Sawaa Dashboard
 *
 * The bookings API serializes delivery as a lowercase alias
 * (`in_person` / `online`) while the dashboard type is the enum spelling.
 */

import type { DeliveryType } from "@/lib/types/booking"

export function normalizeDeliveryType(value: string | null | undefined): DeliveryType | null {
  const upper = (value ?? "").toUpperCase()
  return upper === "ONLINE" || upper === "IN_PERSON" ? upper : null
}
```

`components/features/bookings/booking-header-badges.tsx`:

```tsx
"use client"

import { Badge } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { BookingTypeBadge, StatusBadge } from "@/components/features/status-badge"
import { normalizeDeliveryType } from "@/lib/booking-delivery"
import type { Booking } from "@/lib/types/booking"

/** Delivery channel first; the booking-type badge only when it adds information. */
export function BookingHeaderBadges({ booking }: { booking: Pick<Booking, "type" | "deliveryType" | "status"> }) {
  const { t } = useLocale()
  const delivery = normalizeDeliveryType(booking.deliveryType)
  const type = String(booking.type)
  const showType = type === "group" || type === "walk_in"
  return (
    <div className="flex items-center gap-2">
      {delivery && (
        <Badge variant="outline" className="font-semibold text-[11px]">
          {t(delivery === "ONLINE" ? "bookings.col.type.online" : "bookings.col.type.inPerson")}
        </Badge>
      )}
      {showType && <BookingTypeBadge type={booking.type} />}
      <StatusBadge status={booking.status} />
    </div>
  )
}
```

`booking-detail-sheet.tsx` — replace the two-badge `<div className="flex items-center gap-2">…</div>` with `<BookingHeaderBadges booking={booking} />` and import it; drop now-unused `BookingTypeBadge`/`StatusBadge` imports only if nothing else in the file uses them.

`booking-columns.tsx:105`:

```ts
        const delivery = deliveryIconConfig[normalizeDeliveryType(row.original.deliveryType) ?? "IN_PERSON"]
```
(import `normalizeDeliveryType` from `@/lib/booking-delivery`).

- [ ] **Step 4: Run tests, existing booking specs, typecheck**

Run: `pnpm --filter=dashboard test -- test/unit/lib/booking-delivery.spec.ts test/unit/features/bookings` then `pnpm --filter=dashboard typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/booking-delivery.ts apps/dashboard/components/features/bookings/booking-header-badges.tsx apps/dashboard/components/features/bookings/booking-detail-sheet.tsx apps/dashboard/components/features/bookings/booking-columns.tsx apps/dashboard/test/unit/lib/booking-delivery.spec.ts apps/dashboard/test/unit/features/bookings/booking-header-badges.spec.tsx
git commit -m "fix(dashboard): show the real delivery channel in booking details and table"
```

### Task 7: Verification gate

- [ ] Backend: `pnpm --filter=backend test -- src/modules/bookings src/modules/ops/generate-report` → PASS; `pnpm --filter=backend typecheck` → no errors.
- [ ] Dashboard: `pnpm --filter=dashboard test` → PASS; `pnpm --filter=dashboard typecheck` and `pnpm --filter=dashboard lint` → no errors.
- [ ] OpenAPI: confirm `git diff --stat apps/backend/openapi.json` is empty.
- [ ] Live (local): `pnpm docker:up`, migrate + seed, run backend + dashboard; verify packages report tabs render, package form shows clinic names, packages list discount, booking details delivery badge; attempt a credit booking overlapping the client's existing appointment and expect a 409.
- [ ] Push `feature/packages-phase-0` and open a PR to `develop` only after the user asks.

## Deferred with reason

- **Zero-price public option (P-4):** needs the owner's decision (intended free session or missing price). No code change in this phase.
