# Booking Wizard — Client Package Credits Panel

**Date:** 2026-06-25
**Status:** Approved design, pending implementation plan
**Surface:** `apps/dashboard` (booking wizard) + `apps/backend` (one endpoint enrichment)

## Goal

In the new-booking wizard (`/bookings?new=1`), as soon as a reception staff
member selects a client, surface that client's **active package credits** as
interactive cards. Clicking a credit card pre-fills department → category →
service → employee → duration in one shot and jumps the wizard to the
delivery-type/time step. The existing free-of-charge consumption flow then
completes the booking at price 0.

This makes "book a session the client already paid for inside a package"
discoverable from the booking wizard, not only from the client detail page.

## Existing behaviour (do not rebuild)

The credit-consumption core already exists:

- `GET /dashboard/bookings/matching-credits` — given
  `{clientId, serviceId, employeeId, durationOptionId}` returns FIFO-ordered
  matching `PackageCredit` rows with `remaining > 0` from `ACTIVE` purchases.
- `matching-credit-badge.tsx` — shows in the DateTime step once all four of
  (client, service, employee, duration) are chosen, and offers "book from
  credit".
- `POST /dashboard/bookings/from-credit` (`BookFromCreditHandler`) — creates a
  `CONFIRMED`, price-0 booking, links `packageCreditId`, records a
  `PackageCreditUsage`, increments `usedQuantity`, auto-completes the purchase
  when its last credit is spent. Has an overdraw guard (`SELECT … FOR UPDATE`)
  and a REFUNDED-purchase guard.

**Concept clarification:** a package credit makes the session **free**
(pre-paid inside the package), price 0 — it is NOT a percentage discount on the
normal booking price. The UI copy must say "استخدام رصيد الباقة" / "مدفوعة
مسبقاً", never "خصم".

## Step 0 — Verify the foundation first (blocking)

Before building anything, verify live that the existing chain works end to end:
select a client with active credits in the wizard, walk to the matching
service/employee/duration, confirm the badge appears and a from-credit booking
is created at price 0 with `usedQuantity` incremented. If this is broken (prior
sessions found similar front/back gate mismatches), fix it first — the whole
feature builds on it.

## Requirements

1. Selecting a client in the wizard shows a panel of the client's usable
   credits (active purchase, `remaining > 0`). No credits → panel renders
   nothing (no empty box).
2. Each credit card shows: package name, service, employee, duration label,
   and `remaining / total` sessions.
3. Clicking a usable card pre-fills the wizard to the credit's target and opens
   the delivery-type/time step. The user only picks delivery type + slot, then
   the existing badge confirms and books free.
4. A card whose service/employee/category is no longer bookable (archived /
   inactive) renders disabled with a short reason, not clickable.
5. The client detail page's existing balances panel is unaffected.

## Design

### Backend — enrich the client-purchases credit row

`ListClientPackagePurchasesHandler`
(`apps/backend/src/modules/finance/package-purchases/list-client-package-purchases/`)
already bulk-resolves service/employee/duration names. Extend the per-credit
row (`ClientPackageCreditRow`) with the wizard-jump fields, resolved from the
service → category → department chain:

- `categoryId: string | null`
- `categoryNameAr: string`, `categoryNameEn: string | null`
- `categoryBookingMode: 'DIRECT' | 'SERVICES' | null`
- `departmentId: string | null`
- `departmentNameAr: string`, `departmentNameEn: string | null`
- `serviceIsBookable: boolean` (service active + not archived; employee active)

Implementation: widen the existing `service.findMany` select to include
`categoryId` + the category relation (`id, nameAr, nameEn, bookingMode,
departmentId` + department `nameAr, nameEn`), plus an `isActive/isArchived`
check for service and employee. Additive fields — the client detail page
ignores them, so no consumer breaks. Reuse the same endpoint
(`GET /dashboard/finance/clients/:clientId/package-purchases`) via the existing
`useClientPackagePurchases` hook; filter to `status=ACTIVE` from the wizard.

### Frontend — state: `applyCreditTarget`

Add one setter to `use-booking-form-state.ts`:

```
applyCreditTarget({
  departmentId, departmentName,
  categoryId, categoryName, categoryBookingMode,
  serviceId, serviceName,
  employeeId, employeeName,
  durationOptionId,
})
```

It sets department + category (+mode) + service + employee + durationOption in a
single `setState`, and clears `deliveryType / type / date / startTime` so the
user finishes those. For a `DIRECT` category the service is the hidden internal
service — same shape `selectCategory` already supports via `autoService`. This
keeps the sequential resets intact (one atomic jump, no cascade of setters
fighting each other).

### Frontend — UI: `client-credits-panel.tsx`

New feature component under `components/features/bookings/`. Renders inside the
Client step, below the selected-client summary, once `state.clientId` is set.

- Data via `useClientPackagePurchases(clientId, { status: 'ACTIVE' })`.
- Flatten purchases → credits, drop `remaining <= 0`.
- One card per credit: package • service • employee • duration • `remaining/total`.
- Usable card → button calling `applyCreditTarget(...)` then opening the
  delivery-type step. Non-bookable (`serviceIsBookable === false`) → disabled
  card with reason ("الخدمة أو الممارس غير متاح حالياً").
- Copy: "استخدام رصيد الباقة" — never "خصم".

### Frontend — wiring in `booking-pos.tsx`

- Pass an `onUseCredit(target)` down to the panel that calls
  `applyCreditTarget(target)` then `setOpenSection('typeDuration')` (the wizard
  jumps past department/category/service/employee, which are now filled).
- The existing `matching-credit-badge` keeps working unchanged: once the user
  adds delivery type + duration resolves, the four-key lookup matches and the
  free booking confirms.

## Edge cases

- No usable credits → panel renders nothing.
- `remaining = 0` credit → hidden.
- `REFUNDED` / `COMPLETED` purchase → excluded (query `status=ACTIVE`; backend
  from-credit also re-guards REFUNDED).
- Archived service / inactive employee → disabled card (`serviceIsBookable`).
- DIRECT category → jump sets category in DIRECT mode with the hidden service as
  `autoService`; wizard opens at delivery-type.
- Client changed after a jump → `selectClient` already resets everything; panel
  re-queries for the new client.

## Testing

- Backend: extend `list-client-package-purchases.handler.spec.ts` — assert the
  new category/department/`serviceIsBookable` fields are resolved, and that an
  archived service yields `serviceIsBookable: false`.
- Frontend: unit test `applyCreditTarget` sets the five fields and clears
  delivery/date/time. Component test for `client-credits-panel` (usable vs
  disabled card, empty → nothing).
- Live (definition of done): in the wizard, pick a client with credits, click a
  card, confirm the jump + free booking, and verify `usedQuantity` incremented
  and a `PackageCreditUsage` row created.

## Out of scope

- Percentage/amount discounts from packages (not how session credits work).
- Credit transfer / refund UI in the wizard.
- Partial-session consumption.
- Any change to the client detail page balances panel beyond the additive
  endpoint fields.
