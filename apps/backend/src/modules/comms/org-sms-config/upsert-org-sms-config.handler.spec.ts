import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { SmsCredentialsService } from '../../../infrastructure/sms/sms-credentials.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { UpsertOrgSmsConfigHandler } from './upsert-org-sms-config.handler';

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('a'.repeat(32))),
}));

describe('UpsertOrgSmsConfigHandler', () => {
  let handler: UpsertOrgSmsConfigHandler;
  let prisma: { organizationSmsConfig: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } };
  let credentials: { encrypt: jest.Mock };

  beforeEach(async () => {
    prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cfg-1', ...data })),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'cfg-1', ...data })),
      },
    };
    credentials = { encrypt: jest.fn().mockReturnValue('cipher') };

    const module = await Test.createTestingModule({
      providers: [
        UpsertOrgSmsConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SmsCredentialsService, useValue: credentials },
      ],
    }).compile();

    handler = module.get(UpsertOrgSmsConfigHandler);
  });

  it('rejects UNIFONIC without credentials (BadRequestException)', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    const thrown = await handler
      .execute({ provider: 'UNIFONIC' } as never)
      .catch((e) => e);
    expect(thrown).toBeDefined();
    expect(thrown.getResponse().en).toMatch(/Unifonic credentials are required/);
    expect(prisma.organizationSmsConfig.create).not.toHaveBeenCalled();
  });

  it('rejects TAQNYAT without credentials (BadRequestException)', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    const thrown = await handler
      .execute({ provider: 'TAQNYAT' } as never)
      .catch((e) => e);
    expect(thrown).toBeDefined();
    expect(thrown.getResponse().en).toMatch(/Taqnyat credentials are required/);
    expect(prisma.organizationSmsConfig.create).not.toHaveBeenCalled();
  });

  it('encrypts UNIFONIC credentials with DEFAULT_ORG_ID AAD before persisting', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);

    await handler.execute({
      provider: 'UNIFONIC',
      unifonic: { appSid: 'app', apiKey: 'key' },
    } as never);

    expect(credentials.encrypt).toHaveBeenCalledWith(
      { appSid: 'app', apiKey: 'key' },
      DEFAULT_ORG_ID,
    );
    expect(prisma.organizationSmsConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ credentialsCiphertext: 'cipher' }),
      }),
    );
  });

  it('rotates the webhook secret when the provider changes', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      provider: 'NONE',
      webhookSecret: 'old-secret',
    });

    await handler.execute({
      provider: 'UNIFONIC',
      unifonic: { appSid: 'a', apiKey: 'b' },
    } as never);

    expect(randomBytes).toHaveBeenCalledWith(32);
    // randomBytes(32).toString('hex') of "a"*32 yields 64 hex chars "61" repeated.
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cfg-1' },
        data: expect.objectContaining({
          webhookSecret: '61'.repeat(32),
        }),
      }),
    );
  });

  it('keeps the existing webhook secret when the provider is unchanged', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      provider: 'UNIFONIC',
      webhookSecret: 'keep-me',
    });
    (randomBytes as jest.Mock).mockClear();

    await handler.execute({
      provider: 'UNIFONIC',
      unifonic: { appSid: 'a2', apiKey: 'b2' },
    } as never);

    expect(randomBytes).not.toHaveBeenCalled();
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ webhookSecret: 'keep-me' }),
      }),
    );
  });

  it('returns the OrgSmsConfigView shape (NO raw credentialsCiphertext leak)', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    prisma.organizationSmsConfig.create.mockResolvedValue({
      id: 'cfg-1',
      provider: 'NONE',
      senderId: null,
      credentialsCiphertext: 'cipher',
      lastTestAt: null,
      lastTestOk: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await handler.execute({ provider: 'NONE' } as never);

    expect(result).not.toHaveProperty('credentialsCiphertext');
    expect(result).toMatchObject({
      id: 'cfg-1',
      provider: 'NONE',
      credentialsConfigured: true,
    });
  });
});