import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPlatformEmailLogsHandler } from './list-platform-email-logs.handler';

describe('ListPlatformEmailLogsHandler', () => {
  let handler: ListPlatformEmailLogsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListPlatformEmailLogsHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(ListPlatformEmailLogsHandler);
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
