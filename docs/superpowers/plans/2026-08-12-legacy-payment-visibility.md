# Legacy Payment Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display Booknetic payment states accurately and add separate read-only historical collection statistics without creating operational finance records.

**Architecture:** A pure booking helper parses `LegacyImportRecord.metadata` into a typed historical payment projection. Booking list/detail handlers load those records in bulk or by booking, while payment statistics aggregate the same ledger with explicit conservative classification. The dashboard renders the projection and suppresses all mutable actions for historical bookings.

**Tech Stack:** NestJS 11, Prisma 7, Jest, Next.js 15, React 19, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-12-legacy-payment-visibility-design.md`

## Global Constraints

- Do not create, update, or delete production data as part of this code change.
- Do not create operational invoices or payments for imported historical bookings.
- Keep operational payment totals separate from historical collection totals.
- Preserve source payment status and amount; classify ambiguous paid records as review-required.
- Use additive API changes and regenerate the committed OpenAPI snapshot.

---

### Task 1: Historical payment projection

**Files:**
- Create: `apps/backend/src/modules/bookings/historical-payment.helper.ts`
- Create: `apps/backend/src/modules/bookings/historical-payment.helper.spec.ts`
- Modify: `apps/backend/src/modules/bookings/booking-row.mapper.ts`
- Modify: `apps/backend/src/modules/bookings/booking-row.mapper.spec.ts`

**Interfaces:**
- Produces: `HistoricalPaymentProjection`, `mapHistoricalPayment(metadata, bookingStatus)`, and `historicalPaymentsByBookingId` on `BookingRelations`.
- Produces: booking response properties `isHistoricalImport` and `historicalPayment`.

- [ ] **Step 1: Write failing helper and mapper tests** for status normalization, amount conversion, review classification, and response projection.
- [ ] **Step 2: Run `pnpm --filter=backend test -- src/modules/bookings/historical-payment.helper.spec.ts src/modules/bookings/booking-row.mapper.spec.ts`** and confirm the failures are caused by missing projection behavior.
- [ ] **Step 3: Implement the pure helper and mapper fields** with no database writes.
- [ ] **Step 4: Re-run the two test files** and confirm they pass.

### Task 2: Load legacy metadata for booking list and detail

**Files:**
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.spec.ts`

**Interfaces:**
- Consumes: `mapHistoricalPayment` and `historicalPaymentsByBookingId` from Task 1.
- Produces: list/detail booking responses populated from `LegacyImportRecord` by `targetId`.

- [ ] **Step 1: Write failing list/detail tests** proving historical metadata is loaded while normal bookings remain null.
- [ ] **Step 2: Run the focused handler tests** and verify the expected failures.
- [ ] **Step 3: Add bulk list loading and single detail loading** restricted to Booknetic appointment import records.
- [ ] **Step 4: Re-run the focused handler tests** and confirm they pass.

### Task 3: Enforce read-only historical finance

**Files:**
- Modify: `apps/backend/src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.ts`
- Modify: `apps/backend/src/modules/finance/ensure-booking-invoice/ensure-booking-invoice.handler.spec.ts`

**Interfaces:**
- Consumes: `Booking.isHistoricalImport`.
- Produces: a `BadRequestException` before any invoice write for historical bookings.

- [ ] **Step 1: Write a failing test** asserting an imported historical booking cannot materialize an invoice.
- [ ] **Step 2: Run the focused handler test** and confirm it currently allows the operation.
- [ ] **Step 3: Add the historical guard before invoice lookup/creation.**
- [ ] **Step 4: Re-run the focused handler test** and confirm it passes.

### Task 4: Separate historical statistics

**Files:**
- Modify: `apps/backend/src/modules/finance/get-payment-stats/get-payment-stats.handler.ts`
- Modify: `apps/backend/src/modules/finance/get-payment-stats/get-payment-stats.handler.spec.ts`

**Interfaces:**
- Produces: `PaymentStats.historical` with `collectedCount`, `collectedAmount`, `reviewCount`, and `reviewAmount`, all amounts in halalas.

