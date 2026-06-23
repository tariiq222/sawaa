import { Test, TestingModule } from '@nestjs/testing';
import * as cryptoUtil from '../crypto.util';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPlatformSettingHandler } from './get-platform-setting.handler';

describe('GetPlatformSettingHandler', () => {
  let handler: GetPlatformSettingHandler;
  let prisma: { platformSetting: { findUnique: jest.Mock } };
  let decryptSpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = {
      platformSetting: { findUnique: jest.fn() },
    };
    decryptSpy = jest.spyOn(cryptoUtil, 'decryptSecret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPlatformSettingHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetPlatformSettingHandler>(GetPlatformSettingHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when the platform setting does not exist', async () => {
    prisma.platformSetting.findUnique.mockResolvedValue(null);

    const result = await handler.execute('missing-key');

    expect(result).toBeNull();
    expect(prisma.platformSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'missing-key' },
    });
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it('decrypts the stored value with cryptoUtil.decryptSecret and returns plaintext', async () => {
    prisma.platformSetting.findUnique.mockResolvedValue({
      key: 'moyasar.publishable_key',
      value: 'ciphertext-1234',
    });
    decryptSpy.mockReturnValue('pk_test_decoded_value');

    const result = await handler.execute('moyasar.publishable_key');

    expect(decryptSpy).toHaveBeenCalledWith('ciphertext-1234');
    expect(result).toEqual({
      key: 'moyasar.publishable_key',
      value: 'pk_test_decoded_value',
    });
  });

  it('falls back to the raw stored value when decrypt throws (legacy plaintext rows)', async () => {
    // Decryption can fail if a row was written before encryption was enabled,
    // or if the encryption key was rotated. The handler must not blow up.
    prisma.platformSetting.findUnique.mockResolvedValue({
      key: 'legacy.key',
      value: 'plain-legacy-value',
    });
    decryptSpy.mockImplementation(() => {
      throw new Error('Unsupported state or unable to authenticate data');
    });

    const result = await handler.execute('legacy.key');

    expect(decryptSpy).toHaveBeenCalledWith('plain-legacy-value');
    expect(result).toEqual({
      key: 'legacy.key',
      value: 'plain-legacy-value',
    });
  });

  it('looks the row up by the requested key, not the stored key', async () => {
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    await handler.execute('zoom.client_id');
    expect(prisma.platformSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'zoom.client_id' },
    });
  });
});
