import { Test } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { ListCategoriesHandler } from './list-categories.handler';

describe('ListCategoriesHandler', () => {
  let handler: ListCategoriesHandler;
  let tx: { serviceCategory: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    tx = {
      serviceCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ListCategoriesHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(tx)) } },
    { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } }
      ],
    }).compile();

    handler = module.get(ListCategoriesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    await handler.execute({});
  });

  it('counts only non-archived services', async () => {
    await handler.execute({});

    expect(tx.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: {
            select: { services: { where: { archivedAt: null } } },
          },
        },
      }),
    );
  });
});