- [ ] **Step 1: Write failing aggregation tests** covering confirmed paid, cancelled paid, no-show paid, pending, not-paid, and canceled source states.
- [ ] **Step 2: Run the focused statistics test** and confirm the nested summary is missing.
- [ ] **Step 3: Implement a read-only aggregate over `LegacyImportRecord` joined to `Booking`** while leaving operational groupBy logic unchanged.
- [ ] **Step 4: Re-run the focused statistics test** and confirm it passes.

### Task 5: Dashboard display and action suppression

**Files:**
- Modify: `apps/dashboard/lib/types/booking.ts`
- Modify: `apps/dashboard/components/features/bookings/booking-column-cells.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-columns.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-details-body.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-detail-sheet.tsx`
- Modify: `apps/dashboard/components/features/bookings/booking-actions.tsx`
- Modify: `apps/dashboard/components/features/bookings/bookings-tab-content.tsx`
- Modify: `apps/dashboard/lib/translations/ar.bookings.ts`
- Modify: `apps/dashboard/lib/translations/en.bookings.ts`
- Test: `apps/dashboard/test/unit/features/bookings/historical-payment.spec.tsx`

**Interfaces:**
- Consumes: booking `isHistoricalImport` and `historicalPayment` from Tasks 1-2.
- Produces: read-only legacy badges/details and no mutable controls for historical bookings.

- [ ] **Step 1: Write failing component tests** for labels, amount preference, payment-control suppression, and historical action suppression.
- [ ] **Step 2: Run the focused dashboard test** and confirm it fails for the missing behavior.
- [ ] **Step 3: Add types, bilingual copy, rendering, and guards** without mapping legacy data into `payment`.
- [ ] **Step 4: Re-run the focused dashboard test and `pnpm --filter=dashboard run i18n:verify`** and confirm both pass.

### Task 6: Historical statistics cards

**Files:**
- Modify: `apps/dashboard/lib/types/payment.ts`
- Modify: `apps/dashboard/lib/api/payments.ts`
- Modify: `apps/dashboard/hooks/use-payments.ts`
- Create: `apps/dashboard/components/features/payments/historical-payment-stats.tsx`
- Modify: `apps/dashboard/components/features/payments/payment-list-page.tsx`
- Modify: `apps/dashboard/lib/query-keys.ts`
- Modify: `apps/dashboard/lib/translations/ar.finance.ts`
- Modify: `apps/dashboard/lib/translations/en.finance.ts`
- Test: `apps/dashboard/test/unit/features/payments/historical-payment-stats.spec.tsx`

**Interfaces:**
- Consumes: `PaymentStats.historical` from Task 4.
- Produces: two separate read-only cards for confirmed legacy collections and review-required legacy amounts.

- [ ] **Step 1: Write a failing component test** proving historical values are labelled separately and never presented as total operational revenue.
- [ ] **Step 2: Run the focused dashboard test** and confirm the component is missing.
- [ ] **Step 3: Add the stats query, focused component, and bilingual labels.**
- [ ] **Step 4: Re-run the focused component test and i18n parity** and confirm both pass.

### Task 7: Contract and verification gates

**Files:**
- Modify: `apps/backend/openapi.json` via the project generator.
- Modify: generated dashboard API types if the sync command changes them.

**Interfaces:**
- Produces: committed API snapshot matching the additive response fields.

- [ ] **Step 1: Run all focused backend and dashboard tests from Tasks 1-6.**
- [ ] **Step 2: Run `pnpm openapi:sync`.**
- [ ] **Step 3: Run `pnpm --filter=backend run typecheck`, `pnpm --filter=dashboard run typecheck`, `pnpm --filter=dashboard run lint`, and `pnpm --filter=dashboard run i18n:verify`.**
- [ ] **Step 4: Run backend tests, dashboard tests, and `pnpm --filter=dashboard run e2e:smoke`; report any environment-only blocker distinctly.**
- [ ] **Step 5: Inspect `git diff --check`, file-size limits, and the final diff against the specification before committing.**
