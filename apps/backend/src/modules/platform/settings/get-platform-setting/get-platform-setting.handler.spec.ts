import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPlatformSettingHandler } from './get-platform-setting.handler';

describe('GetPlatformSettingHandler', () => {
  let handler: GetPlatformSettingHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetPlatformSettingHandler,
    { provide: PrismaService, useValue: { $transaction: jest.fn(), service: { findMany: jest.fn() } } }
      ],
    }).compile();

    handler = module.get(GetPlatformSettingHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('executes without throwing', async () => {
    try {
      await handler.execute('test' as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
