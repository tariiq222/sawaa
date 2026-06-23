import { Test, TestingModule } from '@nestjs/testing';
import * as cryptoUtil from '../crypto.util';
import { PrismaService } from '../../../../infrastructure/database';
import { UpsertPlatformSettingHandler } from './upsert-platform-setting.handler';
import { UpsertPlatformSettingDto } from './upsert-platform-setting.dto';

describe('UpsertPlatformSettingHandler', () => {
  let handler: UpsertPlatformSettingHandler;
  let prisma: { platformSetting: { upsert: jest.Mock } };
  let encryptSpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = {
      platformSetting: { upsert: jest.fn().mockResolvedValue(undefined) },
    };
    encryptSpy = jest
      .spyOn(cryptoUtil, 'encryptSecret')
      .mockImplementation((plain) => `enc(${plain})`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertPlatformSettingHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<UpsertPlatformSettingHandler>(UpsertPlatformSettingHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('encrypts dto.secret when present and writes it via upsert', async () => {
    const dto: UpsertPlatformSettingDto = {
      key: 'moyasar.secret_key',
      value: 'fallback',
      secret: 'sk_test_live_super_secret',
    };

    await handler.execute(dto, 'admin-1');

    expect(encryptSpy).toHaveBeenCalledWith('sk_test_live_super_secret');
    expect(encryptSpy).toHaveBeenCalledTimes(1);

    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'moyasar.secret_key' },
      create: {
        key: 'moyasar.secret_key',
        value: 'enc(sk_test_live_super_secret)',
        updatedBy: 'admin-1',
      },
      update: {
        value: 'enc(sk_test_live_super_secret)',
        updatedBy: 'admin-1',
      },
    });
  });

  it('falls back to encrypting dto.value when dto.secret is not provided', async () => {
    const dto: UpsertPlatformSettingDto = {
      key: 'platform.feature_flag',
      value: 'on',
    };

    await handler.execute(dto, 'admin-2');

    expect(encryptSpy).toHaveBeenCalledWith('on');
    expect(encryptSpy).toHaveBeenCalledTimes(1);
    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'platform.feature_flag' },
      create: {
        key: 'platform.feature_flag',
        value: 'enc(on)',
        updatedBy: 'admin-2',
      },
      update: {
        value: 'enc(on)',
        updatedBy: 'admin-2',
      },
    });
  });

  it('records the actor sub as updatedBy on both create and update branches', async () => {
    const dto: UpsertPlatformSettingDto = {
      key: 'audit.test',
      value: 'audit-value',
    };

    await handler.execute(dto, 'actor-with-sub-7');

    const call = prisma.platformSetting.upsert.mock.calls[0][0];
    expect(call.create.updatedBy).toBe('actor-with-sub-7');
    expect(call.update.updatedBy).toBe('actor-with-sub-7');
  });

  it('does not write a different value to the create vs update branches (single round-trip)', async () => {
    const dto: UpsertPlatformSettingDto = {
      key: 'k',
      value: 'v',
      secret: 's',
    };

    await handler.execute(dto, 'actor');

    const call = prisma.platformSetting.upsert.mock.calls[0][0];
    expect(call.create.value).toBe(call.update.value);
  });
});
