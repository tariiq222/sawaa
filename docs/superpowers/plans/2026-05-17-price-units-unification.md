# Price Units Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every monetary value across the Sawa monorepo to a single canonical unit — integer halalas — eliminating the double-×100 bug in the Moyasar payment path and the SAR/halalas ambiguity scattered across backend, dashboard, and mobile.

**Architecture:** The database already stores Service/Booking/Invoice amounts as halalas (confirmed: the dashboard applies `sarToHalalas` before save, and `PriceResolverService` + `create-booking` pass values through untouched). The bug is in the *payment egress*: `init-client-payment`, `init-guest-payment`, and `moyasar-webhook` multiply an already-halalas `Invoice.total` by 100 again, and `get-booking`/`list-bookings` multiply `Payment.amount` by 100. The fix is to *remove* the redundant conversions, make `Payment.amount` consistently store halalas, add a single shared money module, and lock the convention with a CHECK-style guard plus tests. Schema `Decimal(12,2)` columns are kept (they already hold integer values); we add explicit documentation and integer validation rather than risk a destructive type-change migration.

**Tech Stack:** NestJS 11 + Prisma 7 (backend), Next.js 15 (dashboard), Expo/React Native (mobile), Jest, pnpm workspaces.

---

## Canonical Decision

**The canonical monetary unit everywhere is the integer halala.** 1 SAR = 100 halalas. A price of 120 SAR is stored, transmitted, and computed as the integer `12000`. Conversion to a SAR-major display string (`"120.00"`) happens *only* at the UI render boundary. `vatRate` is a rate (`Decimal(5,4)`, e.g. `0.15`) — it is NOT money and is unchanged by this plan.

**Current truth (verified):**
- `Service.price`, `ServiceDurationOption.price`, `ServiceBookingConfig.price`, `Booking.price`, `Invoice.subtotal`, `Invoice.total`, `Invoice.vatAmt`, `Invoice.discountAmt` — already stored as **halalas**.
- `Payment.amount` — inconsistently stored: the webhook path writes SAR (`payload.amount / 100`), the init path writes halalas (`invoice.total`). After this plan: always **halalas**.
- `bookings-stats.handler.ts` is the only handler currently consistent with the real stored unit.

---

## Task 1: Create the shared money module

**Files:**
- Create: `packages/shared/money/index.ts`
- Modify: `packages/shared/index.ts`
- Test: `packages/shared/money/money.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/money/money.test.ts
import { describe, it, expect } from "@jest/globals";
import {
  HALALAS_PER_SAR,
  sarToHalalas,
  halalasToSar,
  formatHalalas,
  isValidHalalas,
} from "./index";

describe("money", () => {
  it("HALALAS_PER_SAR is 100", () => {
    expect(HALALAS_PER_SAR).toBe(100);
  });

  it("sarToHalalas converts and rounds to integer halalas", () => {
    expect(sarToHalalas(120)).toBe(12000);
    expect(sarToHalalas(0.1)).toBe(10);
    expect(sarToHalalas(49.999)).toBe(5000);
  });

  it("halalasToSar returns a SAR-major number", () => {
    expect(halalasToSar(12000)).toBe(120);
    expect(halalasToSar(10)).toBe(0.1);
  });

  it("formatHalalas renders a SAR string with 2 decimals", () => {
    expect(formatHalalas(12000, { locale: "en" })).toBe("120.00");
    expect(formatHalalas(0, { locale: "en" })).toBe("0.00");
  });

  it("isValidHalalas rejects non-integers and negatives", () => {
    expect(isValidHalalas(12000)).toBe(true);
    expect(isValidHalalas(0)).toBe(true);
    expect(isValidHalalas(120.5)).toBe(false);
    expect(isValidHalalas(-1)).toBe(false);
    expect(isValidHalalas(Number.NaN)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter @sawaa/shared exec jest money/money.test.ts`
Expected: FAIL — cannot find module `./index` exports.

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/money/index.ts
//
// Canonical monetary module for the Sawa monorepo.
//
// THE CANONICAL UNIT IS THE INTEGER HALALA. 1 SAR = 100 halalas.
// Every monetary value in the database, in API payloads, and in business
// logic is an integer count of halalas. SAR-major numbers/strings exist
// ONLY at the UI render boundary, produced by formatHalalas().
//
// Do not introduce a second money helper. Import from "@sawaa/shared/money".

export const HALALAS_PER_SAR = 100;

/** Convert a SAR-major number (e.g. user input 120.5) to integer halalas. */
export function sarToHalalas(sar: number): number {
  return Math.round(sar * HALALAS_PER_SAR);
}

/** Convert integer halalas to a SAR-major number (e.g. 12000 -> 120). */
export function halalasToSar(halalas: number): number {
  return halalas / HALALAS_PER_SAR;
}

export interface FormatHalalasOptions {
  /** BCP-47 locale for digit grouping. Defaults to "en". */
  locale?: string;
  /** Number of fraction digits. Defaults to 2. */
  decimals?: number;
}

