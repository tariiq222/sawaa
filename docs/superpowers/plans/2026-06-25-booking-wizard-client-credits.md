# Booking Wizard — Client Package Credits Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the new-booking wizard, show a selected client's active package credits as interactive cards that pre-fill the wizard and let reception book a pre-paid (price-0) session in two clicks.

**Architecture:** Reuse the existing matching-credit / from-credit consumption core unchanged. Enrich one backend list endpoint with category/department fields so a credit card knows the full wizard target, add one atomic state setter that fills department→duration in a single update, and render a panel in the Client step that jumps the wizard on click.

**Tech Stack:** NestJS 11 + Prisma 7 (backend), Next.js 15 + React 19 + TanStack Query (dashboard), Jest (backend tests), Vitest (dashboard tests).

## Global Constraints

- Money is integer halalas; a package credit makes the session **free** (price 0), it is NOT a discount.
- Customer/staff copy: use "استخدام رصيد الباقة" / "مدفوعة مسبقاً" — never "خصم".
- Code, comments, commit messages in English only.
- `apps/backend/openapi.json` is committed; run `pnpm openapi:sync` after any endpoint shape change and commit the regenerated snapshot + dashboard types.
- Backend additive only — do not break the client-detail balances panel that already consumes this endpoint.
- Single-tenant: no organizationId filters, no tenant/platform concepts.

---

### Task 0: Verify the foundation works live (blocking gate — no code)

The whole feature builds on the existing matching-credit badge + `POST /dashboard/bookings/from-credit`. Confirm it works before building anything. If broken, STOP and fix that first (treat as its own bug task), then resume.

- [ ] **Step 1: Identify a client with active credits**

Run (from repo root):
```bash
DB="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_dev" node -e '
const {Client}=require("./node_modules/pg");
(async()=>{const c=new Client(process.env.DB);await c.connect();
const r=await c.query(`SELECT pp."clientId", pc."serviceId", pc."employeeId", pc."durationOptionId", (pc."totalQuantity"-pc."usedQuantity") rem
FROM "PackageCredit" pc JOIN "PackagePurchase" pp ON pp.id=pc."purchaseId"
WHERE pp.status=$$ACTIVE$$ AND pc."usedQuantity"<pc."totalQuantity" LIMIT 3`);
console.log(JSON.stringify(r.rows,null,1));await c.end()})()'
```
Expected: at least one row with `rem > 0`. Note the clientId + the service/employee/duration triple.

- [ ] **Step 2: Walk the wizard live and book from credit**

Backend on :5200, dashboard on :5203. Log in as receptionist (`receptionist@sawaa-test.com` / `Recept@1234`), open `/bookings?new=1`, select that client, then navigate department→category→service→employee→duration to the triple from Step 1. Confirm the matching-credit badge appears in the DateTime step, accept it, pick a slot, submit.

- [ ] **Step 3: Verify the consumption**

Run:
```bash
DB="postgresql://sawaa:sawaa_dev_password@localhost:3453/sawaa_dev" node -e '
const {Client}=require("./node_modules/pg");
(async()=>{const c=new Client(process.env.DB);await c.connect();
const u=await c.query(`SELECT b.id, b.price, b."packageCreditId", u.status FROM "Booking" b JOIN "PackageCreditUsage" u ON u."bookingId"=b.id ORDER BY b."createdAt" DESC LIMIT 1`);
console.log(JSON.stringify(u.rows,null,1));await c.end()})()'
```
Expected: newest booking has `price = 0`, a non-null `packageCreditId`, and a `CONSUMED` usage row.

- [ ] **Step 4: Decision gate**

If Step 3 passes → foundation good, proceed to Task 1. If it fails → stop; diagnose and fix the matching-credit/from-credit chain as a separate bug, re-verify Step 3, then continue.

---

### Task 1: Backend — enrich the client-purchases credit row

**Files:**
- Modify: `apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler.ts`
- Test: `apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler.spec.ts`

**Interfaces:**
- Produces: `ClientPackageCreditRow` gains fields — `categoryId: string | null`, `categoryNameAr: string`, `categoryNameEn: string | null`, `categoryBookingMode: 'DIRECT' | 'SERVICES' | null`, `departmentId: string | null`, `departmentNameAr: string`, `departmentNameEn: string | null`, `serviceIsBookable: boolean`.

- [ ] **Step 1: Write the failing test**

Add to the spec file. The existing spec mocks `prisma` with `findMany`; extend the service mock to return category/department and an archived service, and assert the new fields. Append:

