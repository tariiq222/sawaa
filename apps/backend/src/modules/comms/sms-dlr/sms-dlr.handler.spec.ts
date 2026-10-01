import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
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

function buildTransaction<T>(tx: T) {
  return {
    withTransaction: jest.fn(async (work: (client: T) => Promise<unknown>) =>
      work(tx),
    ),
  };
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
      DEFAULT_ORG_ID,
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
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };
    const factory = new SmsProviderFactory(prisma as never, creds);
    const cls = buildCls();
    const handler = new SmsDlrHandler(
      prisma as never,
      factory,
      cls as never,
      buildTransaction(prisma) as never,
    );

    const res = await handler.execute({
      provider: 'UNIFONIC',
      organizationId: DEFAULT_ORG_ID,
      rawBody,
      signature: sig,
    });

    expect(res).toEqual({});
    expect(prisma.smsDelivery.updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'm-org-a', status: { in: ['QUEUED', 'SENT', 'UNKNOWN', 'FAILED'] } },
      data: expect.objectContaining({
        status: 'DELIVERED',
        deliveredAt: expect.any(Date),
      }),
    });
    expect(cls.set).toHaveBeenCalledWith(
      'tenant',
      expect.objectContaining({ organizationId: DEFAULT_ORG_ID }),
    );
  });

  it('keeps the dedup claim retriable when the delivery transaction fails', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      DEFAULT_ORG_ID,
    );
    const tx = {
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      smsDelivery: {
        updateMany: jest
          .fn()
          .mockRejectedValueOnce(new Error('database unavailable'))
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertext,
          webhookSecret,
        }),
      },
    };
    const transaction = buildTransaction(tx);
    const handler = new SmsDlrHandler(
      prisma as never,
      new SmsProviderFactory(prisma as never, creds),
      buildCls() as never,
      transaction as never,
    );
    const request = {
      provider: 'UNIFONIC' as const,
      organizationId: DEFAULT_ORG_ID,
      rawBody,
      signature: sig,
    };

    await expect(handler.execute(request)).rejects.toThrow('database unavailable');
    await expect(handler.execute(request)).resolves.toEqual({});

    expect(transaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(tx.webhookEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.smsDelivery.updateMany).toHaveBeenCalledTimes(2);
  });

  it('retries successfully when the DLR arrives before its SmsDelivery row', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      DEFAULT_ORG_ID,
    );
    const tx = {
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      smsDelivery: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertext,
          webhookSecret,
        }),
      },
    };
    const transaction = buildTransaction(tx);
    const handler = new SmsDlrHandler(
      prisma as never,
      new SmsProviderFactory(prisma as never, creds),
      buildCls() as never,
      transaction as never,
    );
    const request = {
      provider: 'UNIFONIC' as const,
      organizationId: DEFAULT_ORG_ID,
      rawBody,
      signature: sig,
    };

    await expect(handler.execute(request)).rejects.toThrow(
      'SMS delivery not found for provider message m-org-a',
    );
    await expect(handler.execute(request)).resolves.toEqual({});

    expect(transaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(tx.webhookEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.smsDelivery.updateMany).toHaveBeenCalledTimes(2);
  });

  it('ignores a receipt that would move a delivery backwards (late FAILED after DELIVERED)', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt({ appSid: 'a', apiKey: 'b' }, DEFAULT_ORG_ID);
    const failedBody = rawBody.replace('"delivered"', '"failed"');
    const failedSig = createHmac('sha256', webhookSecret).update(failedBody).digest('hex');
    const tx = {
      webhookEvent: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
      smsDelivery: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({ provider: 'UNIFONIC', credentialsCiphertext: ciphertext, webhookSecret }),
      },
    };
    const handler = new SmsDlrHandler(
      prisma as never,
      new SmsProviderFactory(prisma as never, creds),
      buildCls() as never,
      buildTransaction(tx) as never,
    );

    await expect(handler.execute({ provider: 'UNIFONIC', organizationId: DEFAULT_ORG_ID, rawBody: failedBody, signature: failedSig }))
      .resolves.toEqual({ skipped: true });
    expect(tx.smsDelivery.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { providerMessageId: 'm-org-a', status: { in: ['QUEUED', 'SENT', 'UNKNOWN'] } },
    }));
  });

  it('skips a concurrent duplicate when the transactional claim loses P2002', async () => {
    const creds = buildCreds();
    const ciphertext = creds.encrypt(
      { appSid: 'a', apiKey: 'b' },
      DEFAULT_ORG_ID,
    );
    const tx = {
      webhookEvent: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
      smsDelivery: { updateMany: jest.fn() },
    };
    const prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn().mockResolvedValue({
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertext,
          webhookSecret,
        }),
      },
    };
    const transaction = buildTransaction(tx);
    const handler = new SmsDlrHandler(
      prisma as never,
      new SmsProviderFactory(prisma as never, creds),
      buildCls() as never,
      transaction as never,
    );

    await expect(handler.execute({
      provider: 'UNIFONIC',
      organizationId: DEFAULT_ORG_ID,
      rawBody,
      signature: sig,
    })).resolves.toEqual({ skipped: true });

    expect(tx.smsDelivery.updateMany).not.toHaveBeenCalled();
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
      buildTransaction(prisma) as never,
    );
    const res = await handler.execute({
      provider: 'UNIFONIC',
      organizationId: DEFAULT_ORG_ID,
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
      buildTransaction(prisma) as never,
    );
    const res = await handler.execute({
      provider: 'UNIFONIC', // wrong
      organizationId: DEFAULT_ORG_ID,
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
      DEFAULT_ORG_ID,
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
      buildTransaction(prisma) as never,
    );
    await expect(
      handler.execute({
        provider: 'UNIFONIC',
        organizationId: DEFAULT_ORG_ID,
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
      buildTransaction(prisma) as never,
    );
    await expect(
      handler.execute({
        provider: 'UNIFONIC',
        organizationId: DEFAULT_ORG_ID,
        rawBody,
        signature: sig,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
