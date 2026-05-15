import { Test } from '@nestjs/testing';
import { PaymentStatus } from '@prisma/client';
import { GetPaymentStatsHandler } from './get-payment-stats.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetPaymentStatsHandler', () => {
  let handler: GetPaymentStatsHandler;
  let prisma: { payment: { groupBy: jest.Mock } };

  beforeEach(async () => {
    prisma = { payment: { groupBy: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        GetPaymentStatsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetPaymentStatsHandler);
  });

  it('returns zero stats when no payments exist', async () => {
    prisma.payment.groupBy.mockResolvedValue([]);
    const result = await handler.execute();
    expect(result).toEqual({
      total: 0,
      totalAmount: 0,
      completed: 0,
      completedAmount: 0,
      pending: 0,
      pendingAmount: 0,
      pendingVerification: 0,
      pendingVerificationAmount: 0,
      refunded: 0,
      refundedAmount: 0,
      failed: 0,
    });
  });

  it('aggregates all payment statuses', async () => {
    prisma.payment.groupBy.mockResolvedValue([
      { status: PaymentStatus.COMPLETED, _count: { id: 5 }, _sum: { amount: { toNumber: () => 500 } } },
      { status: PaymentStatus.PENDING, _count: { id: 3 }, _sum: { amount: { toNumber: () => 300 } } },
      { status: PaymentStatus.PENDING_VERIFICATION, _count: { id: 2 }, _sum: { amount: { toNumber: () => 200 } } },
      { status: PaymentStatus.REFUNDED, _count: { id: 1 }, _sum: { amount: { toNumber: () => 100 } } },
      { status: PaymentStatus.FAILED, _count: { id: 4 }, _sum: { amount: { toNumber: () => 400 } } },
    ]);
    const result = await handler.execute();
    expect(result.total).toBe(15);
    expect(result.totalAmount).toBe(1500);
    expect(result.completed).toBe(5);
    expect(result.completedAmount).toBe(500);
    expect(result.pending).toBe(3);
    expect(result.pendingAmount).toBe(300);
    expect(result.pendingVerification).toBe(2);
    expect(result.pendingVerificationAmount).toBe(200);
    expect(result.refunded).toBe(1);
    expect(result.refundedAmount).toBe(100);
    expect(result.failed).toBe(4);
  });

  it('handles null amount via fallback', async () => {
    prisma.payment.groupBy.mockResolvedValue([
      { status: PaymentStatus.COMPLETED, _count: { id: 1 }, _sum: { amount: null } },
    ]);
    const result = await handler.execute();
    expect(result.completedAmount).toBe(0);
  });
});
