import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { UpsertZoomConfigHandler } from './upsert-zoom-config.handler';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

describe('UpsertZoomConfigHandler', () => {
  let handler: UpsertZoomConfigHandler;
  let prisma: {
    integration: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let zoomCredentials: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
  };
  let zoomApi: {
    invalidateToken: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      integration: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'zoom-id' }),
      },
    };
    zoomCredentials = {
      encrypt: jest.fn().mockReturnValue('encrypted-ciphertext'),
      decrypt: jest.fn().mockReturnValue({
        zoomClientId: 'existing-client-id',
        zoomClientSecret: 'existing-client-secret',
        zoomAccountId: 'existing-account-id',
      }),
    };
    zoomApi = {
      invalidateToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertZoomConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ZoomCredentialsService, useValue: zoomCredentials },
        { provide: ZoomApiClient, useValue: zoomApi },
      ],
    }).compile();

    handler = module.get<UpsertZoomConfigHandler>(UpsertZoomConfigHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('creates new config with all fields', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);

    const dto: UpsertZoomConfigDto = {
      zoomClientId: 'new-client-id',
      zoomClientSecret: 'new-client-secret',
      zoomAccountId: 'new-account-id',
    };

    const result = await handler.execute(dto);

    expect(zoomCredentials.encrypt).toHaveBeenCalledWith(
      {
        zoomClientId: 'new-client-id',
        zoomClientSecret: 'new-client-secret',
        zoomAccountId: 'new-account-id',
      },
      DEFAULT_ORG_ID,
    );
    expect(prisma.integration.upsert).toHaveBeenCalledWith({
      where: { provider: 'zoom' },
      update: {
        config: { ciphertext: 'encrypted-ciphertext' },
        isActive: true,
      },
      create: {
        provider: 'zoom',
        config: { ciphertext: 'encrypted-ciphertext' },
        isActive: true,
      },
    });
    expect(zoomApi.invalidateToken).toHaveBeenCalledWith(DEFAULT_ORG_ID);
    expect(result).toEqual({ configured: true, isActive: true });
  });

  it('updates existing config with partial fields (merges with decrypted existing)', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      id: 'existing-id',
      provider: 'zoom',
      config: { ciphertext: 'existing-ciphertext' },
      isActive: true,
    });

    const dto: UpsertZoomConfigDto = {
      zoomClientId: 'updated-client-id',
    };

    await handler.execute(dto);

    expect(zoomCredentials.decrypt).toHaveBeenCalledWith('existing-ciphertext', DEFAULT_ORG_ID);
    expect(zoomCredentials.encrypt).toHaveBeenCalledWith(
      {
        zoomClientId: 'updated-client-id',
        zoomClientSecret: 'existing-client-secret',
        zoomAccountId: 'existing-account-id',
      },
      DEFAULT_ORG_ID,
    );
  });

  it('updates existing config with all new fields', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      id: 'existing-id',
      provider: 'zoom',
      config: { ciphertext: 'existing-ciphertext' },
      isActive: true,
    });

    const dto: UpsertZoomConfigDto = {
      zoomClientId: 'new-client-id',
      zoomClientSecret: 'new-client-secret',
      zoomAccountId: 'new-account-id',
    };

    await handler.execute(dto);

    expect(zoomCredentials.encrypt).toHaveBeenCalledWith(
      {
        zoomClientId: 'new-client-id',
        zoomClientSecret: 'new-client-secret',
        zoomAccountId: 'new-account-id',
      },
      DEFAULT_ORG_ID,
    );
  });

  it('throws when any required field missing after merge', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      id: 'existing-id',
      provider: 'zoom',
      config: { ciphertext: 'existing-ciphertext' },
      isActive: true,
    });

    zoomCredentials.decrypt.mockReturnValue({
      zoomClientId: '',
      zoomClientSecret: '',
      zoomAccountId: '',
    });

    await expect(handler.execute({})).rejects.toThrow(
      'zoomClientId, zoomClientSecret, and zoomAccountId are required',
    );
  });

  it('encrypts config with zoomCredentials', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);

    await handler.execute({
      zoomClientId: 'cid',
      zoomClientSecret: 'csec',
      zoomAccountId: 'aid',
    });

    expect(zoomCredentials.encrypt).toHaveBeenCalledTimes(1);
  });

  it('calls zoomApi.invalidateToken after upsert', async () => {
    prisma.integration.findUnique.mockResolvedValue(null);

    await handler.execute({
      zoomClientId: 'cid',
      zoomClientSecret: 'csec',
      zoomAccountId: 'aid',
    });

    expect(zoomApi.invalidateToken).toHaveBeenCalledWith(DEFAULT_ORG_ID);
  });

  it('handles existing config with no ciphertext (else branch)', async () => {
    prisma.integration.findUnique.mockResolvedValue({
      id: 'existing-id',
      provider: 'zoom',
      config: { someOtherField: 'value' },
      isActive: true,
    });

    const dto: UpsertZoomConfigDto = {
      zoomClientId: 'cid',
      zoomClientSecret: 'csec',
      zoomAccountId: 'aid',
    };

    await handler.execute(dto);

    expect(zoomCredentials.decrypt).not.toHaveBeenCalled();
    expect(zoomCredentials.encrypt).toHaveBeenCalledWith(
      {
        zoomClientId: 'cid',
        zoomClientSecret: 'csec',
        zoomAccountId: 'aid',
      },
      DEFAULT_ORG_ID,
    );
  });
});
