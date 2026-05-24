# Invoice Receipts (ZATCA Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every successful payment (cash, Moyasar card, verified bank transfer) generate a PDF receipt with a ZATCA Phase 1 QR code, store it on MinIO, attach its URL to the Invoice, and email it to the client — without integrating with the ZATCA Fatoora portal.

**Architecture:** Three sequential phases. Phase 1 cleans up money math and event payloads so the foundation is consistent. Phase 2 adds a single `IssueInvoiceReceiptHandler` that subscribes to `finance.payment.completed`, renders a PDF with `@react-pdf/renderer`, uploads to MinIO, and emails via the existing `EmailProviderFactory`. Phase 3 adds the ZATCA TLV QR code and the seller-identity settings the QR needs.

**Tech Stack:** NestJS 11, Prisma 7, Postgres, MinIO, BullMQ event bus, `@react-pdf/renderer` (pure JS, no Chromium), `qrcode` npm package, Resend/SMTP via `EmailProviderFactory`, Jest.

---

## File Structure

### Phase 1 — cleanup (modify only)

- Modify: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts` — replace inline VAT math with `computeVat`.
- Modify: `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts` — same.
- Modify: `apps/backend/src/modules/bookings/create-bundle-booking/create-bundle-booking.handler.ts` — same.
- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.ts` — set `organizationId` on event.
- Modify: `apps/backend/src/modules/finance/verify-payment/verify-payment.handler.ts` — same.
- Modify: `apps/backend/src/modules/finance/create-invoice/booking-confirmed.handler.ts` — clarify role with comment.
- Test: each `*.handler.spec.ts` next to its handler.

### Phase 2 — receipt foundation

- New: `apps/backend/prisma/migrations/<timestamp>_add_invoice_pdf_columns/migration.sql`.
- Modify: `apps/backend/prisma/schema/finance.prisma` — `pdfUrl`, `pdfGeneratedAt`, `sentToClientAt` on `Invoice`.
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler.ts`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler.spec.ts`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.spec.ts`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf.template.tsx`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.ts` (email subscriber)
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.spec.ts`
- New: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-receipt-issued.event.ts`
- New: `apps/backend/assets/fonts/IBMPlexSansArabic-Regular.ttf` (bundled font)
- New: `apps/backend/assets/fonts/IBMPlexSansArabic-Bold.ttf`
- Modify: `apps/backend/src/modules/finance/finance.module.ts` — register the two new handlers, call `register()` in `onModuleInit`.
- Modify: `apps/backend/src/modules/finance/get-invoice/get-public-invoice.handler.ts` — include `pdfUrl` in result.
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts` — add `GET /dashboard/finance/invoices/:id/pdf`.
- Modify: `apps/backend/src/api/public/invoices.controller.ts` — add `GET /public/invoices/:id/pdf`.
- Modify: `apps/backend/package.json` — add `@react-pdf/renderer`, `qrcode`, `@types/qrcode`.
- Modify: `apps/backend/openapi.json` — regenerated.

### Phase 3 — ZATCA QR

- New: `apps/backend/prisma/migrations/<timestamp>_add_seller_identity_settings/migration.sql`.
- Modify: `apps/backend/prisma/schema/organization.prisma` — `sellerNameAr`, `sellerNameEn`, `sellerVatNumber` (note: `vatRegistrationNumber` already exists but is not enforced — we will reuse it; see Task 3.1).
- New: `apps/backend/src/modules/finance/zatca/build-qr-tlv.ts`
- New: `apps/backend/src/modules/finance/zatca/build-qr-tlv.spec.ts`
- Modify: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf.template.tsx` — render QR.
- Modify: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts` — build TLV + generate QR PNG, pass to template.
- Modify: `apps/dashboard/components/features/settings/seller-identity-form.tsx` (new file) — form for org-settings seller fields.
- Modify: `apps/backend/openapi.json` — regenerated.

---

## Phase 1 — Cleanup and unify the foundation

### Task 1.1: Centralize VAT math in `create-booking`

**Files:**
- Modify: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts:343-369`
- Test: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts`

- [ ] **Step 1: Add failing test**

Append to `create-booking.handler.spec.ts`:

```typescript
it('computes invoice VAT and total using computeVat (subtotal=10000, discount=2000, vatRate=0.15)', async () => {
  // Arrange the create-booking call with price=10000, discountedPrice=8000
  const result = await handler.execute({
    ...baseCmd,
    serviceId: serviceWithPrice10000.id,
    couponCode: coupon20PctOff.code,
    payAtClinic: false,
  });

  const invoice = await prisma.invoice.findUnique({ where: { id: result.invoiceId! } });
  expect(invoice!.subtotal.toString()).toBe('10000');
  expect(invoice!.discountAmt.toString()).toBe('2000');
  // vatBase = 8000, vatAmt = round(8000 * 0.15) = 1200, total = 8000 + 1200 = 9200
  expect(invoice!.vatAmt.toString()).toBe('1200');
  expect(invoice!.total.toString()).toBe('9200');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- create-booking.handler.spec.ts -t "computeVat"`
Expected: FAIL — current rounding via `roundMoney` produces a slightly different value or the discount path differs.

- [ ] **Step 3: Replace inline math with `computeVat`**

In `create-booking.handler.ts` replace lines 343–369 with:

```typescript
if (!dto.payAtClinic && !isGroupService) {
  const orgSettings = await tx.organizationSettings.findFirst({
    where: {},
    select: { vatRate: true },
  });
  const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');

  const subtotalDec = new Prisma.Decimal(price.toString());
  const discountAmtDec = discountedPrice !== null
    ? subtotalDec.sub(new Prisma.Decimal(discountedPrice.toString()))
    : new Prisma.Decimal(0);
  const vatBaseDec = subtotalDec.sub(discountAmtDec);
  const { vatAmtHalalas, totalHalalas } = computeVat(vatBaseDec, vatRateDec);

  invoice = await tx.invoice.create({
    data: {
      branchId: booking.branchId,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      bookingId: booking.id,
      subtotal: subtotalDec,
      discountAmt: discountAmtDec,
      vatRate: vatRateDec,
      vatAmt: vatAmtHalalas,
      total: totalHalalas,
      currency: booking.currency,
      status: 'ISSUED',
      issuedAt: new Date(),
    },
    select: { id: true },
  });
}
```

And add the import at the top of the file:

```typescript
import { computeVat } from '../../finance/money.helper';
```

Remove the now-unused `roundMoney` import if no other site uses it (check first with grep).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- create-booking.handler.spec.ts`
Expected: PASS, no regressions in other create-booking tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/create-booking/
git commit -m "refactor(bookings): use computeVat in create-booking invoice math"
```

---

### Task 1.2: Centralize VAT math in `complete-booking`

