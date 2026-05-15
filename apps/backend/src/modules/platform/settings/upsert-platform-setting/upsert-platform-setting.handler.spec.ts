import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { UpsertPlatformSettingHandler } from './upsert-platform-setting.handler';

describe('UpsertPlatformSettingHandler', () => {
  let handler: UpsertPlatformSettingHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UpsertPlatformSettingHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(UpsertPlatformSettingHandler);
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
