import { Test } from '@nestjs/testing';
import { ListDiscountReasonsHandler } from './list-discount-reasons.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListDiscountReasonsHandler', () => {
  let handler: ListDiscountReasonsHandler;
  let prisma: { discountReason: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { discountReason: { findMany: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        ListDiscountReasonsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(ListDiscountReasonsHandler);
  });

  it('filters by isActive=true by default', async () => {
    prisma.discountReason.findMany.mockResolvedValue([]);
    await handler.execute();
    expect(prisma.discountReason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('includes inactive reasons when includeInactive is true', async () => {
    prisma.discountReason.findMany.mockResolvedValue([]);
    await handler.execute({ includeInactive: true });
    expect(prisma.discountReason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('orders by sortOrder asc then createdAt asc', async () => {
    prisma.discountReason.findMany.mockResolvedValue([]);
    await handler.execute();
    expect(prisma.discountReason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });
});