/** Render integer halalas as a localized SAR-major string (no currency symbol). */
export function formatHalalas(
  halalas: number,
  { locale = "en", decimals = 2 }: FormatHalalasOptions = {},
): string {
  return halalasToSar(halalas).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** True when the value is a non-negative integer count of halalas. */
export function isValidHalalas(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
```

- [ ] **Step 4: Export the module from the package barrel**

Add this line to `packages/shared/index.ts` (append after the last existing export):

```typescript
export * from "./money";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter @sawaa/shared exec jest money/money.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/money/index.ts packages/shared/money/money.test.ts packages/shared/index.ts
git commit -m "feat(shared): add canonical money module (integer halalas)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix the double-×100 bug in the Moyasar init paths

**Files:**
- Modify: `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.ts:88`
- Modify: `apps/backend/src/modules/finance/payments/public/init-guest-payment/init-guest-payment.handler.ts:66`
- Test: `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.spec.ts`

**Context:** `Invoice.total` is already stored in halalas. Moyasar's API expects the amount in halalas. The current code does `Math.round(Number(invoice.total) * 100)` — a redundant ×100 that bills the customer 100× the real amount. The amount sent to Moyasar must equal `Number(invoice.total)` directly (it is already halalas).

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.spec.ts`. First READ the existing handler file in full to learn its constructor dependencies and the exact name/shape of the Moyasar client method it calls, then mirror the project's existing spec style (plain Jest, hand-built mocks cast as `never` — see `apps/backend/src/modules/org-experience/services/price-resolver.service.spec.ts` for the pattern). The single assertion that MUST be present:

```typescript
// the amount handed to the Moyasar client must equal invoice.total verbatim
// (invoice.total is already in halalas — NO extra ×100)
expect(moyasarClient.createPayment).toHaveBeenCalledWith(
  expect.objectContaining({ amountHalalas: 12000 }),
);
// with an Invoice whose total is the integer 12000
```

Build the mock `Invoice` with `total: new Prisma.Decimal(12000)` (or `12000` if the handler does `Number(...)` — match the handler). Assert the handler does NOT send `1200000`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest init-client-payment.handler.spec.ts`
Expected: FAIL — handler sends `1200000`, test expects `12000`.

- [ ] **Step 3: Fix `init-client-payment.handler.ts`**

At line 88, replace:

```typescript
const amountHalalas = Math.round(Number(invoice.total) * 100);
```

with:

```typescript
// invoice.total is already stored in halalas — send it to Moyasar verbatim.
const amountHalalas = Math.round(Number(invoice.total));
```

- [ ] **Step 4: Fix `init-guest-payment.handler.ts`**

At line 66, replace:

```typescript
const amountHalalas = Math.round(Number(invoice.total) * 100);
```

with:

```typescript
// invoice.total is already stored in halalas — send it to Moyasar verbatim.
const amountHalalas = Math.round(Number(invoice.total));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest init-client-payment.handler.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/finance/payments
git commit -m "fix(payments): remove redundant x100 in Moyasar init amount

Invoice.total is already stored in halalas; the extra x100 billed
customers 100x the real amount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Fix the webhook amount validation and Payment.amount unit

**Files:**
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts:146`
- Modify: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts:169`
- Test: `apps/backend/src/modules/finance/moyasar-webhook/moyasar-webhook.handler.spec.ts`

**Context:** The webhook does `expectedHalalas = Math.round(Number(invoice.total) * 100)` — the same redundant ×100; it currently "passes" only because init had the matching bug. After Task 2, this must compare against `Number(invoice.total)` directly. Separately, line 169 does `amountSar = payload.amount / 100` and stores SAR into `Payment.amount`; it must store halalas (`payload.amount` is already halalas from Moyasar).

- [ ] **Step 1: Write the failing test**

Create `moyasar-webhook.handler.spec.ts`. READ the handler in full first for its dependencies and `verifySignature` seam. Mirror the project spec style. Required assertions:
- Given an `Invoice` with `total = 12000` (halalas) and a webhook `payload.amount = 12000`, the handler accepts it (amount matches).
- The persisted `Payment.amount` equals `12000` (halalas), NOT `120`.
- Given `payload.amount = 1200000`, the handler rejects the amount mismatch.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest moyasar-webhook.handler.spec.ts`
Expected: FAIL — handler expects `1200000` and stores `120`.

- [ ] **Step 3: Fix the amount comparison at line 146**

Replace:

```typescript
const expectedHalalas = Math.round(Number(invoice.total) * 100);
```

with:

```typescript
// invoice.total is already in halalas; Moyasar payload.amount is in halalas.
const expectedHalalas = Math.round(Number(invoice.total));
```

- [ ] **Step 4: Fix the Payment.amount persistence at line 169**

Replace:

```typescript
const amountSar = payload.amount / 100;
```

with:

```typescript
// Payment.amount is stored in halalas — payload.amount is already halalas.
const amountHalalas = payload.amount;
```

Then update every later reference to `amountSar` in this file to `amountHalalas` (search the file for `amountSar` and replace all occurrences — there is the declaration plus its use in the `payment.upsert` data).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest moyasar-webhook.handler.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/finance/moyasar-webhook
git commit -m "fix(payments): webhook stores Payment.amount in halalas, drops x100

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Fix Payment.amount readers in booking handlers

**Files:**
- Modify: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.ts:61-62`
- Modify: `apps/backend/src/modules/bookings/list-bookings/list-bookings.handler.ts:128-129`
- Modify: `apps/backend/src/modules/bookings/booking-row.mapper.ts:6`
- Test: `apps/backend/src/modules/bookings/get-booking/get-booking.handler.spec.ts`

**Context:** These handlers do `Math.round(Number(p.amount) * 100)` to convert a (wrongly assumed) SAR `Payment.amount` to halalas for the API response. After Task 3, `Payment.amount` is already halalas — the ×100 must be removed.

- [ ] **Step 1: Write the failing test**

Create `get-booking.handler.spec.ts` (mirror project spec style; READ the handler first). Assert: given a `Payment` with `amount = 12000` (halalas), the API response's payment `amount` field equals `12000`, not `1200000`. Same for `refundedAmount`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest get-booking.handler.spec.ts`
Expected: FAIL — handler returns `1200000`.

- [ ] **Step 3: Fix `get-booking.handler.ts` lines 61-62**

Replace:

```typescript
        amount: Math.round(Number(p.amount) * 100),
        refundedAmount: Math.round(Number(p.refundedAmount) * 100),
```

with:

```typescript
        amount: Math.round(Number(p.amount)),
        refundedAmount: Math.round(Number(p.refundedAmount)),
```

- [ ] **Step 4: Fix `list-bookings.handler.ts` lines 128-129**

Replace:

```typescript
        amount: Math.round(Number(p.amount) * 100),         // SAR → halalat
        refundedAmount: Math.round(Number(p.refundedAmount) * 100), // SAR → halalat
```

with:

```typescript
        amount: Math.round(Number(p.amount)),         // already halalas
        refundedAmount: Math.round(Number(p.refundedAmount)), // already halalas
```

- [ ] **Step 5: Fix the comment in `booking-row.mapper.ts:6`**

Replace the comment `// halalat (SAR Decimal × 100)` with `// halalas (Payment.amount is stored in halalas)`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest get-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/bookings
git commit -m "fix(bookings): drop x100 on Payment.amount readers (now halalas)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Fix refund amount conversions

**Files:**
- Modify: `apps/backend/src/modules/finance/refund-payment/refund-payment.handler.ts:89,254,399`
- Modify: `apps/backend/src/modules/finance/refund-payment/approve-refund.handler.ts:76`
- Test: `apps/backend/src/modules/finance/refund-payment/refund-payment.handler.spec.ts`

**Context:** These sites do `Math.round(amount * 100)` to convert a refund amount to halalas before calling Moyasar. `RefundRequest.amount` and `Payment.amount` are stored in halalas; Moyasar expects halalas. Remove the ×100.

- [ ] **Step 1: READ all three handler files in full** to confirm, for each `* 100` site, that the variable being multiplied is sourced from `RefundRequest.amount`, `Payment.amount`, or the refund DTO `amount` — all of which are halalas. Note each line.

- [ ] **Step 2: Write the failing test**

Create `refund-payment.handler.spec.ts` (mirror project spec style). Assert: refunding a `Payment` of `12000` halalas in full calls the Moyasar client with `amountHalalas: 12000`, not `1200000`.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest refund-payment.handler.spec.ts`
Expected: FAIL — handler sends `1200000`.

- [ ] **Step 4: Fix `refund-payment.handler.ts`**

Line 89 — replace `amount: Math.round(amount * 100),` with `amount: Math.round(amount), // already halalas`.
Line 254 — replace `amount: Math.round(Number(refundReq.amount) * 100),` with `amount: Math.round(Number(refundReq.amount)), // already halalas`.
Line 399 — replace `amount: Math.round(refundAmount * 100),` with `amount: Math.round(refundAmount), // already halalas`.

- [ ] **Step 5: Fix `approve-refund.handler.ts:76`**

Replace `amount: Math.round(Number(refundRequest.amount) * 100),` with `amount: Math.round(Number(refundRequest.amount)), // already halalas`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest refund-payment.handler.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/finance/refund-payment
git commit -m "fix(payments): drop x100 on refund amounts (already halalas)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Fix create-guest-booking totalHalalat return value

**Files:**
- Modify: `apps/backend/src/modules/bookings/public/create-guest-booking.handler.ts:251`
- Test: `apps/backend/src/modules/bookings/public/create-guest-booking.handler.spec.ts`

**Context:** Line 251 returns `totalHalalat: Math.round(total.toNumber() * 100)`. `total` is built from `subtotal` which is halalas — the ×100 is redundant.

- [ ] **Step 1: Write the failing test**

Create `create-guest-booking.handler.spec.ts` (mirror project spec style; READ handler first). Assert: a booking whose service price is `12000` halalas yields a response `totalHalalat` of `13800` (12000 + 15% VAT), NOT `1380000`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-guest-booking.handler.spec.ts`
Expected: FAIL — returns `1380000`.

- [ ] **Step 3: Fix line 251**

Replace:

```typescript
      return { bookingId: booking.id, invoiceId: invoice.id, totalHalalat: Math.round(total.toNumber() * 100) };
```

with:

```typescript
      // total is already in halalas
      return { bookingId: booking.id, invoiceId: invoice.id, totalHalalat: Math.round(total.toNumber()) };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-guest-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/public/create-guest-booking.handler.ts
git commit -m "fix(bookings): drop x100 on guest booking totalHalalat

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Fix VAT rounding to whole halalas

**Files:**
- Modify: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts:40`
- Modify: `apps/backend/src/modules/bookings/create-bundle-booking/create-bundle-booking.handler.ts:38,223-231`
- Modify: `apps/backend/src/modules/org-experience/bundles/bundle-price.service.ts:5`
- Test: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts`

**Context:** `roundMoney` (`create-booking:40`) does `.toDecimalPlaces(2)` and `round2` (`create-bundle-booking:38`, `bundle-price.service:5`) does `Math.round(n*100)/100`. Both round to 2 *SAR decimals* — but with halalas the canonical unit, money must round to whole integers (0 decimals). A VAT of `12000 * 0.15 = 1800` is already integer, but a price of `9990 * 0.15 = 1498.5` must become `1499`, not `1498.50`.

- [ ] **Step 1: Write the failing test**

Add a test to `create-booking.handler.spec.ts` (create the file if absent, mirror project style; READ handler first). Assert: a booking with `price = 9990` halalas produces an `Invoice` with integer `vatAmt` (`Number.isInteger(invoice.vatAmt)` true) and `total` integer. With 15% VAT, `vatAmt` should be `1499` (9990×0.15=1498.5 rounds to 1499) and `total` `11489`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-booking.handler.spec.ts`
Expected: FAIL — `vatAmt` is `1498.5`.

- [ ] **Step 3: Fix `roundMoney` in `create-booking.handler.ts:40`**

Replace:

```typescript
const roundMoney = (amount: Prisma.Decimal | number): Prisma.Decimal =>
  new Prisma.Decimal(amount.toString()).toDecimalPlaces(2);
```

with:

```typescript
// Money is integer halalas — round to whole halalas (0 decimal places).
const roundMoney = (amount: Prisma.Decimal | number): Prisma.Decimal =>
  new Prisma.Decimal(amount.toString()).toDecimalPlaces(0);
```

- [ ] **Step 4: Fix `round2` in `create-bundle-booking.handler.ts:38`**

Replace:

```typescript
  return Math.round(n * 100) / 100;
```

(inside the `round2` helper) with:

```typescript
  return Math.round(n);
```

Then rename the helper from `round2` to `roundHalalas` at its declaration and every call site within `create-bundle-booking.handler.ts` (search the file for `round2`).

- [ ] **Step 5: Fix the VAT block in `create-bundle-booking.handler.ts:223-231`**

The three `Math.round(... * 100) / 100` expressions at lines 223-231 must become `Math.round(...)`. Replace:

```typescript
          const vatAmt = new Prisma.Decimal(
            (Math.round(vatBase.toNumber() * vatRate.toNumber() * 100) / 100).toString(),
          );
          const total = new Prisma.Decimal(
            (Math.round((vatBase.toNumber() + vatAmt.toNumber()) * 100) / 100).toString(),
          );
          const discountAmt = new Prisma.Decimal(
            (Math.round((subtotal - finalPrice) * 100) / 100).toString(),
          );
```

with:

```typescript
          const vatAmt = new Prisma.Decimal(
            Math.round(vatBase.toNumber() * vatRate.toNumber()).toString(),
          );
          const total = new Prisma.Decimal(
            Math.round(vatBase.toNumber() + vatAmt.toNumber()).toString(),
          );
          const discountAmt = new Prisma.Decimal(
            Math.round(subtotal - finalPrice).toString(),
          );
```

- [ ] **Step 6: Fix `round2` in `bundle-price.service.ts:5`**

Replace:

```typescript
  return Math.round(n * 100) / 100;
```

with:

```typescript
  return Math.round(n);
```

Rename the helper from `round2` to `roundHalalas` at its declaration and every call site in `bundle-price.service.ts`. NOTE: line 30 `discountAmount = round2(subtotal * cappedPct / 100)` — the `/ 100` here is a *percentage divisor* (cappedPct is 0-100), NOT a unit conversion. Keep the `/ 100`; only the outer `round2` → `roundHalalas` changes. Result: `discountAmount = roundHalalas(subtotal * cappedPct / 100)`.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/bookings/create-booking apps/backend/src/modules/bookings/create-bundle-booking apps/backend/src/modules/org-experience/bundles
git commit -m "fix(bookings): round money to whole halalas, not 2 SAR decimals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Remove the obsolete /100 in bookings-stats

**Files:**
- Modify: `apps/backend/src/modules/bookings/bookings-stats/bookings-stats.handler.ts:31-43`
- Test: `apps/backend/src/modules/bookings/bookings-stats/bookings-stats.handler.spec.ts`

**Context:** `bookings-stats` currently divides revenue by 100 to convert (correctly-stored) halalas to SAR for its response. The unification goal is that *every API field is halalas*; the dashboard does the display conversion. So `revenueToday` must be returned as halalas — drop the `/100`.

- [ ] **Step 1: Write the failing test**

Create `bookings-stats.handler.spec.ts` (mirror project style; READ handler first). Assert: with two bookings of `price = 12000` and `price = 8000` halalas today, `revenueToday` equals `20000` (halalas), NOT `200`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest bookings-stats.handler.spec.ts`
Expected: FAIL — returns `200`.

- [ ] **Step 3: Fix lines 31-43**

Replace:

```typescript
    // price is Decimal — convert to number. Runtime convention is halalas-as-
    // Decimal (see docs/superpowers/tech-debt/price-units-*), so divide by 100
    // before returning SAR. TODO(price-units): remove /100 after unification.
    const rawRevenue = revenueAgg._sum.price;
    const revenueSarMajor = rawRevenue instanceof Prisma.Decimal
      ? rawRevenue.toNumber() / 100
      : Number(rawRevenue ?? 0) / 100;

    return {
      todayCount,
      pendingCount,
      completedToday,
      revenueToday: Math.round(revenueSarMajor * 100) / 100,
    };
```

with:

```typescript
    // Booking.price is stored in halalas; revenueToday is returned in halalas.
    // The dashboard converts to a SAR display string at render time.
    const rawRevenue = revenueAgg._sum.price;
    const revenueHalalas = rawRevenue instanceof Prisma.Decimal
      ? rawRevenue.toNumber()
      : Number(rawRevenue ?? 0);

    return {
      todayCount,
      pendingCount,
      completedToday,
      revenueToday: Math.round(revenueHalalas),
    };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest bookings-stats.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/bookings-stats
git commit -m "fix(stats): return revenueToday in halalas, drop /100

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Enforce integer halalas in service DTOs

**Files:**
- Modify: `apps/backend/src/modules/org-experience/services/create-service.dto.ts:37-38,64-66`
- Test: `apps/backend/src/modules/org-experience/services/create-service.dto.spec.ts`

**Context:** `price` and `depositAmount` are `@IsNumber()` — they accept `120.5`. Since the canonical unit is integer halalas, fractional values are invalid. Change to `@IsInt()`.

- [ ] **Step 1: Write the failing test**

Create `create-service.dto.spec.ts`. Use `class-validator`'s `validate` against a plain object transformed via `plainToInstance` (check for `class-transformer` already in the backend deps — it is, NestJS bundles it). Assert: `price: 120.5` produces a validation error on `price`; `price: 12000` produces none. Same for `depositAmount`.

```typescript
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateServiceDto } from "./create-service.dto";

it("rejects a fractional price (must be integer halalas)", async () => {
  const dto = plainToInstance(CreateServiceDto, { /* ...minimal valid fields..., */ price: 120.5 });
  const errors = await validate(dto);
  expect(errors.some((e) => e.property === "price")).toBe(true);
});
```

READ the DTO first to populate the minimal valid sibling fields so only `price` fails.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-service.dto.spec.ts`
Expected: FAIL — `@IsNumber()` accepts `120.5`.

- [ ] **Step 3: Fix the DTO**

At line 37-38, replace:

```typescript
  @ApiProperty({ example: 50 })
  @IsNumber() @Min(0) price!: number;
```

with:

```typescript
  @ApiProperty({ example: 5000, description: "Price in integer halalas (1 SAR = 100)" })
  @IsInt() @Min(0) price!: number;
```

At line 64-66, replace:

```typescript
  @ApiPropertyOptional({ description: 'Fixed deposit amount — must not exceed price' })
  @ValidateIf((o: CreateServiceDto) => o.depositEnabled === true)
  @IsNumber() @Min(0) depositAmount?: number;
```

with:

```typescript
  @ApiPropertyOptional({ description: 'Fixed deposit amount in integer halalas — must not exceed price' })
  @ValidateIf((o: CreateServiceDto) => o.depositEnabled === true)
  @IsInt() @Min(0) depositAmount?: number;
```

Ensure `IsInt` is imported from `class-validator` at the top of the file (add to the existing import; remove `IsNumber` only if no longer used elsewhere in the file — check first).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm exec jest create-service.dto.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/org-experience/services/create-service.dto.ts apps/backend/src/modules/org-experience/services/create-service.dto.spec.ts
git commit -m "feat(services): enforce integer halalas in service DTO

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Point dashboard money helper at the shared module

**Files:**
- Modify: `apps/dashboard/lib/money.ts`
- Test: `apps/dashboard/lib/money.test.ts`

**Context:** The dashboard has its own `lib/money.ts`. To keep one source of truth, re-export the shared module. Keep the existing function names (`sarToHalalas`, `halalasToSar`, `halalasToSarNumber`, `formatPrice`, `HALALAS_PER_SAR`) as thin aliases so no call site breaks.

- [ ] **Step 1: READ `apps/dashboard/lib/money.ts` in full** and list every exported name and its signature. Confirm `apps/dashboard` can import `@sawaa/shared/money` (check `apps/dashboard/tsconfig.json` paths / `package.json` dependency on `@sawaa/shared` — it depends on the workspace package; the subpath `@sawaa/shared/money` resolves via the package `exports` or the file path).

- [ ] **Step 2: Write the failing test**

Create `apps/dashboard/lib/money.test.ts`:

```typescript
import { sarToHalalas, halalasToSar, formatPrice, HALALAS_PER_SAR } from "./money";

it("re-exports shared money behavior", () => {
  expect(HALALAS_PER_SAR).toBe(100);
  expect(sarToHalalas(120)).toBe(12000);
  expect(halalasToSar(12000)).toBe(120);
  expect(formatPrice(12000, { locale: "en" })).toBe("120.00");
});
```

- [ ] **Step 3: Run test to verify it fails or passes**

Run: `cd /Users/tariq/code/sawaa/apps/dashboard && pnpm exec jest lib/money.test.ts`
Expected: behavior already matches (the dashboard module is correct today) — if the dashboard has no jest setup, skip running and rely on `pnpm typecheck` in Step 5 instead. Note which.

- [ ] **Step 4: Rewrite `apps/dashboard/lib/money.ts`**

Replace the whole file with:

```typescript
// Dashboard money helpers — thin re-export of the canonical shared module.
// Do not add logic here; the source of truth is @sawaa/shared/money.
import {
  HALALAS_PER_SAR,
  sarToHalalas,
  halalasToSar,
  formatHalalas,
  type FormatHalalasOptions,
} from "@sawaa/shared/money";

export { HALALAS_PER_SAR, sarToHalalas, halalasToSar };

/** Back-compat alias — halalasToSar returns a number. */
export const halalasToSarNumber = halalasToSar;

/** Back-compat alias — formatPrice(halalas, opts) renders a SAR display string. */
export function formatPrice(halalas: number, opts?: FormatHalalasOptions): string {
  return formatHalalas(halalas, opts);
}
```

- [ ] **Step 5: Verify the dashboard still type-checks**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter dashboard typecheck`
Expected: PASS — all existing `sarToHalalas` / `halalasToSar` / `formatPrice` call sites still resolve.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/lib/money.ts apps/dashboard/lib/money.test.ts
git commit -m "refactor(dashboard): money.ts re-exports shared canonical module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Fix dashboard employee-service price conversion gap

**Files:**
- Modify: `apps/dashboard/components/features/employees/edit-employee-service-sheet.tsx:88,96`
- Modify: `apps/dashboard/components/features/employees/assign-service-sheet.tsx`
- Test: manual via typecheck + a focused unit test if a test harness exists

**Context:** Service forms convert SAR input → halalas via `sarToHalalas` before submit, but the employee-service sheets pass `price` through raw. The form inputs collect SAR-major numbers; they must be converted to halalas before hitting the API, and server halalas must be converted back to SAR for the input default value.

- [ ] **Step 1: READ both files in full.** Identify (a) where the form's submit payload is assembled (the `price` fields at `edit-employee-service-sheet.tsx:88,96`), and (b) where server data populates the form's default values. Confirm the form `<input>` for price uses `step="0.01"` (SAR-major input) — consistent with `booking-type-row.tsx`.

- [ ] **Step 2: Write the failing test (if a jest harness exists for dashboard components)**

If `apps/dashboard` has component tests, write one asserting the submit payload converts `price: 120` (SAR input) to `12000` (halalas). If no harness exists, SKIP this step and note: "verified via typecheck + reasoning; no dashboard component test harness."

- [ ] **Step 3: Apply `sarToHalalas` on submit**

In `edit-employee-service-sheet.tsx`, wherever the submit payload sets `price: et.price` (line 88) and `price: o.price` (line 96), wrap with `sarToHalalas(...)` guarding null:

```typescript
        price: et.price != null ? sarToHalalas(et.price) : null,
```

```typescript
          price: o.price != null ? sarToHalalas(o.price) : null,
```

Add `import { sarToHalalas, halalasToSarNumber } from "@/lib/money";` if not already imported.

- [ ] **Step 4: Apply `halalasToSarNumber` when loading server values into the form**

In the same file, find where server `price` values populate the form default state and wrap each with `halalasToSarNumber(...)` (guard null → keep null). This mirrors `booking-types-editor.tsx:206,213`.

- [ ] **Step 5: Check `assign-service-sheet.tsx`**

`assign-service-sheet.tsx:94-95` initializes `price: null` for new rows — no conversion needed for nulls. But locate any submit path in that file that sends a user-entered `price`; if found, apply `sarToHalalas` the same way. If the file only ever initializes `null` and delegates submission to a shared helper, note that and make no change.

- [ ] **Step 6: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter dashboard typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/features/employees
git commit -m "fix(dashboard): convert employee-service price SAR<->halalas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Fix dashboard coupon discountValue conversion gap

**Files:**
- Modify: `apps/dashboard/components/features/coupons/coupon-form-fields.tsx`
- Modify: `apps/dashboard/components/features/coupons/coupon-columns.tsx:50-51`
- Test: typecheck + reasoning

**Context:** `coupon-columns.tsx:51` renders a FIXED coupon's `discountValue` via `formatPrice` (treats it as halalas), but `coupon-form-fields.tsx` registers `discountValue` raw with no `sarToHalalas`. For FIXED coupons the form must convert SAR input → halalas on submit and halalas → SAR for the default value. For PERCENTAGE coupons `discountValue` is a percent (0-100) and must NOT be converted.

- [ ] **Step 1: READ both files in full plus the coupon form's zod schema** (find where `discountValue` is in the schema and where the submit handler lives — likely a parent `coupon-form.tsx` or a hook). Determine where conversion belongs: it must be conditional on `discountType === "FIXED"`.

- [ ] **Step 2: Apply conditional conversion on submit**

In the submit handler for the coupon form, before sending `discountValue` to the API:

```typescript
const discountValuePayload =
  values.discountType === "FIXED"
    ? sarToHalalas(values.discountValue)
    : values.discountValue; // PERCENTAGE: raw percent, no conversion
```

Use `discountValuePayload` in the API payload. Add the `sarToHalalas` import.

- [ ] **Step 3: Apply conditional conversion when loading a coupon into the edit form**

Where server coupon data populates the form default:

```typescript
discountValue:
  coupon.discountType === "FIXED"
    ? halalasToSarNumber(coupon.discountValue)
    : coupon.discountValue,
```

- [ ] **Step 4: Verify `coupon-columns.tsx` rendering is now correct**

With FIXED `discountValue` stored as halalas, `formatPrice(c.discountValue)` at line 51 is correct — no change needed. Confirm by reading lines 50-51. PERCENTAGE branch at line 50 (`${c.discountValue}%`) is also correct. Make NO change to this file unless the read reveals a mismatch.

- [ ] **Step 5: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter dashboard typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/features/coupons
git commit -m "fix(dashboard): convert FIXED coupon discountValue SAR<->halalas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Fix dashboard raw-number price displays

**Files:**
- Modify: `apps/dashboard/components/features/dashboard-stats.tsx:79`
- Modify: `apps/dashboard/components/features/employees/employee-type-row.tsx:37,116`
- Modify: `apps/dashboard/components/features/bundles/bundle-price-summary.tsx:32,36,40`
- Test: typecheck

**Context:** Three spots render money as a raw number with no `formatPrice`: `dashboard-stats.tsx:79` shows `todayRevenue` raw; `employee-type-row.tsx:37` shows a service default `price` (halalas) raw with `.toFixed(2)` producing e.g. `12000.00`; `bundle-price-summary.tsx` shows bundle subtotals raw. All must route through `formatPrice` (halalas → SAR string).

- [ ] **Step 1: READ all three files** around the cited lines to learn the exact JSX and the variable types. Confirm each cited value is halalas (`todayRevenue` from `bookings-stats` is halalas after Task 8; `serviceDefault.price` is halalas; bundle subtotals are sums of halalas service prices).

- [ ] **Step 2: Fix `dashboard-stats.tsx:79`**

Wrap the raw `todayRevenue` render in `formatPrice(...)`. Add `import { formatPrice } from "@/lib/money";` if absent. Example shape (match the actual JSX):

```tsx
{formatPrice(stats.todayRevenue, { locale: "en" })}
```

- [ ] **Step 3: Fix `employee-type-row.tsx:37,116`**

Replace the `.toFixed(2)` raw render of `serviceDefault.price` with `formatPrice(serviceDefault.price)`. Add the import. The placeholder/label that previously showed `12000.00` will then correctly show `120.00`.

- [ ] **Step 4: Fix `bundle-price-summary.tsx:32,36,40`**

Wrap each raw subtotal/total/discount render in `formatPrice(...)`. Add the import. If `computeBundlePrice` returns SAR-major numbers, first confirm by reading `bundle-price.ts` — after Task 7 the bundle math is in halalas, so `formatPrice` is correct. If `bundle-price.ts` still mixes units, note it and align it to halalas.

- [ ] **Step 5: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter dashboard typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/features
git commit -m "fix(dashboard): route raw-number price displays through formatPrice

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Add price/total to the POS booking summary

**Files:**
- Modify: `apps/dashboard/components/features/bookings/booking-summary.tsx`
- Test: typecheck

**Context:** `booking-summary.tsx` (right column of `booking-pos.tsx`) renders no price/total at all — a point-of-sale screen with no amount. It must show the selected service price, and, if applicable, the VAT and total, all via `formatPrice`.

- [ ] **Step 1: READ `booking-summary.tsx` and `booking-pos.tsx` in full** to learn what props/state the summary receives — specifically whether the selected service (with its `price` in halalas) is available to the component. If the price is not currently passed down, identify the prop to thread through from `booking-pos.tsx`.

- [ ] **Step 2: Thread the price into the summary if needed**

If the selected service price is not available in `booking-summary.tsx`, add a prop (e.g. `servicePriceHalalas?: number`) and pass it from `booking-pos.tsx` where the selected service is known.

- [ ] **Step 3: Render the price block**

Add a price section to `booking-summary.tsx` using `formatPrice` and the existing `FormattedCurrency`/`SarSymbol` component for the symbol. Match the surrounding visual style (the file already uses the project's card/section styling). Show: service price; if the org charges VAT, a VAT line and a total. If VAT is not computed client-side here, show just the service price labelled clearly. Do NOT hardcode a VAT rate — if a total is shown it must come from server data or be omitted.

- [ ] **Step 4: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter dashboard typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/features/bookings
git commit -m "feat(bookings): show price in POS booking summary

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Point mobile money helper at the shared module

**Files:**
- Modify: `apps/mobile/lib/money.ts`
- Test: typecheck

**Context:** Mobile has its own `lib/money.ts` with a *different API* from the dashboard's (`halalasToSar` returns a string there). Re-export the shared module and keep mobile's existing exported names as aliases. The mobile `halalasToSar` returning a string is a back-compat concern — preserve a string-returning helper under a clear name.

- [ ] **Step 1: READ `apps/mobile/lib/money.ts` in full** and list every exported name + signature. Note that mobile's `halalasToSar` returns `string` (`.toFixed(2)`) and `halalasToSarNumber` is separate. Confirm mobile can import `@sawaa/shared/money` (check `apps/mobile/package.json` deps + `tsconfig.json` / metro config — `@sawaa/shared` is a workspace dep).

- [ ] **Step 2: Rewrite `apps/mobile/lib/money.ts`**

```typescript
// Mobile money helpers — thin re-export of the canonical shared module.
// Do not add logic here; the source of truth is @sawaa/shared/money.
import {
  HALALAS_PER_SAR,
  sarToHalalas,
  halalasToSar as halalasToSarNumberShared,
  formatHalalas,
} from "@sawaa/shared/money";

export { HALALAS_PER_SAR, sarToHalalas };

/** halalas -> SAR-major number. */
export const halalasToSarNumber = halalasToSarNumberShared;

/** halalas -> SAR string with 2 decimals (back-compat with old mobile API). */
export function halalasToSar(halalas: number): string {
  return formatHalalas(halalas, { locale: "en" });
}

export { formatHalalas };
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter mobile typecheck`
Expected: PASS — existing mobile `money.ts` importers still resolve.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/money.ts
git commit -m "refactor(mobile): money.ts re-exports shared canonical module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Fix mobile price displays and dedupe formatMoney

**Files:**
- Modify: `apps/mobile/components/features/AppointmentCard.tsx` (~line 87)
- Modify: `apps/mobile/components/features/PractitionerCard.tsx` (~lines 63-65, 111-113)
- Modify: `apps/mobile/app/(client)/booking/confirm.tsx` (lines 19, 95-99)
- Modify: `apps/mobile/app/(client)/booking/payment.tsx` (lines 43-45)
- Modify: `apps/mobile/app/(client)/booking/bank-transfer.tsx` (lines 34-35)
- Test: typecheck

**Context:** `AppointmentCard` renders `booking.totalAmount` raw, `PractitionerCard` renders `employee.clinicPrice` raw — both are halalas and must go through `formatHalalas`. Three booking screens each re-implement `formatMoney`/`amountLabel` assuming SAR-major input; they must use `formatHalalas` on halalas values. `confirm.tsx` hardcodes `VAT_RATE = 0.15` and computes VAT client-side — VAT must come from server data, not a hardcoded constant.

- [ ] **Step 1: READ all five files in full.** For each money render, determine the unit of the value: `booking.totalAmount`, `employee.clinicPrice`, `service.price` are halalas (from the API); the `params.amount` passed to `payment.tsx` / `bank-transfer.tsx` — trace where it is set by the caller and confirm whether it is halalas (after the backend fixes it is). Note the VAT computation in `confirm.tsx`.

- [ ] **Step 2: Fix `AppointmentCard.tsx`**

Replace the raw `{booking.totalAmount} {t('home.sar')}` with `{formatHalalas(booking.totalAmount, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} {t('home.sar')}`. Import `formatHalalas` from `@/lib/money`. (If `dir` is not in scope, use `'en'` — match what the file already has.)

- [ ] **Step 3: Fix `PractitionerCard.tsx`**

Both render sites of `employee.clinicPrice` → wrap in `formatHalalas(...)`. Import `formatHalalas`.

- [ ] **Step 4: Fix `confirm.tsx`**

- Remove the hardcoded `const VAT_RATE = 0.15;` (line 19).
- The VAT/total must come from the server. READ how `confirm.tsx` gets its booking/invoice data; if it has an invoice with `vatAmt`/`total` (halalas), use those. If `confirm.tsx` only has the raw service price and genuinely cannot fetch server VAT, leave VAT out of this task's scope and add a `// TODO(price-units): VAT must come from server invoice` comment, rendering only the subtotal via `formatHalalas`. Do NOT keep a hardcoded rate.
- Replace the local `formatMoney` with `formatHalalas` from `@/lib/money`.

- [ ] **Step 5: Fix `payment.tsx`**

Replace the local `formatMoney` (lines 43-45) with `formatHalalas` from `@/lib/money`. `total` is `Number(params.amount)` — confirm `params.amount` is halalas (it is, after the backend fix; the caller passes `totalHalalat`). Render `formatHalalas(total, ...)`.

- [ ] **Step 6: Fix `bank-transfer.tsx`**

Replace the inline `amountLabel` (lines 34-35) with `formatHalalas` from `@/lib/money`, same as payment.tsx.

- [ ] **Step 7: Verify typecheck**

Run: `cd /Users/tariq/code/sawaa && pnpm --filter mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/features apps/mobile/app
git commit -m "fix(mobile): render prices via shared formatHalalas, drop hardcoded VAT

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Fix the demo seed Booking.price unit

**Files:**
- Modify: `apps/backend/prisma/demo-seed.ts:258-275`
- Test: run the seed

**Context:** `demo-seed.ts` seeds `Service.price` correctly as halalas (`'12000.00'`) but seeds `Booking.price` as SAR (`'120.00'`) — contradicting the halalas convention and making seeded bookings show 1/100th revenue in `bookings-stats`. Multiply the seeded booking prices by 100.

- [ ] **Step 1: READ `demo-seed.ts` lines 250-290** to see every seeded `Booking.price` value and any `discountedPrice`.

- [ ] **Step 2: Convert each seeded booking price to halalas**

For every `Booking` seed object, change the `price` (and `discountedPrice` if present) from its SAR value to halalas — e.g. `'120.00'` → `'12000'`, `'200.00'` → `'20000'`, `'250.00'` → `'25000'`. Match each value to the corresponding service's halalas price. If the bookings are linked to specific services, set each booking price equal to that service's seeded halalas price.

- [ ] **Step 3: Run the seed against a local DB**

Run: `cd /Users/tariq/code/sawaa && pnpm docker:up && pnpm db:reset`
Expected: seed completes with exit 0.

- [ ] **Step 4: Verify seeded data**

Run a quick check that `Booking.price` values are now in the tens-of-thousands range, e.g.:
Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm prisma db execute --stdin <<< 'SELECT price FROM "Booking" LIMIT 5;'`
Expected: integer-halalas values (e.g. 12000), not 120.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/demo-seed.ts
git commit -m "fix(seed): seed Booking.price in halalas to match convention

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Document the halalas convention in the Prisma schema

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Modify: `apps/backend/prisma/schema/finance.prisma`

**Context:** The halalas convention is currently undocumented in the schema — it lived only in a `demo-seed.ts` comment and frontend logic. Add a clear comment above every money column so the next developer is not misled by `Decimal(12,2)`.

- [ ] **Step 1: Add a comment above every money column**

For each money field listed below, add the line `/// Stored in integer halalas (1 SAR = 100). See packages/shared/money.` directly above the field. (Triple-slash `///` is a Prisma doc comment and surfaces in the generated client.)

`organization.prisma`: `Service.price`, `Service.depositAmount`, `ServiceBookingConfig.price`, `ServiceDurationOption.price`, `EmployeeServiceOption.priceOverride`, `ServiceBundle.discountValue`.
`bookings.prisma`: `Booking.price`, `Booking.discountedPrice`, `GroupSession.price`.
`finance.prisma`: `Invoice.subtotal`, `Invoice.discountAmt`, `Invoice.vatAmt`, `Invoice.total`, `Invoice.refundedAmount`, `Invoice.refundedVatAmt`, `Payment.amount`, `Payment.refundedAmount`, `Coupon.discountValue`, `Coupon.minOrderAmt`, `CouponRedemption.discount`, `RefundRequest.amount`.

Do NOT add the comment to `vatRate` fields — those are rates, not money.

- [ ] **Step 2: Validate the schema still parses**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm prisma validate`
Expected: "The schema is valid".

- [ ] **Step 3: Regenerate the Prisma client (doc comments only — no migration)**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm prisma generate`
Expected: client regenerated, exit 0. NOTE: triple-slash comments do NOT change the database — no migration is created or needed.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema
git commit -m "docs(schema): document integer-halalas convention on money columns

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Full verification and OpenAPI sync

**Files:**
- Modify: `apps/backend/openapi.json` (regenerated)
- Modify: `packages/api-client/**` (regenerated)

**Context:** Task 9 changed a DTO (`@IsInt`, new example/description) and several handlers changed response semantics. The committed OpenAPI snapshot and the typed client must be regenerated. Then run the full verification suite.

- [ ] **Step 1: Run the backend test suite**

Run: `cd /Users/tariq/code/sawaa/apps/backend && pnpm test`
Expected: PASS. If pre-existing unrelated specs fail, note them; all money specs from Tasks 1-9 must pass. Fixtures in `price-resolver.service.spec.ts` and siblings that hardcode small numbers (`200`, `250`, `300`) as prices may now be semantically "2 SAR" — review: if a sibling spec asserts a *display* or *conversion*, rescale its fixture to halalas; if it only asserts passthrough/resolution logic, the literal value is unit-agnostic and can stay.

- [ ] **Step 2: Regenerate the OpenAPI snapshot and client**

Run: `cd /Users/tariq/code/sawaa && pnpm openapi:sync`
Expected: `apps/backend/openapi.json` and the `packages/api-client` files regenerate.

- [ ] **Step 3: Typecheck the whole monorepo**

Run: `cd /Users/tariq/code/sawaa && pnpm typecheck`
Expected: PASS across backend, dashboard, website, mobile, packages.

- [ ] **Step 4: Lint**

Run: `cd /Users/tariq/code/sawaa && pnpm lint`
Expected: PASS (or only pre-existing unrelated warnings).

- [ ] **Step 5: Build**

Run: `cd /Users/tariq/code/sawaa && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit the regenerated artifacts**

```bash
git add apps/backend/openapi.json packages/api-client
git commit -m "chore: regenerate openapi snapshot + api-client after price-units fix

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Post-Plan Manual QA Checklist

After all tasks, before enabling live Moyasar payments, manually verify in a running stack (`pnpm dev:all`):

1. Create a service priced 120 SAR in the dashboard → DB `Service.price` is `12000`.
2. Create a booking for that service → `Booking.price` `12000`, `Invoice.total` `13800` (with 15% VAT).
3. Start a Moyasar payment (test keys) → the amount sent to Moyasar is `13800` halalas (= 138.00 SAR), NOT `1380000`. Confirm in the Moyasar test dashboard the charge shows 138.00 SAR.
4. Webhook marks the payment `COMPLETED` → `Payment.amount` is `13800`.
5. Dashboard booking list shows the payment as `138.00`.
6. Dashboard `revenueToday` shows `138.00`, not `1.38` or `13800.00`.
7. Mobile appointment card and practitioner card show correctly formatted SAR amounts.
8. Issue a partial refund → Moyasar receives halalas; `Payment.refundedAmount` is in halalas.

---

## Notes for the Executor

- **Spec reference in code:** `bookings-stats.handler.ts` referenced `docs/superpowers/tech-debt/price-units-*` which never existed. After Task 8 that comment is gone. No tech-debt doc needs creating.
- **`vatRate` is never money** — never wrap it in `sarToHalalas`/`formatHalalas`.
- **The `/100` in `bundle-price.service.ts:30`** (`cappedPct / 100`) is a percentage divisor and MUST be kept — see Task 7 Step 6.
- **Migrations are immutable** — this plan adds NO migration that alters data or column types. Task 18 only adds Prisma doc comments (no DB change). The `Decimal(12,2)` columns already hold integer halala values; changing them to `Int` was deliberately rejected as a destructive, drift-risking change for zero functional gain.
- **`isValidHalalas`** from the shared module is available if any future server-side guard wants to assert integer halalas at runtime; it is not wired into a CHECK constraint by this plan.
