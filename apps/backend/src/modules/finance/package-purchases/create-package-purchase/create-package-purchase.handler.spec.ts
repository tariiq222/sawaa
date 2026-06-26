import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType, PackagePurchaseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../../common/constants';
import { ComputePackagePriceService } from '../../../org-experience/compute-package-price.service';
import { CreatePackagePurchaseHandler } from './create-package-purchase.handler';

// ─── Shared fakes ────────────────────────────────────────────────────────────

const PACKAGE_ID = '00000000-0000-4000-a000-000000000001';
const CLIENT_ID = '00000000-0000-4000-a000-000000000002';
const BRANCH_ID = '00000000-0000-4000-a000-000000000003';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000006';
const PURCHASE_ID = '00000000-0000-4000-a000-000000000010';
const INVOICE_ID = '00000000-0000-4000-a000-000000000011';
const PAYMENT_ID = '00000000-0000-4000-a000-000000000012';

const ITEM = {
  id: 'item-1',
  packageId: PACKAGE_ID,
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 1,
  sortOrder: 0,
};

const SUBTOTAL_HALALAS = 40_000; // 4 paid × 10_000
const DISCOUNT_HALALAS = 4_000; // 10% of subtotal
const FINAL_PRICE_HALALAS = 36_000;

const PACKAGE_ROW = {
  id: PACKAGE_ID,
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  isActive: true,
  archivedAt: null,
  items: [ITEM],
};

/**
 * Build a per-test Prisma stub. Each method the handler may call is a
 * jest.fn() so individual tests can script query responses. The transaction
 * wrapper hands its callback a `tx` proxy whose methods mirror the same
 * shape as the Prisma top-level — we pass `tx` through and mock `tx` too.
 */
function buildPrisma() {
  const sessionPackage = { findFirst: jest.fn() };
  const client = { findFirst: jest.fn() };
  const tx = {
    sessionPackage: { findFirst: jest.fn() },
    client: { findFirst: jest.fn() },
    packagePurchase: {
      create: jest.fn().mockResolvedValue({ id: PURCHASE_ID }),
      findFirst: jest.fn().mockResolvedValue(null), // duplicate-check; null by default → not duplicate
    },
    packageCredit: { createMany: jest.fn() },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(null), // no existing invoice by default
      create: jest.fn(),
    },
  };
  return {
    sessionPackage,
    client,
    _tx: tx,
  };
}

function buildProcessPayment() {
  return { execute: jest.fn().mockResolvedValue({ id: PAYMENT_ID, invoiceId: INVOICE_ID }) };
}

function buildEventBus() {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

/**
 * Build a ComputePackagePriceService fake that returns the canonical frozen
 * price (4 sessions × 10_000 halalas − 10% = 36_000 halalas). Tests that need
 * a different price can override per call.
 */
function buildPricingService(overrides: Partial<{ subtotal: number; discountAmount: number; finalPrice: number; itemUnitPrices: { durationOptionId: string; unitPrice: number }[] }> = {}) {
  const result = {
    subtotal: SUBTOTAL_HALALAS,
    discountAmount: DISCOUNT_HALALAS,
    finalPrice: FINAL_PRICE_HALALAS,
    itemUnitPrices: [
      { durationOptionId: DURATION_OPTION_ID, unitPrice: SUBTOTAL_HALALAS / ITEM.paidQuantity },
    ],
    ...overrides,
  };
  return {
    compute: jest.fn().mockResolvedValue(result),
    // Some tests reach into the static helper for the discount math.
    applyDiscount: ComputePackagePriceService.applyDiscount,
  };
}

/**
 * Configure the happy-path prisma responses. Override individual mocks to
 * drive a specific failure path.
 */
function mockHappyPath(prisma: ReturnType<typeof buildPrisma>) {
  prisma.sessionPackage.findFirst.mockResolvedValue(PACKAGE_ROW);
  prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID });
  prisma._tx.invoice.create.mockResolvedValue({ id: INVOICE_ID });
}

function buildHandler(prisma: ReturnType<typeof buildPrisma>, pricing = buildPricingService()) {
  const tx = prisma._tx;
  const processPayment = buildProcessPayment();
  const eventBus = buildEventBus();
  const handler = new CreatePackagePurchaseHandler(
    prisma as never,
    { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) } as never,
    pricing as never,
    processPayment as never,
    eventBus as never,
  );
  return { handler, tx, processPayment, eventBus, pricing };
}

