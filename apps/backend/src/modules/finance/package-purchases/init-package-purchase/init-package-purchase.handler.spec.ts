import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType, PackagePurchaseStatus, PaymentStatus, Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../../common/constants';
import { InitPackagePurchaseHandler } from './init-package-purchase.handler';

const PACKAGE_ID = '00000000-0000-4000-a000-000000000001';
const CLIENT_ID = '00000000-0000-4000-a000-000000000002';
const BRANCH_ID = '00000000-0000-4000-a000-000000000003';
const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
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

const PACKAGE_ROW = {
  id: PACKAGE_ID,
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  isActive: true,
  isPublic: true,
  archivedAt: null,
  items: [ITEM],
};

const FINAL_PRICE = 36_000;

function buildTx() {
  return {
    packagePurchase: { create: jest.fn().mockResolvedValue({ id: PURCHASE_ID }) },
    invoice: { create: jest.fn().mockResolvedValue({ id: INVOICE_ID }) },
    payment: { create: jest.fn().mockResolvedValue({ id: PAYMENT_ID }) },
  };
}

function buildPrisma() {
  return {
    sessionPackage: { findFirst: jest.fn().mockResolvedValue(PACKAGE_ROW) },
    client: { findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ID }) },
    packagePurchase: { findFirst: jest.fn().mockResolvedValue(null) },
    invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: PAYMENT_ID }),
      update: jest.fn().mockResolvedValue({ id: PAYMENT_ID }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

function buildPricing(finalPrice = FINAL_PRICE) {
  return {
    compute: jest.fn().mockResolvedValue({
      subtotal: 40_000,
      discountAmount: 4_000,
      finalPrice,
      itemUnitPrices: [{ durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 }],
    }),
  };
}

function buildMoyasar(redirectUrl: string | null = 'https://checkout.moyasar.com/pay/abc') {
  return {
    createPayment: jest.fn().mockResolvedValue({ id: 'moy-pay-1', redirectUrl }),
  };
}

function buildHandler(
  prisma = buildPrisma(),
  pricing = buildPricing(),
  moyasar = buildMoyasar(),
  tx = buildTx(),
) {
  const rls = { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  const handler = new InitPackagePurchaseHandler(
    prisma as never,
    rls as never,
    pricing as never,
    moyasar as never,
  );
  return { handler, prisma, pricing, moyasar, tx, rls };
}

const cmd = () => ({ packageId: PACKAGE_ID, branchId: BRANCH_ID, clientId: CLIENT_ID });

describe('InitPackagePurchaseHandler', () => {
  afterEach(() => jest.clearAllMocks());

  describe('happy path — self-purchase init', () => {
    it('freezes the price, creates a PENDING purchase, an invoice + PENDING payment, and returns the Moyasar redirect', async () => {
      const { handler, tx, moyasar, pricing } = buildHandler();

      const result = await handler.execute(cmd());

      // Price frozen via the same service the catalog/reception use.
      expect(pricing.compute).toHaveBeenCalledTimes(1);

      // Purchase is PENDING (NOT consumable) and carries the snapshot.
      const purchaseData = tx.packagePurchase.create.mock.calls[0][0].data;
      expect(purchaseData.status).toBe(PackagePurchaseStatus.PENDING);
      expect(Number(purchaseData.subtotalSnapshot)).toBe(40_000);
      expect(Number(purchaseData.amountPaid)).toBe(FINAL_PRICE);

      // Invoice linked via packagePurchaseId, VAT=0, ISSUED.
      const invoiceData = tx.invoice.create.mock.calls[0][0].data;
      expect(invoiceData.packagePurchaseId).toBe(PURCHASE_ID);
      expect(invoiceData.bookingId).toBeNull();
      expect(Number(invoiceData.vatRate)).toBe(0);
      expect(Number(invoiceData.total)).toBe(FINAL_PRICE);
      expect(invoiceData.status).toBe('ISSUED');

      // PENDING payment keyed by client-pkg:<invoice>.
      const paymentData = tx.payment.create.mock.calls[0][0].data;
      expect(paymentData.status).toBe(PaymentStatus.PENDING);
      expect(paymentData.idempotencyKey).toBe(`client-pkg:${INVOICE_ID}`);

      // Moyasar called with halalas amount + metadata the UNCHANGED webhook reads.
      expect(moyasar.createPayment).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({
          amountHalalas: FINAL_PRICE,
          currency: 'SAR',
          metadata: expect.objectContaining({
            invoiceId: INVOICE_ID,
            packagePurchaseId: PURCHASE_ID,
            source: 'self-purchase',
          }),
        }),
      );
      // given_id is a fresh UUID per attempt (gateway idempotency identity).
      const moyasarArg = moyasar.createPayment.mock.calls[0][1];
      expect(moyasarArg.givenId).toMatch(/^[0-9a-f-]{36}$/);

      expect(result).toEqual({
        purchaseId: PURCHASE_ID,
        invoiceId: INVOICE_ID,
        paymentId: PAYMENT_ID,
        redirectUrl: 'https://checkout.moyasar.com/pay/abc',
      });
    });

    it('does NOT create any PackageCredit at init time (credits are issued only on webhook activation)', async () => {
      const tx = buildTx() as ReturnType<typeof buildTx> & { packageCredit?: unknown };
      const { handler } = buildHandler(buildPrisma(), buildPricing(), buildMoyasar(), tx);

      await handler.execute(cmd());

      // The transaction object has no packageCredit method — the handler must not
      // attempt to create credits before payment.
      expect(tx.packageCredit).toBeUndefined();
    });

    it('stamps the Moyasar payment id on the payment row after the gateway returns', async () => {
      const prisma = buildPrisma();
      const { handler } = buildHandler(prisma);

      await handler.execute(cmd());

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: { gatewayRef: 'moy-pay-1' },
      });
    });
  });

  describe('package eligibility', () => {
    it('throws NotFoundException when the package is not public/active/non-archived', async () => {
      const prisma = buildPrisma();
      prisma.sessionPackage.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    });

    it('scopes the package lookup to public + active + non-archived', async () => {
      const prisma = buildPrisma();
      const { handler } = buildHandler(prisma);

      await handler.execute(cmd());

      expect(prisma.sessionPackage.findFirst.mock.calls[0][0].where).toEqual({
        id: PACKAGE_ID,
        isPublic: true,
        isActive: true,
        archivedAt: null,
      });
    });

    it('throws NotFoundException when the client does not exist', async () => {
      const prisma = buildPrisma();
      prisma.client.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    });

    it('rejects a package below the gateway minimum (free / sub-1-SAR package)', async () => {
      const { handler, moyasar } = buildHandler(buildPrisma(), buildPricing(50));

      await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
      expect(moyasar.createPayment).not.toHaveBeenCalled();
    });
  });

  describe('gateway edge cases', () => {
    it('throws when Moyasar returns no redirect URL', async () => {
      const { handler } = buildHandler(buildPrisma(), buildPricing(), buildMoyasar(null));

      await expect(handler.execute(cmd())).rejects.toThrow(/redirect URL/i);
    });

    it('propagates a Moyasar create failure (no redirect issued)', async () => {
      const moyasar = buildMoyasar();
      moyasar.createPayment.mockRejectedValue(new Error('gateway 500'));
      const { handler } = buildHandler(buildPrisma(), buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow('gateway 500');
    });
  });

  describe('idempotency — in-flight PENDING reuse', () => {
    it('reuses an existing PENDING purchase + invoice and re-issues a fresh payment instead of creating duplicates', async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({ id: PURCHASE_ID });
      prisma.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID });
      prisma.payment.findFirst.mockResolvedValue({ id: 'old-pay', status: PaymentStatus.PENDING });
      const tx = buildTx();
      const { handler } = buildHandler(prisma, buildPricing(), buildMoyasar(), tx);

      const result = await handler.execute(cmd());

      // No NEW purchase/invoice created in a transaction — reuse path.
      expect(tx.packagePurchase.create).not.toHaveBeenCalled();
      expect(tx.invoice.create).not.toHaveBeenCalled();
      // Stale PENDING payment deleted, fresh one created.
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'old-pay' } });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result.purchaseId).toBe(PURCHASE_ID);
      expect(result.invoiceId).toBe(INVOICE_ID);
    });

    it('refuses to re-charge a purchase whose payment already COMPLETED', async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({ id: PURCHASE_ID });
      prisma.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID });
      prisma.payment.findFirst.mockResolvedValue({ id: 'paid', status: PaymentStatus.COMPLETED });
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    });
  });
});
