import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmailChannelAdapter } from './email-channel.adapter';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

describe('EmailChannelAdapter', () => {
  let adapter: EmailChannelAdapter;
  let factory: { resolve: jest.Mock };
  let tenantAdapter: { name: string; isAvailable: jest.Mock; sendMail: jest.Mock };

  beforeEach(async () => {
    tenantAdapter = {
      name: 'resend',
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    factory = { resolve: jest.fn().mockResolvedValue(tenantAdapter) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: EmailProviderFactory, useValue: factory },
      ],
    }).compile();

    adapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
  });

  it('sends via the configured provider', async () => {
    await adapter.send('test@example.com', '123456');
    expect(tenantAdapter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Verification'),
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('throws ServiceUnavailableException when no provider is configured', async () => {
    tenantAdapter.isAvailable.mockReturnValue(false);
    await expect(adapter.send('test@example.com', '123456')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(tenantAdapter.sendMail).not.toHaveBeenCalled();
  });

  it('propagates send errors from the provider', async () => {
    tenantAdapter.sendMail.mockRejectedValue(new Error('SMTP refused'));
    await expect(adapter.send('test@example.com', '123456')).rejects.toThrow('SMTP refused');
  });
});
