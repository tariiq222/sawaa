import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SmsCredentialsService } from '../../../infrastructure/sms/sms-credentials.service';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import { SmsDlrHandler } from './sms-dlr.handler';

function buildCls() {
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    get: jest.fn((key: string) => store[key]),
  };
}

function buildCreds(): SmsCredentialsService {
  const cfg: Partial<ConfigService> = {
    get: () => Buffer.alloc(32, 7).toString('base64'),
  };
  return new SmsCredentialsService(cfg as ConfigService);
}

describe('SmsDlrHandler', () => {
  const webhookSecret = 'wh-secret-abc';
  const rawBody = '{"messageId":"m-org-a","status":"delivered"}';
  const sig = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  it('updates only the target org SmsDelivery row when signature matches', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      'org-A',
    );

    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertext,
          webhookSecret,
        }),
      },
      smsDelivery: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const cls = buildCls();
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      cls as never,
    );

    const res = await handler.execute({
      provider: 'UNIFONIC',
      organizationId: 'org-A',
      rawBody,
      signature: sig,
    });

    expect(res).toEqual({});
    expect(prisma.smsDelivery.updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'm-org-a' },
      data: expect.objectContaining({
        status: 'DELIVERED',
        deliveredAt: expect.any(Date),
      }),
    });
    expect(cls.set).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ organizationId: 'org-A' }),
    );
  });

  it('skips when no config for organizationId', async () => {
    const creds = buildCreds();
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      smsDelivery: { updateMany: jest.fn() },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      buildCls() as never,
    );
    const res = await handler.execute({
      provider: 'UNIFONIC',
      organizationId: 'org-unknown',
      rawBody,
      signature: sig,
    });
    expect(res).toEqual({ skipped: true });
    expect(prisma.smsDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('skips when provider in path does not match configured provider', async () => {
    const creds = buildCreds();
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'TAQNYAT',
          credentialsCiphertext: 'anything',
          webhookSecret,
        }),
      },
      smsDelivery: { updateMany: jest.fn() },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      buildCls() as never,
    );
    const res = await handler.execute({
      provider: 'UNIFONIC', // wrong
      organizationId: 'org-A',
      rawBody,
      signature: sig,
    });
    expect(res).toEqual({ skipped: true });
    expect(prisma.smsDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a wrong signature (no row update)', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      'org-A',
    );
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertext,
          webhookSecret,
        }),
      },
      smsDelivery: { updateMany: jest.fn() },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      buildCls() as never,
    );
    await expect(
      handler.execute({
        provider: 'UNIFONIC',
        organizationId: 'org-A',
        rawBody,
        signature: 'deadbeef',
      }),
    ).rejects.toThrow(/signature/);
    expect(prisma.smsDelivery.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when no webhookSecret on file', async () => {
    const creds = buildCreds();
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: 'anything',
          webhookSecret: null,
        }),
      },
      smsDelivery: { updateMany: jest.fn() },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      buildCls() as never,
    );
    await expect(
      handler.execute({
        provider: 'UNIFONIC',
        organizationId: 'org-A',
        rawBody,
        signature: sig,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
