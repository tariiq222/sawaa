import OpenAI from 'openai';
import { AiProviderClientService } from './ai-provider-client.service';
import { AiConnectionStatus, AiProvider } from '../../modules/ai/provider-config/ai-provider-config.types';

jest.mock('openai', () => jest.fn().mockImplementation((options) => ({ options })));

const now = new Date();
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'config-1', singletonKey: 'singleton', provider: AiProvider.OPENROUTER,
  credentialCiphertext: 'v1.ciphertext', model: 'anthropic/claude-3.5-haiku', temperature: 0.4,
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

  it('resolves OpenRouter with its fixed official URL', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row());
    const result = await service.getReadyClient();
    expect(result?.model).toBe('anthropic/claude-3.5-haiku');
    expect((result?.client as unknown as { options: Record<string, unknown> }).options).toEqual(expect.objectContaining({ apiKey: 'secret-placeholder', baseURL: 'https://openrouter.ai/api/v1' }));
  });

  it('does not resolve when the stored test fingerprint no longer matches the decrypted credential', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row());
    credentials.fingerprint.mockReturnValue('different-hash');

    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('resolves OpenAI with its fixed official URL and never accepts a row URL', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ provider: AiProvider.OPENAI, model: 'gpt-4o' }));
    const result = await service.getReadyClient();
    expect((result?.client as unknown as { options: Record<string, unknown> }).options.baseURL).toBe('https://api.openai.com/v1');
  });

  it('resolves MiniMax with its fixed official URL and keeps fingerprint readiness', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ provider: AiProvider.MINIMAX, model: 'MiniMax-M3' }));
    const result = await service.getReadyClient();
    expect(result?.provider).toBe(AiProvider.MINIMAX);
    expect(result?.model).toBe('MiniMax-M3');
    expect((result?.client as unknown as { options: Record<string, unknown> }).options).toEqual(expect.objectContaining({
      apiKey: 'secret-placeholder',
      baseURL: 'https://api.minimax.io/v1',
      timeout: 10_000,
      maxRetries: 0,
    }));
    expect(credentials.fingerprint).toHaveBeenCalledWith('secret-placeholder', AiProvider.MINIMAX, 'MiniMax-M3');
  });

  it('does not resolve MiniMax when the stored test fingerprint no longer matches', async () => {
    prisma.aiProviderConfig.findUnique.mockResolvedValue(row({ provider: AiProvider.MINIMAX, model: 'MiniMax-M3' }));
    credentials.fingerprint.mockReturnValue('different-hash');
    await expect(service.getReadyClient()).resolves.toBeNull();
  });

  it('atomically marks the singleton for retesting without provider details', async () => {
    await service.markRetestRequired();
    expect(prisma.aiProviderConfig.updateMany).toHaveBeenCalledWith({
      where: { singletonKey: 'singleton', connectionStatus: 'CONNECTED' },
      data: { connectionStatus: 'RETEST_REQUIRED', lastTestOk: false, lastTestErrorCode: 'PROVIDER_AUTH' },
    });
  });
});
