import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { TestEmailConfigHandler } from './test-email-config.handler';

describe('TestEmailConfigHandler', () => {
  let handler: TestEmailConfigHandler;
  let prisma: { organizationEmailConfig: { findFirst: jest.Mock; update: jest.Mock } };
  let factory: { resolve: jest.Mock };
  let adapter: { sendMail: jest.Mock };

  beforeEach(async () => {
    prisma = { organizationEmailConfig: { findFirst: jest.fn(), update: jest.fn() } };
    adapter = { sendMail: jest.fn() };
    factory = { resolve: jest.fn().mockResolvedValue(adapter) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestEmailConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailProviderFactory, useValue: factory },
      ],
    }).compile();

    handler = module.get<TestEmailConfigHandler>(TestEmailConfigHandler);
  });

  it('throws when no email provider is configured', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ toEmail: 'a@b.com' })).rejects.toThrow(BadRequestException);
    expect(factory.resolve).not.toHaveBeenCalled();
    expect(prisma.organizationEmailConfig.update).not.toHaveBeenCalled();
  });

  it('throws when provider is NONE', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1', provider: 'NONE', credentialsCiphertext: 'x',
    });
    await expect(handler.execute({ toEmail: 'a@b.com' })).rejects.toThrow(BadRequestException);
    expect(factory.resolve).not.toHaveBeenCalled();
  });

  it('throws when credentialsCiphertext is missing', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1', provider: 'SMTP', credentialsCiphertext: null,
    });
    await expect(handler.execute({ toEmail: 'a@b.com' })).rejects.toThrow(BadRequestException);
    expect(factory.resolve).not.toHaveBeenCalled();
  });

  it('returns ok=true and records lastTestOk on success', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1', provider: 'SMTP', credentialsCiphertext: 'cipher',
    });
    adapter.sendMail.mockResolvedValue({ messageId: 'msg-1' });

    const result = await handler.execute({ toEmail: 'a@b.com' });

    expect(result).toEqual({ ok: true, messageId: 'msg-1' });
    expect(prisma.organizationEmailConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { lastTestAt: expect.any(Date), lastTestOk: true },
    });
  });

  it('returns ok=false with bilingual error and records lastTestOk=false on failure', async () => {
    prisma.organizationEmailConfig.findFirst.mockResolvedValue({
      id: 'cfg-1', provider: 'SMTP', credentialsCiphertext: 'cipher',
    });
    adapter.sendMail.mockRejectedValue(new Error('SMTP auth failed'));

    const result = await handler.execute({ toEmail: 'a@b.com' });

    expect(result.ok).toBe(false);
    expect(result.error?.en).toContain('SMTP auth failed');
    expect(result.error?.ar).toContain('SMTP auth failed');
    expect(prisma.organizationEmailConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { lastTestAt: expect.any(Date), lastTestOk: false },
    });
  });
});