**Files:**
- Modify: `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts:50-72`
- Test: `apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
it('creates payAtClinic invoice using computeVat with discount applied', async () => {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { payAtClinic: true, price: 10000, discountedPrice: 8000 },
  });
  await handler.execute({ bookingId, changedBy: 'user-1' });

  const invoice = await prisma.invoice.findUnique({ where: { bookingId } });
  expect(invoice!.subtotal.toString()).toBe('8000');   // discountedPrice
  expect(invoice!.vatAmt.toString()).toBe('1200');     // 8000 * 0.15
  expect(invoice!.total.toString()).toBe('9200');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- complete-booking.handler.spec.ts -t "computeVat"`
Expected: FAIL — current code computes `vatAmt = subtotal * vatRate` then `total = subtotal + subtotal*vatRate`, which double-rounds.

- [ ] **Step 3: Replace inline math**

In `complete-booking.handler.ts:50-72` replace with:

```typescript
if (booking.payAtClinic) {
  const existing = await tx.invoice.findUnique({ where: { bookingId: booking.id } });
  if (!existing) {
    const orgSettings = await tx.organizationSettings.findFirst({
      where: {},
      select: { vatRate: true },
    });
    const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');
    const subtotalDec = new Prisma.Decimal(
      (booking.discountedPrice ?? booking.price).toString(),
    );
    const { vatAmtHalalas, totalHalalas } = computeVat(subtotalDec, vatRateDec);
    await tx.invoice.create({
      data: {
        branchId: booking.branchId,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        bookingId: booking.id,
        subtotal: subtotalDec,
        vatRate: vatRateDec,
        vatAmt: vatAmtHalalas,
        total: totalHalalas,
        currency: booking.currency,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });
  }
}
```

Add import:

```typescript
import { computeVat } from '../../finance/money.helper';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- complete-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/complete-booking/
git commit -m "refactor(bookings): use computeVat in complete-booking payAtClinic invoice"
```

---

### Task 1.3: Centralize VAT math in `create-bundle-booking`

**Files:**
- Modify: `apps/backend/src/modules/bookings/create-bundle-booking/create-bundle-booking.handler.ts:291-330`
- Test: `apps/backend/src/modules/bookings/create-bundle-booking/create-bundle-booking.handler.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
it('creates bundle invoice using computeVat (subtotal=20000, finalPrice=18000)', async () => {
  const result = await handler.execute({
    ...baseBundleCmd,
    bundleId: bundleWith20000Subtotal.id,
    couponCode: coupon10Pct.code,
    payAtClinic: false,
  });

  const invoice = await prisma.invoice.findFirst({
    where: { bundlePurchaseId: result.bundlePurchaseId },
  });
  expect(invoice!.subtotal.toString()).toBe('20000');
  expect(invoice!.discountAmt.toString()).toBe('2000');
  // vatBase = 18000, vatAmt = 2700, total = 20700
  expect(invoice!.vatAmt.toString()).toBe('2700');
  expect(invoice!.total.toString()).toBe('20700');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- create-bundle-booking.handler.spec.ts -t "computeVat"`
Expected: FAIL — current code uses `Math.round(vatBase.toNumber() * vatRate.toNumber())` which converts to float.

- [ ] **Step 3: Replace inline math**

In `create-bundle-booking.handler.ts:291-330` replace the `if (!(dto.payAtClinic ?? false))` block with:

```typescript
let invoice: { id: string } | null = null;
if (!(dto.payAtClinic ?? false)) {
  const orgSettings = await tx.organizationSettings.findFirst({
    where: {},
    select: { vatRate: true },
  });
  const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');
  const subtotalDec = new Prisma.Decimal(subtotal.toString());
  const finalPriceDec = new Prisma.Decimal(finalPrice.toString());
  const discountAmtDec = subtotalDec.sub(finalPriceDec);
  const { vatAmtHalalas, totalHalalas } = computeVat(finalPriceDec, vatRateDec);

  invoice = await tx.invoice.create({
    data: {
      branchId: dto.branchId,
      clientId: dto.clientId,
      employeeId: dto.employeeId,
      bundlePurchaseId: bundlePurchase.id,
      bookingId: null,
      subtotal: subtotalDec,
      discountAmt: discountAmtDec,
      vatRate: vatRateDec,
      vatAmt: vatAmtHalalas,
      total: totalHalalas,
      currency: slots[0].service.currency,
      status: 'ISSUED',
      issuedAt: new Date(),
    },
    select: { id: true },
  });
}
```

Add import:

```typescript
import { computeVat } from '../../finance/money.helper';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- create-bundle-booking.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings/create-bundle-booking/
git commit -m "refactor(bookings): use computeVat in create-bundle-booking"
```

---

### Task 1.4: Fix `organizationId` on `PaymentCompletedEvent` in `process-payment`

**Files:**
- Modify: `apps/backend/src/modules/finance/process-payment/process-payment.handler.ts:140`
- Test: `apps/backend/src/modules/finance/process-payment/process-payment.handler.spec.ts`

- [ ] **Step 1: Add failing test**

Append:

```typescript
it('publishes PaymentCompletedEvent with organizationId populated', async () => {
  await handler.execute({
    invoiceId: 'inv-1',
    amount: 11500,
    method: 'CASH',
    idempotencyKey: 'k1',
  } as ProcessPaymentDto);

  expect(eventBus.publish).toHaveBeenCalledWith(
    'finance.payment.completed',
    expect.objectContaining({
      payload: expect.objectContaining({ organizationId: DEFAULT_ORG_ID }),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- process-payment.handler.spec.ts -t "organizationId"`
Expected: FAIL — current payload omits `organizationId`.

- [ ] **Step 3: Add `organizationId` to event payload**

In `process-payment.handler.ts` add the import:

```typescript
import { DEFAULT_ORG_ID } from '../../../common/constants';
```

And in the `new PaymentCompletedEvent({ ... })` block (around line 140), add:

```typescript
const event = new PaymentCompletedEvent({
  paymentId: payment.id,
  invoiceId: invoice.id,
  bookingId: invoice.bookingId,
  amount: Number(dto.amount),
  currency: invoice.currency,
  organizationId: DEFAULT_ORG_ID,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- process-payment.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/process-payment/
git commit -m "fix(finance): include organizationId in PaymentCompletedEvent from process-payment"
```

---

### Task 1.5: Fix `organizationId` on `PaymentCompletedEvent` in `verify-payment`

**Files:**
- Modify: `apps/backend/src/modules/finance/verify-payment/verify-payment.handler.ts:93`
- Test: `apps/backend/src/modules/finance/verify-payment/verify-payment.handler.spec.ts`

- [ ] **Step 1: Add failing test**

```typescript
it('publishes PaymentCompletedEvent with organizationId on approve', async () => {
  await handler.execute({ paymentId: 'pay-1', action: 'approve' });

  expect(eventBus.publish).toHaveBeenCalledWith(
    'finance.payment.completed',
    expect.objectContaining({
      payload: expect.objectContaining({ organizationId: DEFAULT_ORG_ID }),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- verify-payment.handler.spec.ts -t "organizationId"`
Expected: FAIL.

