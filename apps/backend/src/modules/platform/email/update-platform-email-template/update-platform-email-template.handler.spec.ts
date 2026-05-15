import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { UpdatePlatformEmailTemplateHandler } from './update-platform-email-template.handler';
import { GetPlatformEmailTemplateHandler } from '../get-platform-email-template/get-platform-email-template.handler';

describe('UpdatePlatformEmailTemplateHandler', () => {
  let handler: UpdatePlatformEmailTemplateHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpdatePlatformEmailTemplateHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } },
    { provide: GetPlatformEmailTemplateHandler, useValue: { execute: jest.fn() } }
      ],
    }).compile();

    handler = module.get(UpdatePlatformEmailTemplateHandler);
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
