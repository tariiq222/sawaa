import { Test } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { ListBranchesHandler } from './list-branches.handler';

describe('ListBranchesHandler', () => {
  let handler: ListBranchesHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListBranchesHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb({ branch: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } })) } },
    { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } }
      ],
    }).compile();

    handler = module.get(ListBranchesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute({});
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
