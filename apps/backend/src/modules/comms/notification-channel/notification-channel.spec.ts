import { Test, TestingModule } from '@nestjs/testing';
import { SmtpService, PlatformMailerService } from '../../../infrastructure/mail';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';
import { OtpChannel } from '@prisma/client';

const buildEmailFactoryMock = (): jest.Mocked<Partial<EmailProviderFactory>> => ({
  forCurrentTenant: jest.fn().mockResolvedValue(null),
});

const buildPlatformMailerMock = () => ({
  sendOtpLogin: jest.fn().mockResolvedValue(undefined),
});

describe('EmailChannelAdapter', () => {
  let adapter: EmailChannelAdapter;
  let smtp: jest.Mocked<Pick<SmtpService, 'isAvailable' | 'sendMail'>>;
  let platformMailer: jest.Mocked<Pick<PlatformMailerService, 'sendOtpLogin'>>;

  beforeEach(async () => {
    const smtpMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    const platformMailerMock = buildPlatformMailerMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: SmtpService, useValue: smtpMock },
        { provide: EmailProviderFactory, useValue: buildEmailFactoryMock() },
        { provide: PlatformMailerService, useValue: platformMailerMock },
      ],
    }).compile();

    adapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
    smtp = module.get(SmtpService);
    platformMailer = module.get(PlatformMailerService);
  });

  it('should have EMAIL kind', () => {
    expect(adapter.kind).toBe(OtpChannel.EMAIL);
  });

  it('should send OTP via platform Resend (no organizationId)', async () => {
    await adapter.send('test@example.com', '1234');
    expect(platformMailer.sendOtpLogin).toHaveBeenCalledWith(
      'test@example.com',
      { code: '1234', expiresInMinutes: 5 },
    );
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('falls through to SMTP when platformMailer throws', async () => {
    (platformMailer.sendOtpLogin as jest.Mock).mockRejectedValueOnce(new Error('queue down'));
    await adapter.send('test@example.com', '1234');
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'test@example.com',
      'رمز التحقق / Verification Code',
      expect.stringContaining('1234'),
    );
  });

  it('should not throw when both platformMailer and smtp are unavailable', async () => {
    (platformMailer.sendOtpLogin as jest.Mock).mockRejectedValueOnce(new Error('queue down'));
    (smtp as jest.Mocked<typeof smtp>).isAvailable.mockReturnValue(false);
    await expect(adapter.send('test@example.com', '1234')).resolves.not.toThrow();
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});

describe('SmsChannelAdapter', () => {
  let adapter: SmsChannelAdapter;
  let authentica: jest.Mocked<AuthenticaClient>;

  beforeEach(async () => {
    const authenticaMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsChannelAdapter,
        { provide: AuthenticaClient, useValue: authenticaMock },
      ],
    }).compile();

    adapter = module.get<SmsChannelAdapter>(SmsChannelAdapter);
    authentica = module.get(AuthenticaClient);
  });

  it('sends SMS via AuthenticaClient', async () => {
    await adapter.send('+966500000000', '1234');
    expect(authentica.sendOtp).toHaveBeenCalledWith({
      channel: 'SMS',
      identifier: '+966500000000',
      code: '1234',
    });
  });

  it('skips when Authentica is not configured', async () => {
    authentica.isConfigured.mockReturnValue(false);
    await adapter.send('+966500000000', '1234');
    expect(authentica.sendOtp).not.toHaveBeenCalled();
  });
});

describe('NotificationChannelRegistry', () => {
  let registry: NotificationChannelRegistry;
  let emailAdapter: EmailChannelAdapter;
  let smsAdapter: SmsChannelAdapter;

  beforeEach(async () => {
    const smtpMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    const authenticaMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };
    const platformMailerMock = buildPlatformMailerMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        SmsChannelAdapter,
        NotificationChannelRegistry,
        { provide: SmtpService, useValue: smtpMock },
        { provide: AuthenticaClient, useValue: authenticaMock },
        { provide: EmailProviderFactory, useValue: buildEmailFactoryMock() },
        { provide: PlatformMailerService, useValue: platformMailerMock },
      ],
    }).compile();

    registry = module.get<NotificationChannelRegistry>(NotificationChannelRegistry);
    emailAdapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
    smsAdapter = module.get<SmsChannelAdapter>(SmsChannelAdapter);
  });

  it('resolves EMAIL channel', () => {
    const channel = registry.resolve(OtpChannel.EMAIL);
    expect(channel).toBe(emailAdapter);
  });

  it('resolves SMS channel', () => {
    const channel = registry.resolve(OtpChannel.SMS);
    expect(channel).toBe(smsAdapter);
  });

  it('throws for unknown channel kind', () => {
    expect(() => registry.resolve('WHATSAPP' as OtpChannel)).toThrow('No notification channel registered for kind: WHATSAPP');
  });
});
