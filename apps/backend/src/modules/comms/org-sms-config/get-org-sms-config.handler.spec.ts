import { Test } from '@nestjs/testing';
import { GetOrgSmsConfigHandler } from './get-org-sms-config.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetOrgSmsConfigHandler', () => {
  let handler: GetOrgSmsConfigHandler;
  let prisma: { organizationSmsConfig: { findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        GetOrgSmsConfigHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetOrgSmsConfigHandler);
  });

  it('returns existing config', async () => {
    const existing = {
      id: '1',
      provider: 'TAQNYAT',
      senderId: 'Sawaa',
      credentialsCiphertext: 'encrypted',
      lastTestAt: new Date('2026-01-01'),
      lastTestOk: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-06-01'),
    };
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(existing);
    const result = await handler.execute();
    expect(result.credentialsConfigured).toBe(true);
    expect(result.provider).toBe('TAQNYAT');
    expect(prisma.organizationSmsConfig.create).not.toHaveBeenCalled();
  });

  it('creates default config when none exists', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    const created = {
      id: '2',
      provider: 'NONE',
      senderId: null,
      credentialsCiphertext: null,
      lastTestAt: null,
      lastTestOk: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.organizationSmsConfig.create.mockResolvedValue(created);
    const result = await handler.execute();
    expect(prisma.organizationSmsConfig.create).toHaveBeenCalledWith({ data: { provider: 'NONE' } });
    expect(result.credentialsConfigured).toBe(false);
    expect(result.provider).toBe('NONE');
  });
});
