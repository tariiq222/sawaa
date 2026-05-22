import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';
import { OtpChannel } from '@prisma/client';

const buildAdapter = (available = true) => ({
  name: 'resend',
  isAvailable: () => available,
  sendMail: jest.fn().mockResolvedValue(undefined),
});

const buildFactory = (adapter: ReturnType<typeof buildAdapter>) => ({
  resolve: jest.fn().mockResolvedValue(adapter),
});

describe('EmailChannelAdapter', () => {
  let adapter: EmailChannelAdapter;
  let providerAdapter: ReturnType<typeof buildAdapter>;

  beforeEach(async () => {
    providerAdapter = buildAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: EmailProviderFactory, useValue: buildFactory(providerAdapter) },
      ],
    }).compile();

    adapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
  });

  it('has EMAIL kind', () => {
    expect(adapter.kind).toBe(OtpChannel.EMAIL);
  });

  it('sends OTP via the configured provider', async () => {
    await adapter.send('test@example.com', '1234');
    expect(providerAdapter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'رمز التحقق / Verification Code',
        html: expect.stringContaining('1234'),
      }),
    );
  });

  it('throws ServiceUnavailableException when no provider is configured', async () => {
    const unavailable = buildAdapter(false);
    const local: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        { provide: EmailProviderFactory, useValue: buildFactory(unavailable) },
      ],
    }).compile();
    const localAdapter = local.get<EmailChannelAdapter>(EmailChannelAdapter);
    await expect(localAdapter.send('test@example.com', '1234')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(unavailable.sendMail).not.toHaveBeenCalled();
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
    const authenticaMock = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelAdapter,
        SmsChannelAdapter,
        NotificationChannelRegistry,
        { provide: AuthenticaClient, useValue: authenticaMock },
        { provide: EmailProviderFactory, useValue: buildFactory(buildAdapter()) },
      ],
    }).compile();

    registry = module.get<NotificationChannelRegistry>(NotificationChannelRegistry);
    emailAdapter = module.get<EmailChannelAdapter>(EmailChannelAdapter);
    smsAdapter = module.get<SmsChannelAdapter>(SmsChannelAdapter);
  });

  it('resolves EMAIL channel', () => {
    expect(registry.resolve(OtpChannel.EMAIL)).toBe(emailAdapter);
  });

  it('resolves SMS channel', () => {
    expect(registry.resolve(OtpChannel.SMS)).toBe(smsAdapter);
  });

  it('throws for unknown channel kind', () => {
    expect(() => registry.resolve('WHATSAPP' as OtpChannel)).toThrow(
      'No notification channel registered for kind: WHATSAPP',
    );
  });
});