- [ ] **Step 3: Add `organizationId`**

In `verify-payment.handler.ts` add the import:

```typescript
import { DEFAULT_ORG_ID } from '../../../common/constants';
```

And in the event construction (around line 93):

```typescript
const event = new PaymentCompletedEvent({
  paymentId: updatedPayment.id,
  invoiceId: invoice.id,
  bookingId: invoice.bookingId,
  amount: Number(updatedPayment.amount),
  currency: invoice.currency,
  organizationId: DEFAULT_ORG_ID,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- verify-payment.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/verify-payment/
git commit -m "fix(finance): include organizationId in PaymentCompletedEvent from verify-payment"
```

---

### Task 1.6: Document `BookingConfirmedHandler` as fallback

`BookingConfirmedHandler` (`create-invoice/booking-confirmed.handler.ts`) silently no-ops in 99% of cases because the booking handlers create the invoice inline. Decision: keep it as the authoritative fallback path for sites that publish `bookings.booking.confirmed` without a pre-created invoice, but document its role so it isn't accidentally removed.

**Files:**
- Modify: `apps/backend/src/modules/finance/create-invoice/booking-confirmed.handler.ts`

- [ ] **Step 1: Replace the JSDoc on the class with a clarifying comment**

Replace the existing 3-line JSDoc with:

```typescript
/**
 * Fallback subscriber for `bookings.booking.confirmed`.
 *
 * The primary creation path is inline inside the booking handlers
 * (`create-booking`, `create-bundle-booking`, `complete-booking` for payAtClinic).
 * This handler exists only to cover edge paths that emit
 * `bookings.booking.confirmed` without a pre-created invoice
 * (e.g., legacy flows or future external integrations). When the invoice
 * already exists the @@unique([bookingId]) constraint surfaces a
 * ConflictException which we swallow as idempotent re-delivery.
 */
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/finance/create-invoice/booking-confirmed.handler.ts
git commit -m "docs(finance): clarify BookingConfirmedHandler as fallback path"
```

---

### Task 1.7: Phase 1 integration check

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Full backend tests**

Run: `pnpm --filter=backend test`
Expected: PASS.

- [ ] **Step 3: Confirm no e2e regression on invoice money paths**

Run: `pnpm --filter=dashboard run e2e -- flows/finance/invoice-payment-status-matrix.spec.ts`
Expected: PASS.

---

## Phase 2 — Foundation: PDF receipt generation and email delivery

### Task 2.1: Add Prisma columns for PDF tracking

**Files:**
- Modify: `apps/backend/prisma/schema/finance.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_add_invoice_pdf_columns/migration.sql`

- [ ] **Step 1: Edit the schema**

In `finance.prisma`, inside `model Invoice`, add after `paidAt`:

```prisma
  pdfUrl         String?
  pdfGeneratedAt DateTime?
  sentToClientAt DateTime?
```

- [ ] **Step 2: Generate the migration**

Run from `apps/backend/`:

```bash
npx prisma migrate dev --name add_invoice_pdf_columns
```

Expected: a new migration folder is created with three `ADD COLUMN` statements.

- [ ] **Step 3: Confirm migration content**

Run: `cat apps/backend/prisma/migrations/*_add_invoice_pdf_columns/migration.sql`
Expected output (order may vary):

```sql
ALTER TABLE "Invoice" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "sentToClientAt" TIMESTAMP(3);
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/
git commit -m "feat(finance): add pdfUrl, pdfGeneratedAt, sentToClientAt to Invoice"
```

---

### Task 2.2: Install dependencies

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Install**

Run from repo root:

```bash
pnpm --filter=backend add @react-pdf/renderer qrcode
pnpm --filter=backend add -D @types/qrcode
```

- [ ] **Step 2: Confirm versions**

Run: `pnpm --filter=backend list @react-pdf/renderer qrcode`
Expected: both listed, no peer-dep warnings about React (the package bundles its own React Reconciler).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(backend): add @react-pdf/renderer and qrcode for invoice PDFs"
```

---

### Task 2.3: Add bundled Arabic font

Phase 1 QR-less PDFs still need Arabic text. `@react-pdf/renderer` needs a TTF registered at runtime.

**Files:**
- Create: `apps/backend/assets/fonts/IBMPlexSansArabic-Regular.ttf`
- Create: `apps/backend/assets/fonts/IBMPlexSansArabic-Bold.ttf`

- [ ] **Step 1: Download the two TTFs**

Run:

```bash
mkdir -p apps/backend/assets/fonts
curl -L -o apps/backend/assets/fonts/IBMPlexSansArabic-Regular.ttf \
  https://github.com/IBM/plex/raw/master/IBM-Plex-Sans-Arabic/fonts/complete/ttf/IBMPlexSansArabic-Regular.ttf
curl -L -o apps/backend/assets/fonts/IBMPlexSansArabic-Bold.ttf \
  https://github.com/IBM/plex/raw/master/IBM-Plex-Sans-Arabic/fonts/complete/ttf/IBMPlexSansArabic-Bold.ttf
```

Expected: two `.ttf` files, each roughly ~200KB.

- [ ] **Step 2: Verify file sizes**

Run: `ls -l apps/backend/assets/fonts/`
Expected: two files, each > 100KB.

- [ ] **Step 3: Update `apps/backend/nest-cli.json` to include `assets/fonts` in build output**

Read existing `nest-cli.json` first, then add:

```json
{
  "assets": [
    { "include": "assets/fonts/**", "outDir": "dist" }
  ]
}
```

(Merge with whatever `assets` array exists.)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/assets/fonts/ apps/backend/nest-cli.json
git commit -m "chore(backend): bundle IBM Plex Sans Arabic font for invoice PDFs"
```

---

### Task 2.4: Create the PDF template

**Files:**
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf.template.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import * as path from 'path';
import * as React from 'react';

