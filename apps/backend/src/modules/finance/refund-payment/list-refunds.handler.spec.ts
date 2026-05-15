import { Test } from '@nestjs/testing';
import { ListRefundsHandler } from './list-refunds.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListRefundsHandler', () => {
  let handler: ListRefundsHandler;
  let prisma: { refundRequest: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { refundRequest: { findMany: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        ListRefundsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(ListRefundsHandler);
  });

  it('returns all refunds without status filter', async () => {
    prisma.refundRequest.findMany.mockResolvedValue([
      { id: 'r1', amount: 100, createdAt: new Date('2026-01-01'), processedAt: new Date('2026-01-02'), reason: 'x', denialReason: null },
    ]);
    const result = await handler.execute();
    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(result[0].amount).toBe(100);
    expect(result[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0].processedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('filters by status', async () => {
    prisma.refundRequest.findMany.mockResolvedValue([]);
    await handler.execute('PENDING');
    expect(prisma.refundRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
  });

  it('handles null processedAt', async () => {
    prisma.refundRequest.findMany.mockResolvedValue([
      { id: 'r1', amount: 50, createdAt: new Date('2026-01-01'), processedAt: null, reason: null, denialReason: 'no' },
    ]);
    const result = await handler.execute();
    expect(result[0].processedAt).toBeNull();
    expect(result[0].reason).toBeNull();
    expect(result[0].denialReason).toBe('no');
  });
});
