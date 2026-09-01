import { AiProviderClientService } from './ai-provider-client.service';
import { AiConnectionStatus, AiProvider, DEFAULT_OPENROUTER_MODEL } from '../../modules/ai/provider-config/ai-provider-config.types';

jest.mock('openai', () => jest.fn().mockImplementation((options) => ({ options })));

const now = new Date();
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'config-1', singletonKey: 'singleton', provider: AiProvider.OPENROUTER,
  credentialCiphertext: 'v1.ciphertext', model: DEFAULT_OPENROUTER_MODEL, temperature: 0.4,
  configVersion: 1, testedConfigHash: 'tested-hash',
  maxTokens: 800, isEnabled: true, connectionStatus: AiConnectionStatus.CONNECTED,
  lastTestedAt: now, lastTestOk: true, lastTestErrorCode: null, createdAt: now, updatedAt: now, ...overrides,
});

describe('AiProviderClientService', () => {
  const prisma = { aiProviderConfig: { findUnique: jest.fn(), updateMany: jest.fn() } } as any;
  const credentials = {
    decrypt: jest.fn().mockReturnValue('secret-placeholder'),
    fingerprint: jest.fn().mockReturnValue('tested-hash'),
  } as any;
  let service: AiProviderClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.decrypt.mockReturnValue('secret-placeholder');
    credentials.fingerprint.mockReturnValue('tested-hash');
    service = new AiProviderClientService(prisma, credentials);
  });

  it.each([
    [{ isEnabled: false }],
    [{ connectionStatus: AiConnectionStatus.FAILED }],
    [{ lastTestOk: false }],
    [{ credentialCiphertext: '' }],
    [{ testedConfigHash: null }],
  ])('does not resolve an unready config', async (overrides) => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row(overrides));
    await expect(service.getReadyClient()).resolves.toBeNull();
    expect(credentials.decrypt).not.toHaveBeenCalled();
  });

  it('resolves OpenRouter with its fixed official URL and default headers', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row());
    const result = await service.getReadyClient();
    expect(result?.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(result?.provider).toBe(AiProvider.OPENROUTER);
    expect((result?.client as unknown as { options: Record<string, unknown> }).options).toEqual(expect.objectContaining({
      apiKey: 'secret-placeholder',
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 10_000,
      maxRetries: 0,
      defaultHeaders: { 'HTTP-Referer': 'https://sawaa.app', 'X-Title': 'Sawaa AI' },
    }));
  });

  it('does not resolve when the stored test fingerprint no longer matches the decrypted credential', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row());
    credentials.fingerprint.mockReturnValue('different-hash');

    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('does not resolve leftover OpenAI or MiniMax rows', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ provider: 'OPENAI', model: 'gpt-4o' }));
    await expect(service.getReadyClient()).resolves.toBeNull();
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ provider: 'MINIMAX', model: 'MiniMax-M3' }));
    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('does not resolve a non-pinned OpenRouter model', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ model: 'openai/gpt-4o-mini' }));
    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('fails closed when Prisma cannot decode a legacy stored provider enum', async () => {
    prisma.aiProviderConfig.findUnique.mockRejectedValue(
      new Error('Inconsistent column data: Could not convert value from string "MINIMAX" to enum `AiProvider`'),
    );
    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('rethrows unrelated Prisma read failures', async () => {
    prisma.aiProviderConfig.findUnique.mockRejectedValue(new Error('database connection refused'));
    await expect(service.getReadyClient()).rejects.toThrow('database connection refused');
  });

  it('ignores OPENAI_BASE_URL and always uses the official OpenRouter URL', async () => {
    const original = process.env.OPENAI_BASE_URL;
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
    try {
      const svc = new AiProviderClientService(prisma, credentials);
      prisma.aiProviderConfig.findUnique.mockResolvedValue(row());
      const result = await svc.getReadyClient();
      expect((result?.client as unknown as { options: Record<string, unknown> }).options.baseURL).toBe('https://openrouter.ai/api/v1');
    } finally {
      if (original === undefined) delete process.env.OPENAI_BASE_URL;
      else process.env.OPENAI_BASE_URL = original;
    }
  });

  it('atomically marks the singleton for retesting without provider details', async () => {
    await service.markRetestRequired();
    expect(prisma.aiProviderConfig.updateMany).toHaveBeenCalledWith({
      where: { singletonKey: 'singleton', connectionStatus: 'CONNECTED' },
      data: { connectionStatus: 'RETEST_REQUIRED', lastTestOk: false, lastTestErrorCode: 'PROVIDER_AUTH' },
    });
  });
});
