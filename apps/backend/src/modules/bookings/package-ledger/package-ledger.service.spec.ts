import { PackageCreditUsageStatus, PackagePurchaseStatus, Prisma } from '@prisma/client';
import { PackageLedgerService } from './package-ledger.service';

type MockTx = {
  packagePurchase: { create: jest.Mock; updateMany: jest.Mock };
  packageCredit: { create: jest.Mock };
  packagePurchaseGroup: { create: jest.Mock; update: jest.Mock };
  packageCreditUsage: { updateMany: jest.Mock };
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

const buildTx = (): MockTx => ({
  packagePurchase: { create: jest.fn(), updateMany: jest.fn() },
  packageCredit: { create: jest.fn() },
  packagePurchaseGroup: { create: jest.fn(), update: jest.fn() },
  packageCreditUsage: { updateMany: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
});

describe('PackageLedgerService', () => {
  let service: PackageLedgerService;
  let tx: MockTx;

  beforeEach(() => {
    service = new PackageLedgerService();
    tx = buildTx();
  });

  const asTx = () => tx as unknown as Prisma.TransactionClient;

  it('creates the purchase and returns the full row', async () => {
    const created = {
      id: 'p-1',
      packageId: 'pkg-1',
      clientId: 'c-1',
      branchId: 'b-1',
      status: PackagePurchaseStatus.PENDING,
      amountPaid: new Prisma.Decimal(100),
    };
    tx.packagePurchase.create.mockResolvedValue(created);
    await expect(
      service.createPackagePurchaseInTx(asTx(), {
        packageId: 'pkg-1',
        clientId: 'c-1',
        branchId: 'b-1',
        subtotalSnapshot: new Prisma.Decimal(100),
        discountSnapshot: new Prisma.Decimal(0),
        amountPaid: new Prisma.Decimal(100),
        paidAt: new Date('2026-01-01'),
      }),
    ).resolves.toEqual(created);
    // No `select`: callers read amountPaid/status right after creation, so
    // narrowing to { id } would force a second query inside the transaction.
    expect(tx.packagePurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ packageId: 'pkg-1' }),
    });
  });

  it('does not swallow a unique-constraint error from purchase creation', async () => {
    const conflict = Object.assign(new Error('unique'), { code: 'P2002' });
    tx.packagePurchase.create.mockRejectedValue(conflict);
    await expect(
      service.createPackagePurchaseInTx(asTx(), {
        packageId: 'pkg-1',
        clientId: 'c-1',
        branchId: 'b-1',
        subtotalSnapshot: new Prisma.Decimal(1),
        discountSnapshot: new Prisma.Decimal(0),
        amountPaid: new Prisma.Decimal(1),
        paidAt: new Date(),
      }),
    ).rejects.toBe(conflict);
  });

  it('flips PENDING to ACTIVE and reports activation', async () => {
    tx.packagePurchase.updateMany.mockResolvedValue({ count: 1 });
    const paidAt = new Date('2026-01-02');
    await expect(
      service.activatePendingPackagePurchaseInTx(asTx(), {
        purchaseId: 'p-1',
        paidAt,
      }),
    ).resolves.toEqual({ activated: true });
    expect(tx.packagePurchase.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-1', status: PackagePurchaseStatus.PENDING },
      data: { status: PackagePurchaseStatus.ACTIVE, paidAt },
    });
  });

  it('reports activated=false when a concurrent delivery already won', async () => {
    tx.packagePurchase.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.activatePendingPackagePurchaseInTx(asTx(), {
        purchaseId: 'p-1',
        paidAt: new Date(),
      }),
    ).resolves.toEqual({ activated: false });
  });

  it('locks the purchase row with SELECT ... FOR UPDATE', async () => {
    tx.$queryRaw.mockResolvedValue([
      {
        id: 'p-1',
        status: PackagePurchaseStatus.ACTIVE,
        amountPaid: new Prisma.Decimal(500),
        refundAmount: null,
        clientId: 'c-1',
        notes: null,
      },
    ]);
    const result = await service.lockPackagePurchaseForRefundInTx(asTx(), {
      purchaseId: 'p-1',
    });
    const sql = (tx.$queryRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('"PackagePurchase"');
    expect(result?.id).toBe('p-1');
  });

  it('returns null when the purchase does not exist', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.lockPackagePurchaseForRefundInTx(asTx(), { purchaseId: 'gone' }),
    ).resolves.toBeNull();
  });

  it('refunds only behind the status != REFUNDED guard', async () => {
    tx.packagePurchase.updateMany.mockResolvedValue({ count: 1 });
    const at = new Date('2026-01-03');
    await expect(
      service.markPackagePurchaseRefundInTx(asTx(), {
        purchaseId: 'p-1',
        status: PackagePurchaseStatus.REFUNDED,
        refundedAt: at,
        refundAmount: new Prisma.Decimal(500),
        notes: 'refunded',
      }),
    ).resolves.toEqual({ updated: true });
    expect(tx.packagePurchase.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'p-1',
        status: { not: PackagePurchaseStatus.REFUNDED },
      },
      data: {
        status: PackagePurchaseStatus.REFUNDED,
        refundedAt: at,
        refundAmount: new Prisma.Decimal(500),
        notes: 'refunded',
      },
    });
  });

  it('reports updated=false when someone already refunded', async () => {
    tx.packagePurchase.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markPackagePurchaseRefundInTx(asTx(), {
        purchaseId: 'p-1',
        status: PackagePurchaseStatus.REFUNDED,
        refundedAt: undefined,
        refundAmount: new Prisma.Decimal(0),
        notes: '',
      }),
    ).resolves.toEqual({ updated: false });
  });

  it('voids credits with one raw statement that pins used = total', async () => {
    tx.$executeRaw.mockResolvedValue(3);
    await service.voidPackageCreditsInTx(asTx(), { purchaseId: 'p-1' });
    const sql = (tx.$executeRaw.mock.calls[0][0] as string[]).join('?');
    expect(sql).toContain('"PackageCredit"');
    expect(sql).toContain('"usedQuantity" = "totalQuantity"');
    expect(sql).toContain('"reservedQuantity" = 0');
  });

  it('terminates only RESERVED usages and reports the count', async () => {
    tx.packageCreditUsage.updateMany.mockResolvedValue({ count: 2 });
    const at = new Date('2026-01-04');
    await expect(
      service.terminateReservedUsagesInTx(asTx(), { purchaseId: 'p-1', at }),
    ).resolves.toEqual({ terminated: 2 });
    expect(tx.packageCreditUsage.updateMany).toHaveBeenCalledWith({
      where: {
        credit: { purchaseId: 'p-1' },
        status: PackageCreditUsageStatus.RESERVED,
      },
      data: { status: PackageCreditUsageStatus.RETURNED, returnedAt: at },
    });
  });
});
