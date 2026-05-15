import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TestSmsConfigHandler } from './test-sms-config.handler';
import { PrismaService } from '../../../infrastructure/database';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';

describe('TestSmsConfigHandler', () => {
  let handler: TestSmsConfigHandler;
  let prisma: { organizationSmsConfig: { findFirst: jest.Mock; update: jest.Mock } };
  let factory: { resolve: jest.Mock };

  beforeEach(async () => {
    prisma = {
      organizationSmsConfig: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    factory = { resolve: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TestSmsConfigHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SmsProviderFactory, useValue: factory },
      ],
    }).compile();

    handler = module.get(TestSmsConfigHandler);
  });

  it('throws when no config exists', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ toPhone: '+966500000000' })).rejects.toThrow(BadRequestException);
  });

  it('throws when provider is NONE', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ id: '1', provider: 'NONE', credentialsCiphertext: 'enc' });
    await expect(handler.execute({ toPhone: '+966500000000' })).rejects.toThrow(BadRequestException);
  });

  it('throws when credentials are missing', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ id: '1', provider: 'TAQNYAT', credentialsCiphertext: null });
    await expect(handler.execute({ toPhone: '+966500000000' })).rejects.toThrow(BadRequestException);
  });

  it('sends test sms and updates lastTestOk=true', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ id: '1', provider: 'TAQNYAT', credentialsCiphertext: 'enc', senderId: 'Sawaa' });
    factory.resolve.mockResolvedValue({
      send: jest.fn().mockResolvedValue({ status: 'SENT', providerMessageId: 'msg-1' }),
    });
    const result = await handler.execute({ toPhone: '+966500000000' });
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe('msg-1');
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastTestOk: true }) }),
    );
  });

  it('handles send failure and updates lastTestOk=false', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ id: '1', provider: 'TAQNYAT', credentialsCiphertext: 'enc', senderId: null });
    factory.resolve.mockResolvedValue({
      send: jest.fn().mockRejectedValue(new Error('Provider down')),
    });
    const result = await handler.execute({ toPhone: '+966500000000' });
    expect(result.ok).toBe(false);
    expect(result.error?.en).toContain('Provider down');
    expect(prisma.organizationSmsConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastTestOk: false }) }),
    );
  });

  it('handles non-Error rejection', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ id: '1', provider: 'TAQNYAT', credentialsCiphertext: 'enc' });
    factory.resolve.mockResolvedValue({
      send: jest.fn().mockRejectedValue('bad'),
    });
    const result = await handler.execute({ toPhone: '+966500000000' });
    expect(result.ok).toBe(false);
    expect(result.error?.en).toContain('Unknown error');
  });
});
