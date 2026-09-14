import { NotFoundException } from '@nestjs/common';
import { PackagePurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientPackagePurchasesHandler } from '../../finance/package-purchases/list-client-package-purchases/list-client-package-purchases.handler';
import { ClientPackagePurchaseStatusHandler } from './client-package-purchase-status.handler';

describe('ClientPackagePurchaseStatusHandler', () => {
  it('reads only the caller-owned safe purchase status projection', async () => {
    const prisma = {
      packagePurchase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'purchase-1' }),
      },
    };
    const list = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 'purchase-1',
          packageId: 'package-1',
          packageNameAr: 'باقة',
          packageNameEn: 'Package',
          status: PackagePurchaseStatus.PENDING,
          subtotalSnapshot: 12500,
          discountSnapshot: 0,
          amountPaid: 12500,
          refundAmount: 0,
          paidAt: null,
          refundedAt: null,
          createdAt: '2026-09-14T10:00:00.000Z',
          modelVersion: 'LEGACY',
          credits: [],
          notes: 'internal note must not leak',
        },
      ]),
    };
    const handler = new ClientPackagePurchaseStatusHandler(
      prisma as unknown as PrismaService,
      list as unknown as ListClientPackagePurchasesHandler,
    );

    await expect(handler.execute('purchase-1', 'client-1')).resolves.toEqual({
      id: 'purchase-1',
      packageId: 'package-1',
      packageNameAr: 'باقة',
      packageNameEn: 'Package',
      status: PackagePurchaseStatus.PENDING,
      subtotalSnapshot: 12500,
      discountSnapshot: 0,
      amountPaid: 12500,
      refundAmount: 0,
      paidAt: null,
      refundedAt: null,
      createdAt: '2026-09-14T10:00:00.000Z',
      modelVersion: 'LEGACY',
      credits: [],
    });
    expect(prisma.packagePurchase.findFirst).toHaveBeenCalledWith({
      where: { id: 'purchase-1', clientId: 'client-1' },
      select: { id: true },
    });
    expect(list.execute).toHaveBeenCalledWith({ clientId: 'client-1' });
  });

  it('does not disclose another client purchase', async () => {
    const prisma = { packagePurchase: { findFirst: jest.fn().mockResolvedValue(null) } };
    const handler = new ClientPackagePurchaseStatusHandler(
      prisma as unknown as PrismaService,
      { execute: jest.fn() } as unknown as ListClientPackagePurchasesHandler,
    );

    await expect(handler.execute('purchase-2', 'client-1')).rejects.toThrow(NotFoundException);
  });
});
