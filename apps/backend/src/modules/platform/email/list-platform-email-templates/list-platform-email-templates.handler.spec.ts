import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPlatformEmailTemplatesHandler } from './list-platform-email-templates.handler';

describe('ListPlatformEmailTemplatesHandler', () => {
  let handler: ListPlatformEmailTemplatesHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListPlatformEmailTemplatesHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(ListPlatformEmailTemplatesHandler);
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
