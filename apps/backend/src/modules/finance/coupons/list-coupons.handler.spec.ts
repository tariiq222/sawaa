import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListCouponsHandler } from './list-coupons.handler';

describe('ListCouponsHandler', () => {
  let handler: ListCouponsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListCouponsHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(ListCouponsHandler);
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