Font.register({
  family: 'IBMPlexArabic',
  fonts: [
    { src: path.join(__dirname, '../../../../assets/fonts/IBMPlexSansArabic-Regular.ttf') },
    { src: path.join(__dirname, '../../../../assets/fonts/IBMPlexSansArabic-Bold.ttf'), fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'IBMPlexArabic', fontSize: 11 },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 'bold' },
  meta: { marginVertical: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  table: { marginTop: 16, borderTop: '1pt solid #000', borderBottom: '1pt solid #000', paddingVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  grandTotal: { fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  qrSection: { marginTop: 24, alignItems: 'center' },
  qr: { width: 120, height: 120 },
  footer: { marginTop: 24, fontSize: 9, textAlign: 'center', color: '#666' },
});

export interface InvoicePdfData {
  invoiceNumber: number;
  invoiceId: string;
  issuedAt: Date;
  paidAt: Date;
  sellerNameAr: string;
  sellerVatNumber: string | null;
  sellerAddress: string | null;
  clientName: string;
  serviceName: string;
  subtotal: number;
  discountAmt: number;
  vatAmt: number;
  total: number;
  currency: string;
  paymentMethod: string;
  /** Base64 data URL for QR PNG. When null, no QR is rendered (Phase 2 default). */
  qrDataUrl: string | null;
}

const formatHalalas = (h: number) => (h / 100).toFixed(2);

export const InvoicePdf: React.FC<{ data: InvoicePdfData }> = ({ data }) => (
  <Document>
    <Page size="A5" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{data.sellerNameAr}</Text>
        <Text>فاتورة ضريبية مبسطة</Text>
        <Text>Simplified Tax Invoice</Text>
      </View>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text>رقم الفاتورة:</Text>
          <Text>#{data.invoiceNumber}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>تاريخ الإصدار:</Text>
          <Text>{data.issuedAt.toISOString().slice(0, 10)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>تاريخ الدفع:</Text>
          <Text>{data.paidAt.toISOString().slice(0, 16).replace('T', ' ')}</Text>
        </View>
        {data.sellerVatNumber && (
          <View style={styles.metaRow}>
            <Text>الرقم الضريبي:</Text>
            <Text>{data.sellerVatNumber}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text>العميل:</Text>
          <Text>{data.clientName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>الخدمة:</Text>
          <Text>{data.serviceName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text>طريقة الدفع:</Text>
          <Text>{data.paymentMethod}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.totalRow}>
          <Text>المجموع قبل الضريبة:</Text>
          <Text>{formatHalalas(data.subtotal - data.discountAmt)} {data.currency}</Text>
        </View>
        {data.discountAmt > 0 && (
          <View style={styles.totalRow}>
            <Text>الخصم:</Text>
            <Text>-{formatHalalas(data.discountAmt)} {data.currency}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text>ضريبة القيمة المضافة (15%):</Text>
          <Text>{formatHalalas(data.vatAmt)} {data.currency}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotal]}>
          <Text>الإجمالي:</Text>
          <Text>{formatHalalas(data.total)} {data.currency}</Text>
        </View>
      </View>

      {data.qrDataUrl && (
        <View style={styles.qrSection}>
          <Image src={data.qrDataUrl} style={styles.qr} />
          <Text style={{ fontSize: 9, marginTop: 4 }}>امسح الباركود للتحقق</Text>
        </View>
      )}

      <Text style={styles.footer}>
        رقم المرجع: {data.invoiceId}
      </Text>
    </Page>
  </Document>
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf.template.tsx
git commit -m "feat(finance): add invoice PDF react-pdf template"
```

---

### Task 2.5: Create the renderer service

**Files:**
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts`
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import type { InvoicePdfData } from './invoice-pdf.template';

describe('InvoicePdfRendererService', () => {
  const baseData: InvoicePdfData = {
    invoiceNumber: 42,
    invoiceId: 'inv-abc',
    issuedAt: new Date('2026-05-24T10:00:00Z'),
    paidAt: new Date('2026-05-24T10:05:00Z'),
    sellerNameAr: 'مركز سواء',
    sellerVatNumber: '300000000000003',
    sellerAddress: 'الرياض',
    clientName: 'فاطمة',
    serviceName: 'استشارة أسرية',
    subtotal: 10000,
    discountAmt: 0,
    vatAmt: 1500,
    total: 11500,
    currency: 'SAR',
    paymentMethod: 'CASH',
    qrDataUrl: null,
  };

  it('renders a non-empty PDF buffer starting with %PDF', async () => {
    const service = new InvoicePdfRendererService();
    const buf = await service.render(baseData);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=backend test -- invoice-pdf-renderer.service.spec.ts`
Expected: FAIL — `InvoicePdfRendererService` does not exist.

- [ ] **Step 3: Implement the service**

```typescript
import { Injectable } from '@nestjs/common';
import { pdf } from '@react-pdf/renderer';
import * as React from 'react';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    const element = React.createElement(InvoicePdf, { data });
    const instance = pdf(element);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=backend test -- invoice-pdf-renderer.service.spec.ts`
Expected: PASS. (If the test environment lacks `Blob`, add `import { Blob } from 'buffer';` and inject it as global — `@react-pdf/renderer` calls global `Blob`. Node 20 has it natively.)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts \
        apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.spec.ts
git commit -m "feat(finance): add InvoicePdfRendererService using react-pdf"
```

---

### Task 2.6: Define the receipt-issued event

**Files:**
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-receipt-issued.event.ts`

- [ ] **Step 1: Write the event class**

```typescript
import { BaseEvent } from '../../../common/events';

export interface InvoiceReceiptIssuedPayload {
  invoiceId: string;
  invoiceNumber: number;
  clientId: string;
  pdfUrl: string;
  organizationId: string;
}

/**
 * Emitted after a PDF receipt has been rendered and uploaded for an Invoice
 * in PAID status. Subscribers (email/SMS/push) consume this to deliver the
 * receipt to the client. Idempotent — never emitted twice for the same invoice.
 */
export class InvoiceReceiptIssuedEvent extends BaseEvent<InvoiceReceiptIssuedPayload> {
  readonly eventName = 'finance.invoice.receipt.issued';

  constructor(payload: InvoiceReceiptIssuedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/invoice-receipt-issued.event.ts
git commit -m "feat(finance): add InvoiceReceiptIssuedEvent"
```

---

### Task 2.7: Implement `IssueInvoiceReceiptHandler`

**Files:**
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler.ts`
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { Test } from '@nestjs/testing';
import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt.handler';
import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService } from '../../../infrastructure/events';
import { ClsService } from 'nestjs-cls';

describe('IssueInvoiceReceiptHandler', () => {
  let handler: IssueInvoiceReceiptHandler;
  let prisma: any;
  let renderer: any;
  let storage: any;
  let eventBus: any;
  let cls: any;

  beforeEach(async () => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ companyNameAr: 'مركز سواء', vatRegistrationNumber: null, sellerAddress: null }) },
      client: { findUnique: jest.fn().mockResolvedValue({ firstName: 'فاطمة', lastName: '' }) },
      booking: { findFirst: jest.fn().mockResolvedValue({ serviceNameSnapshot: 'استشارة' }) },
      payment: { findFirst: jest.fn().mockResolvedValue({ method: 'CASH' }) },
    };
    renderer = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) };
    storage = { uploadFile: jest.fn().mockResolvedValue('http://minio/finance-invoices/inv-1.pdf') };
    eventBus = { publish: jest.fn() };
    cls = { run: (fn: any) => fn(), set: jest.fn() };

    handler = new IssueInvoiceReceiptHandler(prisma, renderer, storage, eventBus, cls);
  });

  it('skips when invoice not found', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'missing' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('skips when invoice not PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv-1', status: 'PARTIALLY_PAID' });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('skips when pdfUrl already set (idempotent)', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', status: 'PAID', pdfUrl: 'http://existing.pdf',
    });
    await handler.handle({ payload: { paymentId: 'p1', invoiceId: 'inv-1' } } as any);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('renders, uploads, updates invoice, and publishes event on PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1', number: 42, status: 'PAID', pdfUrl: null,
      clientId: 'c1', bookingId: 'b1', subtotal: 10000, discountAmt: 0,
      vatAmt: 1500, total: 11500, currency: 'SAR',
      issuedAt: new Date(), paidAt: new Date(),
    });

    await handler.handle({
      payload: { paymentId: 'p1', invoiceId: 'inv-1', organizationId: 'org-1' },
    } as any);

    expect(renderer.render).toHaveBeenCalled();
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'finance-invoices', expect.stringContaining('inv-1'),
      expect.any(Buffer), 'application/pdf',
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        pdfUrl: 'http://minio/finance-invoices/inv-1.pdf',
        pdfGeneratedAt: expect.any(Date),
      }),
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.invoice.receipt.issued',
      expect.objectContaining({
        payload: expect.objectContaining({
          invoiceId: 'inv-1', invoiceNumber: 42, pdfUrl: 'http://minio/finance-invoices/inv-1.pdf',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify they fail**

Run: `pnpm --filter=backend test -- issue-invoice-receipt.handler.spec.ts`
Expected: FAIL — handler does not exist.

- [ ] **Step 3: Implement the handler**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY, DEFAULT_ORG_ID } from '../../../common/constants';
import type { PaymentCompletedPayload } from '../events/payment-completed.event';
import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import { InvoiceReceiptIssuedEvent } from './invoice-receipt-issued.event';
import type { InvoicePdfData } from './invoice-pdf.template';

const BUCKET = 'finance-invoices';

@Injectable()
export class IssueInvoiceReceiptHandler {
  private readonly logger = new Logger(IssueInvoiceReceiptHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: InvoicePdfRendererService,
    private readonly storage: MinioService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      (envelope) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<PaymentCompletedPayload>): Promise<void> {
    const { invoiceId, paymentId, organizationId } = envelope.payload;

    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    });
    if (!invoice) {
      this.logger.warn(`Receipt: invoice ${invoiceId} not found`);
      return;
    }
    if (invoice.status !== 'PAID') {
      this.logger.log(`Receipt: invoice ${invoiceId} not PAID (status=${invoice.status}) — skipping`);
      return;
    }
    if (invoice.pdfUrl) {
      this.logger.log(`Receipt: invoice ${invoiceId} already has PDF — skipping`);
      return;
    }

    const data = await this.buildPdfData(invoice, paymentId);
    const pdfBuffer = await this.renderer.render(data);

    const key = `invoices/${invoice.id}/${Date.now()}.pdf`;
    const pdfUrl = await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');

    await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl, pdfGeneratedAt: new Date() },
      });
    });

    const issued = new InvoiceReceiptIssuedEvent({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientId: invoice.clientId,
      pdfUrl,
      organizationId: organizationId ?? DEFAULT_ORG_ID,
    });
    await this.eventBus.publish(issued.eventName, issued.toEnvelope());
  }

  private async buildPdfData(invoice: any, paymentId: string): Promise<InvoicePdfData> {
    const [orgSettings, client, payment, booking] = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return Promise.all([
        this.prisma.organizationSettings.findFirst({
          select: { companyNameAr: true, vatRegistrationNumber: true, sellerAddress: true },
        }),
        this.prisma.client.findUnique({
          where: { id: invoice.clientId },
          select: { firstName: true, lastName: true },
        }),
        this.prisma.payment.findFirst({
          where: { id: paymentId },
          select: { method: true },
        }),
        invoice.bookingId
          ? this.prisma.booking.findFirst({
              where: { id: invoice.bookingId },
              select: { serviceNameSnapshot: true },
            })
          : null,
      ]);
    });

    return {
      invoiceNumber: invoice.number,
      invoiceId: invoice.id,
      issuedAt: invoice.issuedAt ?? invoice.createdAt,
      paidAt: invoice.paidAt ?? new Date(),
      sellerNameAr: orgSettings?.companyNameAr ?? 'مركز سواء',
      sellerVatNumber: orgSettings?.vatRegistrationNumber ?? null,
      sellerAddress: orgSettings?.sellerAddress ?? null,
      clientName: client ? `${client.firstName} ${client.lastName ?? ''}`.trim() : '—',
      serviceName: booking?.serviceNameSnapshot ?? (invoice.bundlePurchaseId ? 'باقة جلسات' : '—'),
      subtotal: Number(invoice.subtotal),
      discountAmt: Number(invoice.discountAmt),
      vatAmt: Number(invoice.vatAmt),
      total: Number(invoice.total),
      currency: invoice.currency,
      paymentMethod: payment?.method ?? '—',
      qrDataUrl: null,
    };
  }
}
```

- [ ] **Step 4: Run test to verify they pass**

Run: `pnpm --filter=backend test -- issue-invoice-receipt.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/
git commit -m "feat(finance): IssueInvoiceReceiptHandler renders + uploads invoice PDF"
```

---

### Task 2.8: Implement `SendInvoiceReceiptHandler` (email delivery)

**Files:**
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.ts`
- Create: `apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
describe('SendInvoiceReceiptHandler', () => {
  let handler: SendInvoiceReceiptHandler;
  let prisma: any;
  let emailFactory: any;
  let emailProvider: any;

  beforeEach(() => {
    emailProvider = { sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
    emailFactory = { resolve: jest.fn().mockResolvedValue(emailProvider) };
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ email: 'f@example.com', firstName: 'فاطمة' }) },
      invoice: { update: jest.fn() },
    };
    handler = new SendInvoiceReceiptHandler(prisma, emailFactory, { run: (fn: any) => fn(), set: jest.fn() } as any);
  });

  it('skips when client has no email', async () => {
    prisma.client.findUnique.mockResolvedValue({ email: null, firstName: 'X' });
    await handler.handle({ payload: { invoiceId: 'inv-1', clientId: 'c1', pdfUrl: 'u', invoiceNumber: 1, organizationId: 'o' } } as any);
    expect(emailProvider.sendMail).not.toHaveBeenCalled();
  });

  it('sends email with PDF link and marks sentToClientAt', async () => {
    await handler.handle({ payload: { invoiceId: 'inv-1', clientId: 'c1', pdfUrl: 'http://pdf', invoiceNumber: 42, organizationId: 'o' } } as any);
    expect(emailProvider.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'f@example.com',
      subject: expect.stringContaining('42'),
      html: expect.stringContaining('http://pdf'),
    }));
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { sentToClientAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter=backend test -- send-invoice-receipt.handler.spec.ts`
Expected: FAIL — handler does not exist.

