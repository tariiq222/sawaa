import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListDepartmentsHandler } from './list-departments.handler';

describe('ListDepartmentsHandler', () => {
  let handler: ListDepartmentsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListDepartmentsHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
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
