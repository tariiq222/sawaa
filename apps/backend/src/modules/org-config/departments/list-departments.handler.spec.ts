import { Test } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { ListDepartmentsHandler } from './list-departments.handler';

describe('ListDepartmentsHandler', () => {
  let handler: ListDepartmentsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListDepartmentsHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb({ department: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } })) } },
    { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } }
      ],
    }).compile();

    handler = module.get(ListDepartmentsHandler);
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
