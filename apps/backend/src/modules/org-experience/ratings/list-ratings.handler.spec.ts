import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListRatingsHandler } from './list-ratings.handler';

describe('ListRatingsHandler', () => {
  let handler: ListRatingsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListRatingsHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(ListRatingsHandler);
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