```typescript
it('resolves category + department + bookability onto each credit row', async () => {
  prisma.packagePurchase.findMany.mockResolvedValue([
    {
      id: 'p1', packageId: 'pkg1', clientId: 'c1', status: 'ACTIVE',
      subtotalSnapshot: 0, discountSnapshot: 0, amountPaid: 0, refundAmount: 0,
      paidAt: new Date('2026-06-01'), refundedAt: null, notes: null, createdAt: new Date('2026-06-01'),
      credits: [
        { id: 'cr1', serviceId: 's1', employeeId: 'e1', durationOptionId: 'd1',
          unitPriceSnapshot: 10000, totalQuantity: 5, usedQuantity: 1 },
        { id: 'cr2', serviceId: 's2', employeeId: 'e1', durationOptionId: 'd1',
          unitPriceSnapshot: 10000, totalQuantity: 2, usedQuantity: 0 },
      ],
    },
  ]);
  prisma.sessionPackage.findMany.mockResolvedValue([{ id: 'pkg1', nameAr: 'باقة', nameEn: null }]);
  prisma.service.findMany.mockResolvedValue([
    { id: 's1', nameAr: 'خدمة', nameEn: null, isActive: true, archivedAt: null,
      categoryId: 'cat1',
      category: { id: 'cat1', nameAr: 'عيادة', nameEn: null, bookingMode: 'SERVICES',
        departmentId: 'dep1', department: { id: 'dep1', nameAr: 'قسم', nameEn: null } } },
    { id: 's2', nameAr: 'خدمة محذوفة', nameEn: null, isActive: false, archivedAt: new Date('2026-06-02'),
      categoryId: 'cat1',
      category: { id: 'cat1', nameAr: 'عيادة', nameEn: null, bookingMode: 'SERVICES',
        departmentId: 'dep1', department: { id: 'dep1', nameAr: 'قسم', nameEn: null } } },
  ]);
  prisma.employee.findMany.mockResolvedValue([{ id: 'e1', name: 'Emp', nameAr: 'موظف', nameEn: null, isActive: true }]);
  prisma.serviceDurationOption.findMany.mockResolvedValue([{ id: 'd1', labelAr: '٤٥ د', label: '45m', durationMins: 45 }]);

  const rows = await handler.execute({ clientId: 'c1' });
  const [active, archived] = rows[0].credits;
  expect(active).toEqual(expect.objectContaining({
    categoryId: 'cat1', categoryNameAr: 'عيادة', categoryBookingMode: 'SERVICES',
    departmentId: 'dep1', departmentNameAr: 'قسم', serviceIsBookable: true,
  }));
  expect(archived.serviceIsBookable).toBe(false);
});
```