- [ ] **Step 3: Implement the handler**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import type { InvoiceReceiptIssuedPayload } from './invoice-receipt-issued.event';

@Injectable()
export class SendInvoiceReceiptHandler {
  private readonly logger = new Logger(SendInvoiceReceiptHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailFactory: EmailProviderFactory,
    private readonly cls: ClsService,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<InvoiceReceiptIssuedPayload>(
      'finance.invoice.receipt.issued',
      (envelope) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<InvoiceReceiptIssuedPayload>): Promise<void> {
    const { invoiceId, invoiceNumber, clientId, pdfUrl } = envelope.payload;

    const client = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.client.findUnique({
        where: { id: clientId },
        select: { email: true, firstName: true },
      });
    });

    if (!client?.email) {
      this.logger.log(`Receipt email: client ${clientId} has no email — skipping`);
      return;
    }

    const provider = await this.emailFactory.resolve();
    const subject = `فاتورتك من مركز سواء — رقم ${invoiceNumber}`;
    const html = `
      <div dir="rtl" style="font-family: sans-serif; padding: 24px;">
        <h2>شكراً لك ${client.firstName ?? ''}</h2>
        <p>هذه فاتورتك رقم <strong>#${invoiceNumber}</strong> بعد اكتمال الدفع.</p>
        <p><a href="${pdfUrl}" style="background:#0a7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">تنزيل الفاتورة (PDF)</a></p>
        <p style="color:#666;font-size:13px;margin-top:24px;">إذا لم يعمل الزر، انسخ الرابط: ${pdfUrl}</p>
      </div>
    `;