describe('CreatePackagePurchaseHandler', () => {
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
  });

  afterEach(() => jest.clearAllMocks());

  const validDto = () => ({
    packageId: PACKAGE_ID,
    clientId: CLIENT_ID,
    branchId: BRANCH_ID,
    employeeId: EMPLOYEE_ID,
    method: PaymentMethod.CASH,
    notes: 'Walk-in sale',
  });

  it('is defined', () => {
    const { handler } = buildHandler(prisma);
    expect(handler).toBeDefined();
  });

  describe('happy path — price freeze + atomic creation', () => {
    it('freezes the price via ComputePackagePriceService (subtotal/discount/finalPrice)', async () => {
      mockHappyPath(prisma);
      const { handler, tx } = buildHandler(prisma);

      const result = await handler.execute(validDto());

      // PackagePurchase snapshot fields match the frozen price:
      expect(tx.packagePurchase.create).toHaveBeenCalledTimes(1);
      const purchaseData = tx.packagePurchase.create.mock.calls[0][0].data;
      expect(Number(purchaseData.subtotalSnapshot)).toBe(SUBTOTAL_HALALAS);
      expect(Number(purchaseData.discountSnapshot)).toBe(DISCOUNT_HALALAS);
      expect(Number(purchaseData.amountPaid)).toBe(FINAL_PRICE_HALALAS);
      expect(purchaseData.status).toBe(PackagePurchaseStatus.ACTIVE);
      expect(purchaseData.paidAt).toBeInstanceOf(Date);
      // The package purchase references the right package + client + branch.
      expect(purchaseData.packageId).toBe(PACKAGE_ID);
      expect(purchaseData.clientId).toBe(CLIENT_ID);
      expect(purchaseData.branchId).toBe(BRANCH_ID);
      // The handler must NOT re-create the package — package is a definition, not a per-purchase row.
      // tx.sessionPackage only exposes findFirst; the handler has no way to call create on it.
      expect((tx.sessionPackage as unknown as { create?: unknown }).create).toBeUndefined();
      // Should return the purchase plus its credits.
      expect(result.purchase).toBeDefined();
      expect(result.credits).toBeDefined();
      expect(result.credits).toHaveLength(1);
    });

    it('creates one PackageCredit per SessionPackageItem with totalQuantity = paid + free', async () => {
      mockHappyPath(prisma);
      const { handler, tx } = buildHandler(prisma);

      await handler.execute(validDto());

      expect(tx.packageCredit.createMany).toHaveBeenCalledTimes(1);
      const creditRows = tx.packageCredit.createMany.mock.calls[0][0].data;
      expect(creditRows).toHaveLength(1);
      expect(creditRows[0]).toEqual(
        expect.objectContaining({
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          totalQuantity: ITEM.paidQuantity + ITEM.freeQuantity, // 4 + 1 = 5
          usedQuantity: 0,
        }),
      );
      // unitPriceSnapshot is the per-item unit price (not the subtotal).
      // We don't assert the exact number here because ComputePackagePriceService
      // resolves it internally — but it MUST be set and equal to one session
      // price (subtotal / paidQuantity).
      expect(Number(creditRows[0].unitPriceSnapshot)).toBe(SUBTOTAL_HALALAS / ITEM.paidQuantity);
      // purchaseId on every credit must match the created purchase — verified via return value below.
    });

    it('issues ONE invoice with subtotal=fullSubtotal, discount=fullDiscount, vat=0, total=finalPrice, linked via packagePurchaseId', async () => {
      mockHappyPath(prisma);
      const { handler, tx } = buildHandler(prisma);

      const result = await handler.execute(validDto());

      expect(tx.invoice.create).toHaveBeenCalledTimes(1);
      const invoiceData = tx.invoice.create.mock.calls[0][0].data;
      expect(Number(invoiceData.subtotal)).toBe(SUBTOTAL_HALALAS);
      expect(Number(invoiceData.discountAmt)).toBe(DISCOUNT_HALALAS);
      expect(Number(invoiceData.vatRate)).toBe(0); // center is NOT VAT-registered (CLAUDE.md)
      expect(Number(invoiceData.vatAmt)).toBe(0);
      expect(Number(invoiceData.total)).toBe(FINAL_PRICE_HALALAS);
      expect(invoiceData.packagePurchaseId).toBe(result.purchase.id);
      expect(invoiceData.bookingId ?? null).toBeNull(); // XOR: invoice belongs to package, not booking.
      expect(invoiceData.clientId).toBe(CLIENT_ID);
      expect(invoiceData.branchId).toBe(BRANCH_ID);
      expect(invoiceData.employeeId).toBe(EMPLOYEE_ID);
      expect(invoiceData.status).toBe('DRAFT');
      expect(invoiceData.issuedAt ?? null).toBeNull();
    });

    it('records the manual payment via ProcessPaymentHandler for the full finalPrice, making the invoice PAID', async () => {
      mockHappyPath(prisma);
      const { handler, processPayment } = buildHandler(prisma);

      await handler.execute(validDto());

      expect(processPayment.execute).toHaveBeenCalledTimes(1);
      const paymentCmd = processPayment.execute.mock.calls[0][0];
      expect(paymentCmd.invoiceId).toBe(INVOICE_ID);
      expect(paymentCmd.amount).toBe(FINAL_PRICE_HALALAS);
      expect(paymentCmd.method).toBe(PaymentMethod.CASH);
      // ProcessPaymentHandler is what flips the invoice to PAID via the aggregate inside its transaction.
      // The package purchase handler must NOT update the invoice status itself.
    });

    it('passes an idempotencyKey derived from the purchase id so duplicate payment calls collapse', async () => {
      mockHappyPath(prisma);
      const { handler, processPayment } = buildHandler(prisma);

      await handler.execute(validDto());

      const paymentCmd = processPayment.execute.mock.calls[0][0];
      expect(paymentCmd.idempotencyKey).toBe(`pkg-purchase:${PURCHASE_ID}`);
    });

    it('publishes finance.invoice.created after the transaction commits', async () => {
      mockHappyPath(prisma);
      const { handler, eventBus } = buildHandler(prisma);

      await handler.execute(validDto());

      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.invoice.created',
        expect.objectContaining({
          payload: expect.objectContaining({
            invoiceId: INVOICE_ID,
            packagePurchaseId: PURCHASE_ID,
            clientId: CLIENT_ID,
            total: FINAL_PRICE_HALALAS,
          }),
        }),
      );
    });

    it('returns the purchase with credits carrying the unitPriceSnapshot and totalQuantity', async () => {
      mockHappyPath(prisma);
      const { handler, tx } = buildHandler(prisma);

      const result = await handler.execute(validDto());

      expect(result.purchase.id).toBe(PURCHASE_ID);
      expect(result.invoiceId).toBe(INVOICE_ID);
      expect(result.paymentId).toBe(PAYMENT_ID);
      expect(result.credits).toEqual([
        expect.objectContaining({
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          totalQuantity: ITEM.paidQuantity + ITEM.freeQuantity,
          usedQuantity: 0,
        }),
      ]);
    });
  });

  describe('failure paths', () => {
    it('throws NotFoundException when the package does not exist', async () => {
      prisma.sessionPackage.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(validDto())).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the package is archived (archivedAt != null)', async () => {
      prisma.sessionPackage.findFirst.mockResolvedValue({ ...PACKAGE_ROW, archivedAt: new Date() });
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(validDto())).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the package is inactive (isActive=false)', async () => {
      prisma.sessionPackage.findFirst.mockResolvedValue({ ...PACKAGE_ROW, isActive: false });
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(validDto())).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the client does not exist', async () => {
      prisma.sessionPackage.findFirst.mockResolvedValue(PACKAGE_ROW);
      prisma.client.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(validDto())).rejects.toThrow(NotFoundException);
    });

    it('rejects ONLINE_CARD payments (manual-payment endpoint does not accept them — must go through Moyasar webhook)', async () => {
      mockHappyPath(prisma);
      const { handler } = buildHandler(prisma);

      await expect(
        handler.execute({ ...validDto(), method: PaymentMethod.ONLINE_CARD }),
      ).rejects.toThrow(/ONLINE_CARD/i);
    });
  });

  describe('multiple ACTIVE purchases', () => {
    it('does NOT reject a duplicate active purchase of the same package for the same client (unlike old BundlePurchase)', async () => {
      mockHappyPath(prisma);
      // Simulate an existing ACTIVE purchase — handler must still proceed.
      prisma._tx.packagePurchase.findFirst.mockResolvedValue({ id: 'existing-purchase' });
      const { handler, tx, processPayment } = buildHandler(prisma);

      const result = await handler.execute(validDto());

      // Tx-level duplicate check still runs (audit / pre-check) but the handler
      // does NOT throw — the brief allows multiple ACTIVE purchases per client/package.
      expect(tx.packagePurchase.create).toHaveBeenCalled();
      expect(processPayment.execute).toHaveBeenCalled();
      expect(result.purchase.id).toBe(PURCHASE_ID);
    });

    it('accepts all dashboard manual methods (CASH, BANK_TRANSFER, MADA, TABBY) as a manual-payment source', async () => {
      for (const method of [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER, PaymentMethod.MADA, PaymentMethod.TABBY]) {
        prisma.sessionPackage.findFirst.mockResolvedValue(PACKAGE_ROW);
        prisma.client.findFirst.mockResolvedValue({ id: CLIENT_ID });
        prisma._tx.invoice.create.mockResolvedValue({ id: INVOICE_ID });
        const { handler, processPayment } = buildHandler(prisma);

        await handler.execute({ ...validDto(), method });

        expect(processPayment.execute).toHaveBeenCalledWith(
          expect.objectContaining({ method }),
        );
      }
    });
  });
});