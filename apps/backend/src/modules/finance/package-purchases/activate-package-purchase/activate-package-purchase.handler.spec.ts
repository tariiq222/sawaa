import { DiscountType, PackagePurchaseStatus, Prisma } from '@prisma/client';
import { ActivatePackagePurchaseHandler } from './activate-package-purchase.handler';

const PURCHASE_ID = '00000000-0000-4000-a000-000000000010';
const PACKAGE_ID = '00000000-0000-4000-a000-000000000001';
const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000006';

const pkgItem = {
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 1,
};

const pkgRow = {
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  items: [pkgItem],
};

const pendingPurchase = {
  id: PURCHASE_ID,
  packageId: PACKAGE_ID,
  status: PackagePurchaseStatus.PENDING,
  subtotalSnapshot: new Prisma.Decimal(40_000),
  discountSnapshot: new Prisma.Decimal(4_000),
};

function buildCls() {
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn(),
  };
}

function buildTx() {
  return {
    packagePurchase: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    packageCredit: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

function buildPrisma(purchase: unknown = pendingPurchase, pkg: unknown = pkgRow) {
  return {
    packagePurchase: { findFirst: jest.fn().mockResolvedValue(purchase) },
    sessionPackage: { findFirst: jest.fn().mockResolvedValue(pkg) },
  };
}

function buildPricing() {
  return {
    compute: jest.fn().mockResolvedValue({
      subtotal: 40_000,
      discountAmount: 4_000,
      finalPrice: 36_000,
      itemUnitPrices: [{ durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 }],
    }),
  };
}

function buildHandler(
  prisma = buildPrisma(),
  pricing = buildPricing(),
  tx = buildTx(),
) {
  const eb = { subscribe: jest.fn(), publish: jest.fn() };
  let subscriber: ((e: { payload: unknown }) => Promise<void>) | null = null;
  eb.subscribe = jest.fn((_evt, cb) => {
    subscriber = cb as typeof subscriber;
  });
  const cls = buildCls();
  const rls = { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  const handler = new ActivatePackagePurchaseHandler(
    prisma as never,
    rls as never,
    eb as never,
    cls as never,
    pricing as never,
  );
  handler.register();
  return { handler, prisma, eb, cls, tx, rls, pricing, getSubscriber: () => subscriber! };
}

const envelope = (overrides: Record<string, unknown> = {}) => ({
  payload: {
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    bookingId: null,
    packagePurchaseId: PURCHASE_ID,
    amount: 36_000,
    currency: 'SAR',
    ...overrides,
  },
});

describe('ActivatePackagePurchaseHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('subscribes to finance.payment.completed', () => {
    const { eb } = buildHandler();
    expect(eb.subscribe).toHaveBeenCalledWith('finance.payment.completed', expect.any(Function));
  });

  describe('success path', () => {
    it('flips the PENDING purchase to ACTIVE under a status-guarded updateMany', async () => {
      const { tx, getSubscriber } = buildHandler();

      await getSubscriber()(envelope());

      expect(tx.packagePurchase.updateMany).toHaveBeenCalledWith({
        where: { id: PURCHASE_ID, status: PackagePurchaseStatus.PENDING },
        data: expect.objectContaining({ status: PackagePurchaseStatus.ACTIVE }),
      });
    });

    it('issues one PackageCredit bucket per item with totalQuantity = paid + free', async () => {
      const { tx, getSubscriber } = buildHandler();

      await getSubscriber()(envelope());

      expect(tx.packageCredit.createMany).toHaveBeenCalledTimes(1);
      const rows = tx.packageCredit.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          purchaseId: PURCHASE_ID,
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          totalQuantity: 5, // 4 paid + 1 free
          usedQuantity: 0,
        }),
      );
      expect(Number(rows[0].unitPriceSnapshot)).toBe(10_000);
    });
  });

  describe('idempotency / no double-issue', () => {
    it('does NOTHING when the event carries no packagePurchaseId (booking invoice)', async () => {
      const { prisma, getSubscriber } = buildHandler();

      await getSubscriber()(envelope({ packagePurchaseId: null }));

      expect(prisma.packagePurchase.findFirst).not.toHaveBeenCalled();
    });

    it('does NOT issue credits when the purchase is already ACTIVE (duplicate webhook)', async () => {
      const prisma = buildPrisma({ ...pendingPurchase, status: PackagePurchaseStatus.ACTIVE });
      const { tx, getSubscriber } = buildHandler(prisma);

      await getSubscriber()(envelope());

      expect(tx.packagePurchase.updateMany).not.toHaveBeenCalled();
      expect(tx.packageCredit.createMany).not.toHaveBeenCalled();
    });

    it('does NOT issue credits when the purchase is REFUNDED', async () => {
      const prisma = buildPrisma({ ...pendingPurchase, status: PackagePurchaseStatus.REFUNDED });
      const { tx, getSubscriber } = buildHandler(prisma);

      await getSubscriber()(envelope());

      expect(tx.packageCredit.createMany).not.toHaveBeenCalled();
    });

    it('issues NO credits when the status-guarded flip races to count=0', async () => {
      const tx = buildTx();
      tx.packagePurchase.updateMany.mockResolvedValue({ count: 0 }); // lost the race
      const { getSubscriber } = buildHandler(buildPrisma(), buildPricing(), tx);

      await getSubscriber()(envelope());

      expect(tx.packagePurchase.updateMany).toHaveBeenCalled();
      expect(tx.packageCredit.createMany).not.toHaveBeenCalled();
    });

    it('skips silently when the purchase is unknown', async () => {
      const prisma = buildPrisma(null);
      const { tx, getSubscriber } = buildHandler(prisma);

      await getSubscriber()(envelope());

      expect(tx.packageCredit.createMany).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('rethrows on a DB error so the event is retried (no silent credit loss)', async () => {
      const tx = buildTx();
      tx.packagePurchase.updateMany.mockRejectedValue(new Error('db down'));
      const { getSubscriber } = buildHandler(buildPrisma(), buildPricing(), tx);

      await expect(getSubscriber()(envelope())).rejects.toThrow('db down');
    });

    it('does not throw (skips) when the package definition is gone', async () => {
      const prisma = buildPrisma(pendingPurchase, null);
      const { tx, getSubscriber } = buildHandler(prisma);

      await getSubscriber()(envelope());

      expect(tx.packageCredit.createMany).not.toHaveBeenCalled();
    });
  });
});
