import { BadRequestException } from '@nestjs/common';
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
          publishableKey: 'pk_live_new',
          isLive: true,
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
      publishableKey: 'pk_live_xxx',
      secretKey: 'sk_live_xxx',
      webhookSecret: 'whsec_xxx',
      isLive: true,
    };

    const result = await handler.execute(cmd);

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        create: {
          singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
          publishableKey: 'pk_live_xxx',
          secretKeyEnc: 'encrypted-value',
          webhookSecretEnc: 'encrypted-value',
          isLive: true,
        },
      }),
    );
    expect(creds.encrypt).toHaveBeenCalledWith({ secretKey: 'sk_live_xxx' }, DEFAULT_ORG_ID);
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
      publishableKey: 'pk_live_old',
      secretKeyEnc: 'existing-secret',
      webhookSecretEnc: 'existing-webhook',
      isLive: true,
      updatedAt: new Date('2026-01-01'),
    });

    await handler.execute({ publishableKey: 'pk_live_new' });

    expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { singletonKey: PAYMENT_CONFIG_SINGLETON_KEY },
        update: {
          publishableKey: 'pk_live_new',
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
      publishableKey: 'pk_live_old',
      secretKeyEnc: 'existing-secret',
      webhookSecretEnc: 'existing-webhook',
      isLive: true,
      updatedAt: new Date('2026-01-01'),
    });

    await handler.execute({ publishableKey: 'pk_live_new' });

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

  describe('Moyasar key mode validation', () => {
    const webhookSecret = 'whsec_xxx';

    async function expectKeyModeMismatch(
      cmd: UpsertMoyasarConfigCommand,
      expectedFragment: string,
      forbiddenValues: string[],
    ) {
      const outcome = await handler.execute(cmd).catch((e: unknown) => e);
      expect(outcome).toBeInstanceOf(BadRequestException);
      const message = (outcome as BadRequestException).message;
      expect(message).toContain(expectedFragment);
      // Key material must never leak into the error message.
      for (const value of forbiddenValues) {
        expect(message).not.toContain(value);
      }
      // Validation must run before encryption, any write, or cache invalidation.
      expect(creds.encrypt).not.toHaveBeenCalled();
      expect(prisma.organizationPaymentConfig.upsert).not.toHaveBeenCalled();
      expect(moyasarClient.invalidate).not.toHaveBeenCalled();
    }

    it('rejects a test publishable key when creating in live mode', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      await expectKeyModeMismatch(
        { publishableKey: 'pk_test_xxx', secretKey: 'sk_live_xxx', webhookSecret, isLive: true },
        'pk_live_',
        ['pk_test_xxx', 'sk_live_xxx'],
      );
    });

    it('rejects a test secret key when creating in live mode', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      await expectKeyModeMismatch(
        { publishableKey: 'pk_live_xxx', secretKey: 'sk_test_xxx', webhookSecret, isLive: true },
        'sk_live_',
        ['sk_test_xxx', 'pk_live_xxx'],
      );
    });

    it('rejects a live publishable key when creating in test mode', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      await expectKeyModeMismatch(
        { publishableKey: 'pk_live_xxx', secretKey: 'sk_test_xxx', webhookSecret, isLive: false },
        'pk_test_',
        ['pk_live_xxx', 'sk_test_xxx'],
      );
    });

    it('rejects a live secret key when creating in test mode', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      await expectKeyModeMismatch(
        { publishableKey: 'pk_test_xxx', secretKey: 'sk_live_xxx', webhookSecret, isLive: false },
        'sk_test_',
        ['sk_live_xxx', 'pk_test_xxx'],
      );
    });

    it('rejects a test publishable key when effective mode comes from the existing live config', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
        id: 'existing-id',
        singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
        publishableKey: 'pk_live_old',
        secretKeyEnc: 'existing-secret',
        webhookSecretEnc: 'existing-webhook',
        isLive: true,
        updatedAt: new Date('2026-01-01'),
      });

      await expectKeyModeMismatch(
        { publishableKey: 'pk_test_xxx' },
        'pk_live_',
        ['pk_test_xxx'],
      );
    });

    it('rejects a test secret key when effective mode comes from the existing live config', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
        id: 'existing-id',
        singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
        publishableKey: 'pk_live_old',
        secretKeyEnc: 'existing-secret',
        webhookSecretEnc: 'existing-webhook',
        isLive: true,
        updatedAt: new Date('2026-01-01'),
      });

      await expectKeyModeMismatch(
        { publishableKey: 'pk_live_new', secretKey: 'sk_test_xxx' },
        'sk_live_',
        ['sk_test_xxx'],
      );
    });

    it('rejects a live publishable key when effective mode defaults to test', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      await expectKeyModeMismatch(
        { publishableKey: 'pk_live_xxx', secretKey: 'sk_test_xxx', webhookSecret },
        'pk_test_',
        ['pk_live_xxx'],
      );
    });

    it('accepts matching live keys on create and writes live mode', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue(null);

      const result = await handler.execute({
        publishableKey: 'pk_live_xxx',
        secretKey: 'sk_live_xxx',
        webhookSecret,
        isLive: true,
      });

      expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            publishableKey: 'pk_live_xxx',
            isLive: true,
          }),
        }),
      );
      expect(creds.encrypt).toHaveBeenCalledWith({ secretKey: 'sk_live_xxx' }, DEFAULT_ORG_ID);
      expect(result.isLive).toBe(true);
    });

    it('accepts a partial live update with secret omitted and keeps the existing encrypted secret', async () => {
      prisma.organizationPaymentConfig.findUnique.mockResolvedValue({
        id: 'existing-id',
        singletonKey: PAYMENT_CONFIG_SINGLETON_KEY,
        publishableKey: 'pk_live_old',
        secretKeyEnc: 'existing-secret',
        webhookSecretEnc: 'existing-webhook',
        isLive: true,
        updatedAt: new Date('2026-01-01'),
      });

      await handler.execute({ publishableKey: 'pk_live_new' });

      expect(prisma.organizationPaymentConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            publishableKey: 'pk_live_new',
            secretKeyEnc: 'existing-secret',
            isLive: true,
          }),
        }),
      );
      // Omitted secret must not be re-encrypted; the stored ciphertext is kept as-is.
      expect(creds.encrypt).not.toHaveBeenCalled();
    });
  });
});
