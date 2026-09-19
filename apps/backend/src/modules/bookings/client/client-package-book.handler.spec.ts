import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeliveryType, PackagePurchaseStatus } from '@prisma/client';
import { BookFromCreditHandler } from '../book-from-credit/book-from-credit.handler';
import { PrismaService } from '../../../infrastructure/database';
import { ClientPackageBookHandler } from './client-package-book.handler';

const command = {
  creditId: 'credit-1',
  branchId: 'branch-1',
  scheduledAt: new Date('2026-12-01T10:00:00.000Z'),
};

function groupedCredit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'credit-1',
    purchaseId: 'purchase-1',
    totalQuantity: 1,
    usedQuantity: 0,
    reservedQuantity: 0,
    serviceId: 'service-1',
    employeeId: 'employee-1',
    durationOptionId: 'duration-1',
    durationMinsSnapshot: 60,
    deliveryTypeSnapshot: DeliveryType.IN_PERSON,
    purchase: { clientId: 'client-1', status: PackagePurchaseStatus.ACTIVE, modelVersion: 'GROUPED_V2' },
    ...overrides,
  };
}

function buildPrisma(credit: unknown) {
  return { packageCredit: { findFirst: jest.fn().mockResolvedValue(credit) } };
}

describe('ClientPackageBookHandler', () => {
  it('rejects an unknown or another-client credit before delegation', async () => {
    const prisma = buildPrisma(null);
    const book = { execute: jest.fn() };
    const handler = new ClientPackageBookHandler(
      prisma as unknown as PrismaService,
      book as unknown as BookFromCreditHandler,
    );

    await expect(handler.execute({ ...command, clientId: 'client-1' })).rejects.toThrow(NotFoundException);
    expect(book.execute).not.toHaveBeenCalled();
  });

  it('rejects a reserved or locked credit without delegating', async () => {
    const prisma = buildPrisma(groupedCredit({ reservedQuantity: 1 }));
    const book = { execute: jest.fn() };
    const handler = new ClientPackageBookHandler(
      prisma as unknown as PrismaService,
      book as unknown as BookFromCreditHandler,
    );

    await expect(handler.execute({ ...command, clientId: 'client-1' })).rejects.toThrow(ConflictException);
    expect(book.execute).not.toHaveBeenCalled();
  });

  it('derives grouped target fields from the owned credit before booking', async () => {
    const prisma = buildPrisma(groupedCredit());
    const book = { execute: jest.fn().mockResolvedValue({ id: 'booking-1' }) };
    const handler = new ClientPackageBookHandler(
      prisma as unknown as PrismaService,
      book as unknown as BookFromCreditHandler,
    );

    await handler.execute({ ...command, clientId: 'client-1', serviceId: 'forged-service', userId: 'forged-user' } as never);

    expect(book.execute).toHaveBeenCalledWith({
      clientId: 'client-1',
      creditId: 'credit-1',
      branchId: 'branch-1',
      scheduledAt: command.scheduledAt,
      serviceId: 'service-1',
      employeeId: 'employee-1',
      durationOptionId: 'duration-1',
      deliveryType: DeliveryType.IN_PERSON,
    });
  });
});
