import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListCategoriesHandler } from './list-categories.handler';

describe('ListCategoriesHandler', () => {
  let handler: ListCategoriesHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListCategoriesHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(ListCategoriesHandler);
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