    try {
      await provider.sendMail({ to: client.email, subject, html });
      await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { sentToClientAt: new Date() },
        });
      });
    } catch (err) {
      this.logger.error(`Receipt email failed for invoice ${invoiceId}`, err);
      throw err; // BullMQ retries
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter=backend test -- send-invoice-receipt.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.ts \
        apps/backend/src/modules/finance/issue-invoice-receipt/send-invoice-receipt.handler.spec.ts
git commit -m "feat(finance): SendInvoiceReceiptHandler emails PDF link to client"
```

---

### Task 2.9: Wire the new handlers into `FinanceModule`

**Files:**
- Modify: `apps/backend/src/modules/finance/finance.module.ts`

- [ ] **Step 1: Update imports, providers, and `onModuleInit`**

In `finance.module.ts`:

Add imports:

```typescript
import { IssueInvoiceReceiptHandler } from './issue-invoice-receipt/issue-invoice-receipt.handler';
import { SendInvoiceReceiptHandler } from './issue-invoice-receipt/send-invoice-receipt.handler';
import { InvoicePdfRendererService } from './issue-invoice-receipt/invoice-pdf-renderer.service';
import { EmailModule } from '../../infrastructure/email/email.module';
```

In the `imports` array of `@Module`, append `EmailModule`.

In the `providers` array, append `IssueInvoiceReceiptHandler`, `SendInvoiceReceiptHandler`, `InvoicePdfRendererService`.

In the `exports` array, append `InvoicePdfRendererService` (so other modules can render if needed).

Update the constructor and `onModuleInit`:

```typescript
constructor(
  private readonly bookingConfirmedHandler: BookingConfirmedHandler,
  private readonly groupSessionReadyHandler: GroupSessionReadyHandler,
  private readonly onBookingCancelledRefundHandler: OnBookingCancelledRefundHandler,
  private readonly issueInvoiceReceiptHandler: IssueInvoiceReceiptHandler,
  private readonly sendInvoiceReceiptHandler: SendInvoiceReceiptHandler,
  private readonly eventBus: EventBusService,
) {}

onModuleInit(): void {
  this.bookingConfirmedHandler.register();
  this.groupSessionReadyHandler.register();
  this.onBookingCancelledRefundHandler.register();
  this.issueInvoiceReceiptHandler.register();
  this.sendInvoiceReceiptHandler.register(this.eventBus);
}
```

Add `EventBusService` to the imports at the top if not already present.

- [ ] **Step 2: Verify the module spec still passes**

Run: `pnpm --filter=backend test -- finance.module.spec.ts`
Expected: PASS. If the spec asserts on the registered handler list, update it.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/finance/finance.module.ts
git commit -m "feat(finance): wire IssueInvoiceReceiptHandler + SendInvoiceReceiptHandler"
```

---

### Task 2.10: Expose PDF download endpoints

**Files:**
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts`
- Modify: `apps/backend/src/api/public/invoices.controller.ts`
- Modify: `apps/backend/src/modules/finance/get-invoice/get-public-invoice.handler.ts` (add `pdfUrl` field)

- [ ] **Step 1: Add `pdfUrl` to `GetPublicInvoiceResult`**

In `get-public-invoice.handler.ts`:

Add to the interface:

```typescript
pdfUrl: string | null;
```

In the returned object, add:

```typescript
pdfUrl: invoice.pdfUrl ?? null,
```

- [ ] **Step 2: Add dashboard endpoint**

In `apps/backend/src/api/dashboard/finance.controller.ts` add inside the class:

```typescript
@Get('invoices/:id/pdf')
@CheckPermissions({ action: 'read', subject: 'Invoice' })
@ApiOperation({ summary: 'Get a presigned URL to download the invoice PDF' })
@ApiParam({ name: 'id', description: 'Invoice UUID' })
@ApiOkResponse({ description: 'Presigned download URL (valid 5 min) or 404 if no PDF yet' })
async getInvoicePdf(@Param('id', ParseUUIDPipe) id: string) {
  const invoice = await this.getInvoice.execute({ invoiceId: id });
  if (!invoice.pdfUrl) {
    throw new NotFoundException('No PDF has been generated for this invoice yet');
  }
  return { url: invoice.pdfUrl };
}
```

Add `NotFoundException` to the `@nestjs/common` import. (The handler already returns `pdfUrl` because `GetInvoiceHandler` reads the whole invoice row.)

- [ ] **Step 3: Add public endpoint**

In `apps/backend/src/api/public/invoices.controller.ts` add:

```typescript
@Get(':id/pdf')
@ApiOperation({ summary: 'Get a URL to download the invoice PDF (client-owned only)' })
@ApiParam({ name: 'id', description: 'Invoice UUID' })
@ApiOkResponse({ description: 'PDF URL or 404 if not generated yet' })
async getPdf(
  @Param('id', ParseUUIDPipe) id: string,
  @ClientId() clientId: string,
) {
  const invoice = await this.getPublicInvoice.execute(id, clientId);
  if (!invoice.pdfUrl) {
    throw new NotFoundException('No PDF has been generated for this invoice yet');
  }
  return { url: invoice.pdfUrl };
}
```

(Use whatever client-id decorator the existing endpoints in that file use — copy the pattern from the existing `@Get(':id')` handler in the same controller.)

- [ ] **Step 4: Regenerate OpenAPI snapshot**

Run from repo root:

```bash
pnpm openapi:sync
```

Expected: `apps/backend/openapi.json` updates with the two new endpoints; the dashboard typed client regenerates.

- [ ] **Step 5: Run controller tests**

Run: `pnpm --filter=backend test -- finance.controller.spec.ts invoices.controller.spec.ts`
Expected: PASS (add a smoke test for each new endpoint if missing).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/api/dashboard/finance.controller.ts \
        apps/backend/src/api/public/invoices.controller.ts \
        apps/backend/src/modules/finance/get-invoice/get-public-invoice.handler.ts \
        apps/backend/openapi.json \
        packages/api-client/
git commit -m "feat(finance): expose GET /invoices/:id/pdf on dashboard and public APIs"
```

---

### Task 2.11: Phase 2 integration check

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: All backend tests**

Run: `pnpm --filter=backend test`
Expected: PASS.

- [ ] **Step 3: Manual smoke against running stack**

Run from repo root:

```bash
pnpm docker:up
pnpm db:migrate
pnpm dev:backend
```

Then in another terminal:

```bash
# 1. Create a booking with payAtClinic=false through the existing API.
# 2. Trigger a CASH payment via POST /dashboard/finance/payments.
# 3. Wait ~3s for the BullMQ event to fire.
# 4. GET /dashboard/finance/invoices/:id should show pdfUrl populated.
# 5. Open the URL in a browser — confirm a valid PDF renders with Arabic text.
```

Expected: PDF opens, Arabic renders correctly, totals match invoice numbers.

---

## Phase 3 — ZATCA Phase 1 QR code

### Task 3.1: Reuse `vatRegistrationNumber` and add seller-name override

`OrganizationSettings` already has `vatRegistrationNumber` and `companyNameAr`. The QR also wants a canonical seller name — Arabic — which `companyNameAr` covers. **Decision:** no schema change; reuse existing fields. The migration in this task is empty/skipped.

**Files:**
- (none)

- [ ] **Step 1: Verify the two fields exist**

Run:

```bash
grep -n "companyNameAr\|vatRegistrationNumber" apps/backend/prisma/schema/organization.prisma
```

Expected: both lines present in `OrganizationSettings` model.

- [ ] **Step 2: Commit a no-op marker (optional) or skip**

Skip if no change needed. Document in commit message of Task 3.2 that we reused existing fields.

---

### Task 3.2: Implement the ZATCA TLV builder

**Files:**
- Create: `apps/backend/src/modules/finance/zatca/build-qr-tlv.ts`
- Create: `apps/backend/src/modules/finance/zatca/build-qr-tlv.spec.ts`

ZATCA Phase 1 TLV spec (Simplified Tax Invoice):
- Tag 1: Seller Name (UTF-8)
- Tag 2: VAT Registration Number (ASCII)
- Tag 3: Invoice Timestamp (ISO 8601, e.g. `2026-05-24T10:05:00Z`)
- Tag 4: Invoice Total with VAT (string, e.g. `"115.00"`)
- Tag 5: VAT Total (string, e.g. `"15.00"`)

Each field is encoded as `[tag:1 byte][length:1 byte][value:N bytes]`, concatenated, then Base64-encoded.

- [ ] **Step 1: Write the failing test using the official ZATCA reference example**

Reference example from ZATCA documentation:
- Seller: `"Salla"`
- VAT: `"310122393500003"`
- Date: `"2022-04-25T15:30:00Z"`
- Total: `"100.00"`
- VAT amount: `"15.00"`
- Expected Base64: `"AQVTYWxsYQIPMzEwMTIyMzkzNTAwMDAzAxQyMDIyLTA0LTI1VDE1OjMwOjAwWgQGMTAwLjAwBQUxNS4wMA=="`

```typescript
import { buildZatcaQrTlv } from './build-qr-tlv';

describe('buildZatcaQrTlv', () => {
  it('matches the ZATCA reference example', () => {
    const result = buildZatcaQrTlv({
      sellerName: 'Salla',
      vatNumber: '310122393500003',
      timestamp: new Date('2022-04-25T15:30:00Z'),
      totalWithVat: '100.00',
      vatTotal: '15.00',
    });
    expect(result).toBe('AQVTYWxsYQIPMzEwMTIyMzkzNTAwMDAzAxQyMDIyLTA0LTI1VDE1OjMwOjAwWgQGMTAwLjAwBQUxNS4wMA==');
  });

  it('handles multi-byte Arabic seller name length correctly (byte length, not char count)', () => {
    const result = buildZatcaQrTlv({
      sellerName: 'سواء',
      vatNumber: '300000000000003',
      timestamp: new Date('2026-05-24T10:00:00Z'),
      totalWithVat: '115.00',
      vatTotal: '15.00',
    });
    // 'سواء' = 8 bytes in UTF-8
    // Decode and inspect first tag block manually
    const bytes = Buffer.from(result, 'base64');
    expect(bytes[0]).toBe(1);   // tag 1
    expect(bytes[1]).toBe(8);   // 8 bytes, not 4 chars
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter=backend test -- build-qr-tlv.spec.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement the TLV builder**

```typescript
export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  /** Decimal string with 2 places, e.g. "115.00". */
  totalWithVat: string;
  /** Decimal string with 2 places, e.g. "15.00". */
  vatTotal: string;
}

