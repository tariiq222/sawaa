import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmailCredentialsService } from '../../../infrastructure/email/email-credentials.service';
import { UpsertOrgEmailConfigHandler } from './upsert-org-email-config.handler';

describe('UpsertOrgEmailConfigHandler', () => {
  let handler: UpsertOrgEmailConfigHandler;
  let prisma: any;
  let credentials: any;

  beforeEach(async () => {
    prisma = {
      organizationEmailConfig: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    };
    credentials = { encrypt: jest.fn().mockReturnValue('cipher') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertOrgEmailConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailCredentialsService, useValue: credentials },
      ],
    }).compile();

    handler = module.get<UpsertOrgEmailConfigHandler>(UpsertOrgEmailConfigHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should set NONE provider and clear credentials', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({ id: 'cfg1', provider: 'SMTP', credentialsCiphertext: 'old' });
    prisma.organizationEmailConfig.update.mockResolvedValue({ id: 'cfg1', provider: 'NONE', credentialsCiphertext: null });
    const result = await handler.execute({ provider: 'NONE' } as any);
    expect(result.provider).toBe('NONE');
    expect(prisma.organizationEmailConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ credentialsCiphertext: null }),
    }));
  });

  it('should create SMTP config', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    prisma.organizationEmailConfig.create.mockResolvedValue({ id: 'cfg1', provider: 'SMTP', credentialsCiphertext: 'cipher' });
    const result = await handler.execute({ provider: 'SMTP', smtp: { host: 'smtp.example.com', port: 587, user: 'u', pass: 'p', secure: true } } as any);
    expect(credentials.encrypt).toHaveBeenCalled();
    expect(result.provider).toBe('SMTP');
  });

  it('should throw when SMTP credentials missing on create', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ provider: 'SMTP' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should keep existing SMTP credentials when updating without smtp data', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({ id: 'cfg1', provider: 'SMTP', credentialsCiphertext: 'old' });
    prisma.organizationEmailConfig.update.mockResolvedValue({ id: 'cfg1', provider: 'SMTP', credentialsCiphertext: 'old' });
    const result = await handler.execute({ provider: 'SMTP' } as any);
    expect(prisma.organizationEmailConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ credentialsCiphertext: expect.anything() }),
    }));
  });

  it('should create RESEND config', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    prisma.organizationEmailConfig.create.mockResolvedValue({ id: 'cfg1', provider: 'RESEND', credentialsCiphertext: 'cipher' });
    await handler.execute({ provider: 'RESEND', resend: { apiKey: 'key' } } as any);
    expect(credentials.encrypt).toHaveBeenCalledWith({ apiKey: 'key' }, expect.any(String));
  });

  it('should throw when RESEND credentials missing on create', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ provider: 'RESEND' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should create SENDGRID config', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    prisma.organizationEmailConfig.create.mockResolvedValue({ id: 'cfg1', provider: 'SENDGRID' });
    await handler.execute({ provider: 'SENDGRID', sendgrid: { apiKey: 'key' } } as any);
  });

  it('should throw when SENDGRID credentials missing on create', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ provider: 'SENDGRID' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should create MAILCHIMP config', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    prisma.organizationEmailConfig.create.mockResolvedValue({ id: 'cfg1', provider: 'MAILCHIMP' });
    await handler.execute({ provider: 'MAILCHIMP', mailchimp: { apiKey: 'key' } } as any);
  });

  it('should throw when MAILCHIMP credentials missing on create', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ provider: 'MAILCHIMP' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should update existing config', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({ id: 'cfg1', provider: 'NONE' });
    prisma.organizationEmailConfig.update.mockResolvedValue({ id: 'cfg1', provider: 'SMTP', credentialsCiphertext: 'cipher' });
    await handler.execute({ provider: 'SMTP', smtp: { host: 'h', port: 1, user: 'u', pass: 'p', secure: false } } as any);
  });
});
