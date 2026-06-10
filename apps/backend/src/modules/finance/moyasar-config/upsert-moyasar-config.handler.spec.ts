import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import {
  UpsertMoyasarConfigHandler,
  UpsertMoyasarConfigCommand,
} from './upsert-moyasar-config.handler';
import {
  DEFAULT_ORG_ID,
  PAYMENT_CONFIG_SINGLETON_KEY,
} from '../../../common/constants';

describe('UpsertMoyasarConfigHandler', () => {
  let handler: UpsertMoyasarConfigHandler;
  let prisma: {
    organizationPaymentConfig: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let creds: { encrypt: jest.Mock };
  let moyasarClient: { invalidate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      organizationPaymentConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({
          id: 'row-id',
          publishableKey: 'pk_test_new',
          isLive: false,
          updatedAt: new Date('2026-01-01'),
        }),
      },
    };
    creds = { encrypt: jest.fn().mockReturnValue('encrypted-value') };
    moyasarClient = { invalidate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertMoyasarConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MoyasarCredentialsService, useValue: creds },
        { provide: MoyasarApiClient, useValue: moyasarClient },
      ],
    }).compile();

    handler = module.get<UpsertMoyasarConfigHandler>(UpsertMoyasarConfigHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('upserts new config keyed on the singleton key with all fields provided', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

    const cmd: UpsertMoyasarConfigCommand = {
      publishableKey: 'pk_test_xxx',
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
      isLive: true,
    };

    const result = await handler.execute(cmd);

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        create: {
          singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
          publishableKey: 'pk_test_xxx',
          secretKeyEnc: 'encrypted-value',
          webhookSecretEnc: 'encrypted-value',
          isLive: true,
        },
      }),
    );
    expect(creds.encrypt).toHaveBeenCalledWith({ secretKey: 'sk_test_xxx' }, DEFAULT_ORG_ID);
    expect(creds.encrypt).toHaveBeenCalledWith({ webhookSecret: 'whsec_xxx' }, DEFAULT_ORG_ID);
    expect(moyasarClient.invalidate).toHaveBeenCalledWith(DEFAULT_ORG_ID);
    expect(result.organizationId).toBe(DEFAULT_ORG_ID);
  });

  it('throws when secretKey or webhookSecret missing on create', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute({ publishableKey: 'pk_test_xxx' } as UpsertMoyasarConfigCommand),
    ).rejects.toThrow('secretKey and webhookSecret are required when creating a new Moyasar config');

    await expect(
      handler.execute({ publishableKey: 'pk_test_xxx', secretKey: 'sk_test_xxx' } as UpsertMoyasarConfigCommand),
    ).rejects.toThrow('secretKey and webhookSecret are required when creating a new Moyasar config');

    expect(prisma.organizationPaymentConfig.upsert).not.toHaveBeenCalled();
  });

  it('updates existing config with partial fields (keeps existing encrypted values)', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
      id: 'existing-id',
      singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
      publishableKey: 'pk_test_old',
      secretKeyEnc: 'existing-secret',
      webhookSecretEnc: 'existing-webhook',
      isLive: true,
      updatedAt: new Date('2026-01-01'),
    });

    await handler.execute({ publishableKey: 'pk_test_new' });

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        update: {
          publishableKey: 'pk_test_new',
          secretKeyEnc: 'existing-secret',
          webhookSecretEnc: 'existing-webhook',
          isLive: true,
          lastVerifiedAt: null,
          lastVerifiedStatus: null,
        },
      }),
    );
    expect(creds.encrypt).not.toHaveBeenCalled();
  });

  it('updates existing config with new secretKey and webhookSecret', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
      id: 'existing-id',
      singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
      publishableKey: 'pk_test_old',
      secretKeyEnc: 'existing-secret',
      webhookSecretEnc: 'existing-webhook',
      isLive: false,
      updatedAt: new Date('2026-01-01'),
    });

    await handler.execute({
      publishableKey: 'pk_test_new',
      secretKey: 'sk_test_new',
      webhookSecret: 'whsec_new',
    });

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          publishableKey: 'pk_test_new',
          secretKeyEnc: 'encrypted-value',
          webhookSecretEnc: 'encrypted-value',
          isLive: false,
          lastVerifiedAt: null,
          lastVerifiedStatus: null,
        },
      }),
    );
    expect(creds.encrypt).toHaveBeenCalledTimes(2);
  });

  it('defaults isLive to false on create', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

    await handler.execute({
      publishableKey: 'pk_test_xxx',
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    });

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isLive: false }),
      }),
    );
  });

  it('keeps existing isLive on update when not provided', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
      id: 'existing-id',
      singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
      publishableKey: 'pk_test_old',
      secretKeyEnc: 'existing-secret',
      webhookSecretEnc: 'existing-webhook',
      isLive: true,
      updatedAt: new Date('2026-01-01'),
    });

    await handler.execute({ publishableKey: 'pk_test_new' });

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ isLive: true }),
      }),
    );
  });

  it('invalidates moyasar client cache after upsert', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

    await handler.execute({
      publishableKey: 'pk_test_xxx',
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    });

    expect(moyasarClient.invalidate).toHaveBeenCalledWith(DEFAULT_ORG_ID);
  });

  it('uses DEFAULT_ORG_ID for encryption', async () => {
    prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

    await handler.execute({
      publishableKey: 'pk_test_xxx',
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    });

    expect(creds.encrypt).toHaveBeenCalledWith(
      expect.any(Object),
      DEFAULT_ORG_ID,
    );
  });
});
