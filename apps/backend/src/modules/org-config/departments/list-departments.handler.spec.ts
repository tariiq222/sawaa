import { Test } from '@nestjs/testing';
import { ListDepartmentsHandler } from './list-departments.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('ListDepartmentsHandler', () => {
  let handler: ListDepartmentsHandler;
  let tx: { department: { findMany: jest.Mock; count: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };
  let cache: { getOrSet: jest.Mock };

  beforeEach(async () => {
    tx = { department: { findMany: jest.fn(), count: jest.fn() } };
    rlsTransaction = {
      withTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    };
    cache = { getOrSet: jest.fn((_key, fn: () => unknown) => fn()) };

    const module = await Test.createTestingModule({
      providers: [
        ListDepartmentsHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get(ListDepartmentsHandler);
  });

  it('returns a paginated list of departments with bookableCategoriesCount', async () => {
    tx.department.findMany.mockResolvedValue([
      {
        id: 'd1',
        nameAr: 'قسم',
        categories: [
          { id: 'c1', nameAr: 'فئة', bookingMode: 'DIRECT', _count: { services: 0 } },
          { id: 'c2', nameAr: 'فئة 2', bookingMode: 'GROUP', _count: { services: 1 } },
        ],
      },
    ]);
    tx.department.count.mockResolvedValue(1);
    const result = await handler.execute({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].bookableCategoriesCount).toBe(2);
    expect(result.items[0].categories).toEqual([
      { id: 'c1', nameAr: 'فئة', bookingMode: 'DIRECT' },
      { id: 'c2', nameAr: 'فئة 2', bookingMode: 'GROUP' },
    ]);
    expect(cache.getOrSet).toHaveBeenCalledTimes(1);
  });

  it('applies isActive + search filters', async () => {
    tx.department.findMany.mockResolvedValue([]);
    tx.department.count.mockResolvedValue(0);
    await handler.execute({ isActive: true, search: 'Riyadh' });
    expect(tx.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            expect.objectContaining({ nameAr: expect.anything() }),
            expect.objectContaining({ nameEn: expect.anything() }),
          ]),
        }),
      }),
    );
  });
});