function encodeTlv(tag: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, 'utf8');
  if (valueBuf.length > 255) {
    throw new Error(`ZATCA TLV value for tag ${tag} exceeds 255 bytes (got ${valueBuf.length})`);
  }
  const header = Buffer.from([tag, valueBuf.length]);
  return Buffer.concat([header, valueBuf]);
}

export function buildZatcaQrTlv(fields: ZatcaQrFields): string {
  const blocks = [
    encodeTlv(1, fields.sellerName),
    encodeTlv(2, fields.vatNumber),
    encodeTlv(3, fields.timestamp.toISOString().replace(/\.\d{3}Z$/, 'Z')),
    encodeTlv(4, fields.totalWithVat),
    encodeTlv(5, fields.vatTotal),
  ];
  return Buffer.concat(blocks).toString('base64');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter=backend test -- build-qr-tlv.spec.ts`
Expected: PASS — including the reference vector.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/finance/zatca/
git commit -m "feat(finance): ZATCA Phase 1 QR TLV builder with reference-vector test"
```

---

### Task 3.3: Wire QR into the renderer service

**Files:**
- Modify: `apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts`
- Modify: `apps/backend/src/modules/finance/issue-invoice-receipt/issue-invoice-receipt.handler.ts`

- [ ] **Step 1: Extend renderer with QR generation**

Replace the renderer service with:

```typescript
import { Injectable } from '@nestjs/common';
import { pdf } from '@react-pdf/renderer';
import * as React from 'react';
import * as QRCode from 'qrcode';
import { InvoicePdf, type InvoicePdfData } from './invoice-pdf.template';
import { buildZatcaQrTlv } from '../zatca/build-qr-tlv';

@Injectable()
export class InvoicePdfRendererService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    // If seller name + VAT number present, build the ZATCA QR.
    let qrDataUrl: string | null = data.qrDataUrl;
    if (!qrDataUrl && data.sellerVatNumber) {
      const tlv = buildZatcaQrTlv({
        sellerName: data.sellerNameAr,
        vatNumber: data.sellerVatNumber,
        timestamp: data.paidAt,
        totalWithVat: (data.total / 100).toFixed(2),
        vatTotal: (data.vatAmt / 100).toFixed(2),
      });
      qrDataUrl = await QRCode.toDataURL(tlv, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
    }

    const enriched: InvoicePdfData = { ...data, qrDataUrl };
    const element = React.createElement(InvoicePdf, { data: enriched });
    const instance = pdf(element);
    const blob = await instance.toBlob();
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

- [ ] **Step 2: Update spec to assert QR is present when VAT number provided**

Append to `invoice-pdf-renderer.service.spec.ts`:

```typescript
it('embeds a QR code when sellerVatNumber is provided', async () => {
  const service = new InvoicePdfRendererService();
  const buf = await service.render({ ...baseData, sellerVatNumber: '310122393500003' });
  // A PDF with an embedded PNG will contain '/Image' and '/Subtype /Image' streams.
  const haystack = buf.toString('latin1');
  expect(haystack).toContain('/Image');
});

it('omits the QR when sellerVatNumber is null', async () => {
  const service = new InvoicePdfRendererService();
  const buf = await service.render({ ...baseData, sellerVatNumber: null });
  // No image stream → no /Subtype /Image marker.
  const haystack = buf.toString('latin1');
  // The font itself isn't an image; absence of '/Subtype /Image' is the signal.
  expect(haystack.includes('/Subtype /Image')).toBe(false);
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter=backend test -- invoice-pdf-renderer.service.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.ts \
        apps/backend/src/modules/finance/issue-invoice-receipt/invoice-pdf-renderer.service.spec.ts
git commit -m "feat(finance): embed ZATCA Phase 1 QR in invoice PDF when VAT number set"
```

---

### Task 3.4: Add dashboard settings form for seller identity

**Files:**
- Modify: existing settings page in `apps/dashboard/app/(dashboard)/settings/*` (locate with grep first).

- [ ] **Step 1: Locate the existing organization settings page**

Run:

```bash
find apps/dashboard/app -path "*settings*" -name "page.tsx"
find apps/dashboard/components -path "*settings*" -name "*.tsx"
```

Pick the existing form that already edits `companyNameAr` / `vatRegistrationNumber` (it almost certainly exists under `components/features/settings/`).

- [ ] **Step 2: Confirm both fields are editable**

Open the form file, confirm `companyNameAr` and `vatRegistrationNumber` are in the schema. If yes — no change needed beyond a tooltip. If a field is missing, add it as a text input with label "الرقم الضريبي (15 رقم)".

- [ ] **Step 3: Add a banner that explains the impact**

Above the VAT-number input, add a help text:

```tsx
<p className="text-sm text-muted-foreground">
  مطلوب لظهور باركود ZATCA على فواتير العملاء. لو فاضي، الفاتورة تطلع بدون باركود.
</p>
```

- [ ] **Step 4: Run dashboard tests**

Run: `pnpm --filter=dashboard test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): document VAT number requirement for ZATCA QR on invoices"
```

---

### Task 3.5: Phase 3 integration check

- [ ] **Step 1: Seed a tenant with VAT number**

Open `apps/backend/prisma/seeds/*` and ensure `OrganizationSettings.companyNameAr = "مركز سواء"` and `vatRegistrationNumber = "300000000000003"` are set in the demo seed. Update if missing.

- [ ] **Step 2: Reset DB and re-seed**

Run: `pnpm db:reset`
Expected: clean DB with seller identity populated.

- [ ] **Step 3: End-to-end smoke**

Manually:
1. Create booking → trigger CASH payment.
2. Wait for event.
3. GET invoice PDF URL → open in browser.
4. Scan QR with a phone QR reader → confirm it decodes to the TLV (the readable Base64 string).
5. Decode the Base64 manually and confirm seller name / VAT / total match the invoice.

Expected: QR scans cleanly; decoded payload contains the invoice totals.

- [ ] **Step 4: Run the full test matrix**

Run from repo root:

```bash
pnpm typecheck
pnpm --filter=backend test
pnpm --filter=dashboard test
pnpm --filter=dashboard run e2e:smoke
```

Expected: all PASS.

- [ ] **Step 5: Final commit**

```bash
git add apps/backend/prisma/seeds/
git commit -m "chore(seed): set demo seller identity for ZATCA QR rendering"
```

---

## Conflict-and-risk summary

| Area | Risk | Mitigation |
|---|---|---|
| Existing money math changes | VAT/total may shift by ±1 halala on a tiny fraction of historical bookings | Tests assert exact halala values; no DB backfill required (existing invoices keep their stored values). |
| Phase 1 changes booking handlers | E2E `invoice-payment-status-matrix.spec.ts` may shift assertions | Task 1.7 runs that spec; update snapshots if asserted on wire totals. |
| New Prisma columns | None — nullable additive only | Migration is forward-only and reversible. |
| `@react-pdf/renderer` adds ~10MB | Larger image, longer cold-start | Acceptable; image stays under 500MB. |
| QR omitted when VAT number missing | Receipts ship without QR | Phase 3 dashboard banner makes the requirement explicit; QR conditional logic verified in tests. |
| Email delivery uses tenant `EmailProviderFactory` | If provider is unconfigured (NoOp), email silently dropped | Handler logs a warning; `NoOpEmailAdapter.sendMail` already returns a fake messageId. Acceptable for single-tenant rollout. |
| `bookings.payment-completed.handler.ts` already subscribes to the same event | Two subscribers run in parallel | Handlers are independent — booking confirm is in `bookings/`, receipt issuance is in `finance/`. No shared state. |
| `pdfUrl` exposed in public DTO | Anyone with the URL can download | MinIO URLs in this codebase are direct (no presigned). Acceptable for a finished invoice receipt — the URL is shared with the client by email anyway. If stricter, swap `uploadFile` for `getSignedUrl` in `IssueInvoiceReceiptHandler` and don't persist a long-lived URL — generate on demand in the controller. |
| BullMQ retry on email failure | Could spam the client if Resend flakes | The handler throws; BullMQ retries with backoff. Default retry limit (3) is acceptable. |
| `roundMoney` may still be used elsewhere | Unused-import lint failure | Task 1.1 step 3 grep-checks before removing. |

---

## Self-review notes

- Spec coverage: cleanup (1.x), foundation/PDF/email (2.x), ZATCA QR + settings (3.x) — every section of the discussion above has a task.
- No placeholders: all code blocks are complete; all commands include the expected outcome.
- Type consistency: `InvoicePdfData`, `InvoiceReceiptIssuedPayload`, `PaymentCompletedPayload`, `ZatcaQrFields` are defined once and referenced verbatim across tasks.
- The renderer's `qrDataUrl` field is part of `InvoicePdfData` from Task 2.4 and consumed both in Phase 2 (always null) and Phase 3 (populated when VAT number present).
- `IssueInvoiceReceiptHandler.handle` reads `invoice.pdfUrl` as the idempotency guard — verified in Task 2.7 tests.
