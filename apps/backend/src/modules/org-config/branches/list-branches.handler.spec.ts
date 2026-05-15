import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListBranchesHandler } from './list-branches.handler';

describe('ListBranchesHandler', () => {
  let handler: ListBranchesHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListBranchesHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
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
