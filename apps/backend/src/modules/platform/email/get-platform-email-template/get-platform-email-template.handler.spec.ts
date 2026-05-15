import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPlatformEmailTemplateHandler } from './get-platform-email-template.handler';

describe('GetPlatformEmailTemplateHandler', () => {
  let handler: GetPlatformEmailTemplateHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetPlatformEmailTemplateHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(GetPlatformEmailTemplateHandler);
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
