import { SmsProviderFactory } from './sms-provider.factory';
import { NoOpAdapter } from './no-op.adapter';
import { UnifonicAdapter } from './unifonic.adapter';
import { TaqnyatAdapter } from './taqnyat.adapter';

describe('SmsProviderFactory', () => {
  let factory: SmsProviderFactory;
  let prisma: { organizationSmsConfig: { findFirst: jest.Mock } };
  let credentials: { decrypt: jest.Mock };

  beforeEach(() => {
    prisma = { organizationSmsConfig: { findFirst: jest.fn() } };
    credentials = { decrypt: jest.fn() };
    factory = new SmsProviderFactory(prisma as any, credentials as any);
  });

  it('returns NoOpAdapter when no config', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue(null);
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(NoOpAdapter);
  });

  it('returns NoOpAdapter when provider is NONE', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ provider: 'NONE', credentialsCiphertext: null });
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(NoOpAdapter);
  });

  it('returns NoOpAdapter when credentials missing', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({ provider: 'UNIFONIC', credentialsCiphertext: null });
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(NoOpAdapter);
  });

  it('returns UnifonicAdapter for UNIFONIC provider', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({
      provider: 'UNIFONIC',
      credentialsCiphertext: 'enc',
    });
    credentials.decrypt.mockReturnValue({ appSid: 'sid', apiKey: 'key' });
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(UnifonicAdapter);
  });

  it('returns TaqnyatAdapter for TAQNYAT provider', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({
      provider: 'TAQNYAT',
      credentialsCiphertext: 'enc',
    });
    credentials.decrypt.mockReturnValue({ apiKey: 'key', senderId: 'sender' });
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(TaqnyatAdapter);
  });

  it('returns NoOpAdapter for unknown provider', async () => {
    prisma.organizationSmsConfig.findFirst.mockResolvedValue({
      provider: 'UNKNOWN',
      credentialsCiphertext: 'enc',
    });
    const result = await factory.resolve();
    expect(result).toBeInstanceOf(NoOpAdapter);
  });

  it('buildTransient creates UnifonicAdapter', () => {
    const result = factory.buildTransient('UNIFONIC', { appSid: 'sid', apiKey: 'key' });
    expect(result).toBeInstanceOf(UnifonicAdapter);
  });

  it('buildTransient creates TaqnyatAdapter', () => {
    const result = factory.buildTransient('TAQNYAT', { apiKey: 'key', senderId: 'sender' });
    expect(result).toBeInstanceOf(TaqnyatAdapter);
  });
});
