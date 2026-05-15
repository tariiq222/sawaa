import { Test } from '@nestjs/testing';
import { SendSmsHandler } from './send-sms.handler';
import { PrismaService } from '../../../infrastructure/database';
import { SmsProviderFactory } from '../../../infrastructure/sms/sms-provider.factory';
import { SmsProviderNotConfiguredError } from '../../../infrastructure/sms/sms-provider.interface';

describe('SendSmsHandler', () => {
  let handler: SendSmsHandler;
  let prisma: { smsDelivery: { create: jest.Mock } };
  let factory: { resolve: jest.Mock };

  beforeEach(async () => {
    prisma = { smsDelivery: { create: jest.fn().mockResolvedValue({}) } };
    factory = { resolve: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SendSmsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SmsProviderFactory, useValue: factory },
      ],
    }).compile();

    handler = module.get(SendSmsHandler);
  });

  const cmd = { phone: '+966500000000', body: 'Hello' };

  it('skips when provider is NONE', async () => {
    factory.resolve.mockResolvedValue({ name: 'NONE' });
    const loggerSpy = jest.spyOn((handler as any).logger, 'warn').mockImplementation(() => {});
    await handler.execute(cmd);
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('SMS skipped'));
    expect(prisma.smsDelivery.create).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it('creates SENT delivery log on success', async () => {
    factory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send: jest.fn().mockResolvedValue({ status: 'SENT', providerMessageId: 'msg-1' }),
    });
    await handler.execute(cmd);
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'TAQNYAT', status: 'SENT', providerMessageId: 'msg-1' }),
      }),
    );
  });

  it('creates QUEUED delivery log when status is not SENT', async () => {
    factory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send: jest.fn().mockResolvedValue({ status: 'PENDING', providerMessageId: 'msg-2' }),
    });
    await handler.execute(cmd);
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED' }),
      }),
    );
  });

  it('creates FAILED log on generic error and re-throws', async () => {
    factory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send: jest.fn().mockRejectedValue(new Error('Network down')),
    });
    await expect(handler.execute(cmd)).rejects.toThrow('Network down');
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Network down' }),
      }),
    );
  });

  it('logs warning and returns on SmsProviderNotConfiguredError', async () => {
    factory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send: jest.fn().mockRejectedValue(new SmsProviderNotConfiguredError()),
    });
    const loggerSpy = jest.spyOn((handler as any).logger, 'warn').mockImplementation(() => {});
    await handler.execute(cmd);
    expect(loggerSpy).toHaveBeenCalledWith('SMS provider not configured for this organization');
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'SMS provider not configured for this organization' }),
      }),
    );
    loggerSpy.mockRestore();
  });

  it('handles non-Error rejection', async () => {
    factory.resolve.mockResolvedValue({
      name: 'TAQNYAT',
      send: jest.fn().mockRejectedValue('string error'),
    });
    await expect(handler.execute(cmd)).rejects.toBe('string error');
    expect(prisma.smsDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Unknown SMS error' }),
      }),
    );
  });
});
