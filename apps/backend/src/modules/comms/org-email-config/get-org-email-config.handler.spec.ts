import { Test } from '@nestjs/testing';
import { GetOrgEmailConfigHandler } from './get-org-email-config.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetOrgEmailConfigHandler', () => {
  let handler: GetOrgEmailConfigHandler;
  let prisma: { organizationEmailConfig: { findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      organizationEmailConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        GetOrgEmailConfigHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetOrgEmailConfigHandler);
  });

  it('returns existing config', async () => {
    const existing = {
      id: '1',
      provider: 'SMTP',
      senderName: 'Sawaa',
      senderEmail: 'noreply@sawaa.app',
      credentialsCiphertext: 'encrypted',
      lastTestAt: new Date('2026-01-01'),
      lastTestOk: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-06-01'),
    };
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(existing);
    const result = await handler.execute();
    expect(result.credentialsConfigured).toBe(true);
    expect(result.provider).toBe('SMTP');
    expect(prisma.organizationEmailConfig.create).not.toHaveBeenCalled();
  });

  it('creates default config when none exists', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    const created = {
      id: '2',
      provider: 'NONE',
      senderName: null,
      senderEmail: null,
      credentialsCiphertext: null,
      lastTestAt: null,
      lastTestOk: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.organizationEmailConfig.create.mockResolvedValue(created);
    const result = await handler.execute();
    expect(prisma.organizationEmailConfig.create).toHaveBeenCalledWith({ data: { provider: 'NONE' } });
    expect(result.credentialsConfigured).toBe(false);
    expect(result.provider).toBe('NONE');
  });
});
