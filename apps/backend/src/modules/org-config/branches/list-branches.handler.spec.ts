import { Test } from '@nestjs/testing';
import { ListBranchesHandler } from './list-branches.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('ListBranchesHandler', () => {
  let handler: ListBranchesHandler;
  let tx: { branch: { findMany: jest.Mock; count: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };
  let cache: { getOrSet: jest.Mock };

  beforeEach(async () => {
    tx = { branch: { findMany: jest.fn(), count: jest.fn() } };
    rlsTransaction = {
      withTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    };
    cache = { getOrSet: jest.fn((_key, fn: () => unknown) => fn()) };

    const module = await Test.createTestingModule({
      providers: [
        ListBranchesHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get(ListBranchesHandler);
  });

  it('returns paginated branches wrapped via cache.getOrSet', async () => {
    const items = [{ id: 'b1', nameAr: 'فرع' }];
    tx.branch.findMany.mockResolvedValue(items);
    tx.branch.count.mockResolvedValue(1);
    const result = await handler.execute({ page: 1, limit: 20 });
    expect(result.items).toBe(items);
    expect(result.meta.total).toBe(1);
    expect(cache.getOrSet).toHaveBeenCalledTimes(1);
  });

  it('applies isActive filter when provided', async () => {
    tx.branch.findMany.mockResolvedValue([]);
    tx.branch.count.mockResolvedValue(0);
    await handler.execute({ isActive: true });
    expect(tx.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('applies search OR clause across nameAr/nameEn/phone', async () => {
    tx.branch.findMany.mockResolvedValue([]);
    tx.branch.count.mockResolvedValue(0);
    await handler.execute({ search: 'Riyadh' });
    expect(tx.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ nameAr: expect.anything() }),
            expect.objectContaining({ nameEn: expect.anything() }),
            expect.objectContaining({ phone: expect.anything() }),
          ]),
        }),
      }),
    );
  });
});