Also update the `buildPrisma` helper in the spec so `prisma` exposes `sessionPackage/service/employee/serviceDurationOption.findMany` (it likely already does for the existing tests — if a model is missing, add `findMany: jest.fn().mockResolvedValue([])`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- list-client-package-purchases.handler.spec.ts -t "resolves category"`
Expected: FAIL — `categoryId` undefined on the row.

- [ ] **Step 3: Implement — widen the service select + interface + mapping**

In the handler, extend the `ClientPackageCreditRow` interface with the eight new fields (see Interfaces above).

Widen the `service.findMany` select (the one resolving `serviceMap`) to:
```typescript
this.prisma.service.findMany({
  where: { id: { in: serviceIds } },
  select: {
    id: true, nameAr: true, nameEn: true, isActive: true, archivedAt: true,
    categoryId: true,
    category: {
      select: {
        id: true, nameAr: true, nameEn: true, bookingMode: true, departmentId: true,
        department: { select: { id: true, nameAr: true, nameEn: true } },
      },
    },
  },
})
```

Resolve employee activity too — widen the `employee.findMany` select to add `isActive: true`.

In the `credits.map`, after the existing name resolution, add:
```typescript
const category = service?.category ?? null;
const department = category?.department ?? null;
const serviceIsBookable =
  !!service && service.isActive && service.archivedAt === null && !!employee && employee.isActive;
return {
  // ...existing fields...
  categoryId: service?.categoryId ?? null,
  categoryNameAr: category?.nameAr ?? '',
  categoryNameEn: category?.nameEn ?? null,
  categoryBookingMode: (category?.bookingMode as 'DIRECT' | 'SERVICES' | undefined) ?? null,
  departmentId: department?.id ?? null,
  departmentNameAr: department?.nameAr ?? '',
  departmentNameEn: department?.nameEn ?? null,
  serviceIsBookable,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=backend test -- list-client-package-purchases.handler.spec.ts`
Expected: PASS (all, including the existing cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter=backend typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/
git commit -m "feat(packages): enrich client credit rows with category/department + bookability"
```

---

### Task 2: Sync OpenAPI + dashboard types

**Files:**
- Modify (generated): `apps/backend/openapi.json`, dashboard generated types
- Modify (hand-written): `apps/dashboard/lib/types/package-purchase.ts`

**Interfaces:**
- Produces: dashboard `PackageCredit` type gains the same eight fields (camelCase identical) so the panel and state setter can read them.

- [ ] **Step 1: Regenerate the OpenAPI snapshot + dashboard client**

Run: `pnpm openapi:sync`
Expected: `apps/backend/openapi.json` updates; dashboard generated types regenerate.

- [ ] **Step 2: Extend the hand-written dashboard credit type**

In `apps/dashboard/lib/types/package-purchase.ts`, find the `PackageCredit` interface and add:
```typescript
  categoryId: string | null
  categoryNameAr: string
  categoryNameEn: string | null
  categoryBookingMode: "DIRECT" | "SERVICES" | null
  departmentId: string | null
  departmentNameAr: string
  departmentNameEn: string | null
  serviceIsBookable: boolean
```

- [ ] **Step 3: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/openapi.json apps/dashboard/lib/types/package-purchase.ts apps/dashboard/lib/api/generated 2>/dev/null; git add -A apps/dashboard/lib
git commit -m "chore(api): sync openapi + dashboard types for enriched credit rows"
```

---

### Task 3: Frontend — `applyCreditTarget` state setter

**Files:**
- Modify: `apps/dashboard/components/features/bookings/use-booking-form-state.ts`
- Test: `apps/dashboard/components/features/bookings/use-booking-form-state.test.ts` (create if absent)

**Interfaces:**
- Consumes: `BookingFormState`, `CategoryBookingMode` (existing).
- Produces: `applyCreditTarget(target: CreditTarget): void` returned from `useBookingFormState`, where
  ```typescript
  interface CreditTarget {
    departmentId: string | null
    departmentName: string | null
    categoryId: string
    categoryName: string
    categoryBookingMode: CategoryBookingMode | null
    serviceId: string
    serviceName: string
    employeeId: string
    employeeName: string
    durationOptionId: string
  }
  ```

- [ ] **Step 1: Write the failing test**

Create the test file:
```typescript
import { renderHook, act } from "@testing-library/react"
import { useBookingFormState } from "./use-booking-form-state"

test("applyCreditTarget fills the path and clears delivery/date/time", () => {
  const { result } = renderHook(() => useBookingFormState())
  act(() => result.current.selectClient("c1", "محمد"))
  act(() =>
    result.current.applyCreditTarget({
      departmentId: "dep1", departmentName: "قسم",
      categoryId: "cat1", categoryName: "عيادة", categoryBookingMode: "SERVICES",
      serviceId: "s1", serviceName: "خدمة",
      employeeId: "e1", employeeName: "موظف",
      durationOptionId: "d1",
    }),
  )
  const s = result.current.state
  expect(s).toEqual(expect.objectContaining({
    clientId: "c1", departmentId: "dep1", categoryId: "cat1",
    categoryBookingMode: "SERVICES", serviceId: "s1", employeeId: "e1",
    durationOptionId: "d1", deliveryType: null, date: null, startTime: null,
  }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=dashboard test -- use-booking-form-state.test.ts`
Expected: FAIL — `applyCreditTarget is not a function`.

- [ ] **Step 3: Implement the setter**

In `use-booking-form-state.ts`, add the `CreditTarget` interface near the top (exported), then add inside the hook before the `return`:
```typescript
/**
 * Jump the wizard straight to a package credit's target: fills
 * department → category (+mode) → service → employee → durationOption in one
 * atomic update, leaving deliveryType/date/time for the user to finish.
 */
const applyCreditTarget = useCallback((t: CreditTarget) => {
  setState((prev) => ({
    ...prev,
    departmentId: t.departmentId,
    departmentName: t.departmentName,
    categoryId: t.categoryId,
    categoryName: t.categoryName,
    categoryBookingMode: t.categoryBookingMode,
    serviceId: t.serviceId,
    serviceName: t.serviceName,
    employeeId: t.employeeId,
    employeeName: t.employeeName,
    durationOptionId: t.durationOptionId,
    deliveryType: null,
    type: null,
    date: null,
    startTime: null,
  }))
}, [])
```
Add `applyCreditTarget` to the returned object. Update the file's top EXCEPTION comment line count if the size limit is exceeded.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=dashboard test -- use-booking-form-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/features/bookings/use-booking-form-state.ts apps/dashboard/components/features/bookings/use-booking-form-state.test.ts
git commit -m "feat(bookings): add applyCreditTarget wizard-jump state setter"
```

---

### Task 4: Frontend — `client-credits-panel` component

**Files:**
- Create: `apps/dashboard/components/features/bookings/client-credits-panel.tsx`
- Test: `apps/dashboard/components/features/bookings/client-credits-panel.test.tsx`

**Interfaces:**
- Consumes: `useClientPackagePurchases(clientId, { status: 'ACTIVE' })` from `hooks/use-package-purchases.ts`; `CreditTarget` from `use-booking-form-state.ts`.
- Produces: `<ClientCreditsPanel clientId={string} onUseCredit={(t: CreditTarget) => void} />`. Renders nothing when there are no usable credits.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import { ClientCreditsPanel } from "./client-credits-panel"

vi.mock("@/hooks/use-package-purchases", () => ({
  useClientPackagePurchases: () => ({
    purchases: [
      { id: "p1", packageNameAr: "باقة", status: "ACTIVE", credits: [
        { id: "cr1", serviceNameAr: "خدمة", employeeNameAr: "موظف", durationLabelAr: "٤٥ د",
          totalQuantity: 5, usedQuantity: 1, remaining: 4, serviceIsBookable: true,
          categoryId: "cat1", categoryNameAr: "عيادة", categoryBookingMode: "SERVICES",
          departmentId: "dep1", departmentNameAr: "قسم",
          serviceId: "s1", employeeId: "e1", durationOptionId: "d1" },
        { id: "cr2", serviceNameAr: "منتهية", employeeNameAr: "م", durationLabelAr: "د",
          totalQuantity: 2, usedQuantity: 2, remaining: 0, serviceIsBookable: true,
          categoryId: "cat1", categoryNameAr: "عيادة", categoryBookingMode: "SERVICES",
          departmentId: "dep1", departmentNameAr: "قسم",
          serviceId: "s2", employeeId: "e1", durationOptionId: "d1" },
      ] },
    ],
    isLoading: false,
  }),
}))

test("renders only usable credits and fires onUseCredit on click", async () => {
  const onUseCredit = vi.fn()
  render(<ClientCreditsPanel clientId="c1" onUseCredit={onUseCredit} />)
  expect(screen.getByText("خدمة")).toBeInTheDocument()
  expect(screen.queryByText("منتهية")).not.toBeInTheDocument() // remaining 0 hidden
  screen.getByRole("button", { name: /استخدام رصيد الباقة/ }).click()
  expect(onUseCredit).toHaveBeenCalledWith(expect.objectContaining({ serviceId: "s1", durationOptionId: "d1" }))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=dashboard test -- client-credits-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
"use client"

import { Button } from "@sawaa/ui"
import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import type { CreditTarget } from "./use-booking-form-state"

interface Props {
  clientId: string
  onUseCredit: (target: CreditTarget) => void
}

export function ClientCreditsPanel({ clientId, onUseCredit }: Props) {
  const { t } = useLocale()
  const { purchases } = useClientPackagePurchases(clientId, { status: "ACTIVE" })

  const usable = (purchases ?? [])
    .filter((p) => p.status === "ACTIVE")
    .flatMap((p) => p.credits.map((c) => ({ purchaseName: p.packageNameAr, credit: c })))
    .filter((x) => x.credit.remaining > 0)

  if (usable.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("packages.credits.availableForClient")}
      </p>
      {usable.map(({ purchaseName, credit }) => {
        const bookable = credit.serviceIsBookable
        return (
          <div key={credit.id} className="flex items-center justify-between rounded-md border bg-surface-solid p-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{credit.serviceNameAr}</p>
              <p className="truncate text-xs text-muted-foreground">
                {purchaseName} · {credit.employeeNameAr} · {credit.durationLabelAr}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("packages.credits.remaining")}: {credit.remaining} / {credit.totalQuantity}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!bookable}
              onClick={() =>
                onUseCredit({
                  departmentId: credit.departmentId,
                  departmentName: credit.departmentNameAr,
                  categoryId: credit.categoryId!,
                  categoryName: credit.categoryNameAr,
                  categoryBookingMode: credit.categoryBookingMode,
                  serviceId: credit.serviceId,
                  serviceName: credit.serviceNameAr,
                  employeeId: credit.employeeId,
                  employeeName: credit.employeeNameAr,
                  durationOptionId: credit.durationOptionId,
                })
              }
            >
              {bookable ? t("packages.credits.use") : t("packages.credits.unavailable")}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
```

Add the four translation keys to both `lib/translations/ar.*.ts` and `en.*.ts` (pick the bookings or packages module file):
- `packages.credits.availableForClient` — AR: "أرصدة باقات هذا المستفيد" / EN: "This client's package credits"
- `packages.credits.remaining` — AR: "المتبقي" / EN: "Remaining"
- `packages.credits.use` — AR: "استخدام رصيد الباقة" / EN: "Use package credit"
- `packages.credits.unavailable` — AR: "غير متاح" / EN: "Unavailable"

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=dashboard test -- client-credits-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: i18n parity + typecheck**

Run: `pnpm --filter=dashboard run i18n:verify && pnpm --filter=dashboard typecheck`
Expected: parity OK, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/features/bookings/client-credits-panel.tsx apps/dashboard/components/features/bookings/client-credits-panel.test.tsx apps/dashboard/lib/translations
git commit -m "feat(bookings): client package credits panel for the wizard"
```

---

### Task 5: Frontend — wire the panel into the wizard

**Files:**
- Modify: `apps/dashboard/components/features/bookings/booking-pos.tsx`

**Interfaces:**
- Consumes: `applyCreditTarget` (Task 3), `<ClientCreditsPanel>` (Task 4), existing `setOpenSection`.

- [ ] **Step 1: Pull `applyCreditTarget` from the form-state hook**

In `booking-pos.tsx`, find where `useBookingFormState()` is destructured and add `applyCreditTarget` to the destructured names.

- [ ] **Step 2: Render the panel in the Client section + add the jump handler**

Add a handler near the other `handle*Select` callbacks:
```tsx
const handleUseCredit = (target: CreditTarget) => {
  applyCreditTarget(target)
  setOpenSection("typeDuration")
}
```
Import the type: `import type { CreditTarget } from "./use-booking-form-state"` and the component: `import { ClientCreditsPanel } from "./client-credits-panel"`.

In the Client `CollapsibleSection` (the block rendering `<ClientStep onSelect={handleClientSelect} />`), render the panel below the step when a client is chosen:
```tsx
<ClientStep onSelect={handleClientSelect} />
{state.clientId && (
  <ClientCreditsPanel clientId={state.clientId} onUseCredit={handleUseCredit} />
)}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter=dashboard typecheck`
Expected: 0 errors.

- [ ] **Step 4: Run the bookings unit tests**

Run: `pnpm --filter=dashboard test -- components/features/bookings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/features/bookings/booking-pos.tsx
git commit -m "feat(bookings): surface client credits in the wizard client step"
```

---

### Task 6: Live verification (definition of done)

**Files:** none — manual + DB assertion.

- [ ] **Step 1: Exercise the full flow live**

Backend :5200, dashboard :5203. Log in as receptionist, open `/bookings?new=1`, select a client with active credits (from Task 0 Step 1). Confirm the credits panel appears in the Client step. Click a usable card; confirm the wizard jumps to the delivery-type/time step with department/category/service/employee/duration pre-filled. Pick delivery type + slot; confirm the matching-credit badge appears and submit.

- [ ] **Step 2: Assert consumption in the DB**

Run the Task 0 Step 3 query. Expected: newest booking `price = 0`, non-null `packageCreditId`, `CONSUMED` usage row, and the credit's `usedQuantity` incremented by 1.

- [ ] **Step 3: Negative check**

Select a client with NO active credits; confirm the panel renders nothing (no empty box).

- [ ] **Step 4: Report**

State explicitly whether live verification passed, with the DB query output. Do not claim done on green unit tests alone.

---

## Notes for the implementer

- Department name fields are assumed `nameAr/nameEn` (matching `ServiceCategory`). If `Department` uses different field names, adjust the select in Task 1 Step 3 and the test mock accordingly.
- If the dashboard `useClientPackagePurchases` returns `{ purchases, isLoading }` under different names, adapt the destructure in Task 4 Step 3 to the actual hook shape (verified to expose a client+query signature).
- Do not touch `matching-credit-badge.tsx`, `book-from-credit.handler.ts`, or the from-credit endpoint — they already work (Task 0 confirms).
