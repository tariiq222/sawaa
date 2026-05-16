import { Test, TestingModule } from '@nestjs/testing';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmtpService } from '../../../infrastructure/mail';
import { PlatformMailerService } from '../../../infrastructure/mail';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

describe('EmailChannelAdapter', () => {
  let adapter: EmailChannelAdapter;
  let smtp: { isAvailable: jest.Mock; sendMail: jest.Mock };
  let factory: { resolve: jest.Mock };
  let platformMailer: { sendOtpLogin: jest.Mock };
  let tenantAdapter: { isAvailable: jest.Mock; sendMail: jest.Mock };

  beforeEach(async () => {
    tenantAdapter = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockResolvedValue(undefined) };
    smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockResolvedValue(undefined) };
    factory = { resolve: jest.fn().mockResolvedValue(tenantAdapter) };
    platformMailer = { sendOtpLogin: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: SmtpService, useValue: smtp },
        { provide: EmailProviderFactory, useValue: factory },
        { provide: PlatformMailerService, useValue: platformMailer },
      ],
    }).compile();

    adapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
  });

  it('should send via configured provider when available', async () => {
    await adapter.send('test@example.com', '123456');
    expect(tenantAdapter.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'test@example.com' }));
    expect(platformMailer.sendOtpLogin).not.toHaveBeenCalled();
  });

  it('should fall through to platform when adapter not available', async () => {
    tenantAdapter.isAvailable.mockReturnValue(false);
    await adapter.send('test@example.com', '123456');
    expect(tenantAdapter.sendMail).not.toHaveBeenCalled();
    expect(platformMailer.sendOtpLogin).toHaveBeenCalledWith('test@example.com', { code: '123456', expiresInMinutes: 5 });
  });

  it('should fall through to platform when factory throws', async () => {
    factory.resolve.mockRejectedValue(new Error('Factory error'));
    await adapter.send('test@example.com', '123456');
    expect(platformMailer.sendOtpLogin).toHaveBeenCalled();
  });

  it('should fall through to platform when adapter not available (no org)', async () => {
    tenantAdapter.isAvailable.mockReturnValue(false);
    await adapter.send('test@example.com', '123456');
    expect(factory.resolve).toHaveBeenCalled();
    expect(platformMailer.sendOtpLogin).toHaveBeenCalled();
  });

  it('should fall through to SMTP when platform fails', async () => {
    tenantAdapter.isAvailable.mockReturnValue(false);
    platformMailer.sendOtpLogin.mockRejectedValue(new Error('Platform down'));
    await adapter.send('test@example.com', '123456');
    expect(smtp.sendMail).toHaveBeenCalledWith('test@example.com', expect.any(String), expect.any(String));
  });

  it('should log and return when SMTP not available', async () => {
    platformMailer.sendOtpLogin.mockRejectedValue(new Error('Platform down'));
    smtp.isAvailable.mockReturnValue(false);
    await adapter.send('test@example.com', '123456');
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('should throw when SMTP send fails', async () => {
    tenantAdapter.isAvailable.mockReturnValue(false);
    platformMailer.sendOtpLogin.mockRejectedValue(new Error('Platform down'));
    smtp.sendMail.mockRejectedValue(new Error('SMTP error'));
    await expect(adapter.send('test@example.com', '123456')).rejects.toThrow('SMTP error');
  });
});
