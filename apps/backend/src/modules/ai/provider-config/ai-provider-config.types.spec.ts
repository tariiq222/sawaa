import {
  AiConnectionStatus,
  AiProvider,
  parseAiProviderConfig,
  toPublicAiProviderConfig,
} from './ai-provider-config.types';

describe('AI provider configuration contracts', () => {
  const stored = {
    id: 'default',
    singletonKey: 'singleton',
    provider: AiProvider.OPENROUTER,
    credentialCiphertext: 'ciphertext-placeholder-only',
    model: 'anthropic/claude-3.5-haiku',
    temperature: 0.4,
    maxTokens: 800,
    isEnabled: false,
    connectionStatus: AiConnectionStatus.NOT_CONFIGURED,
    lastTestedAt: null,
    lastTestOk: null,
    lastTestErrorCode: null,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  };

  it('projects only safe operator-visible fields', () => {
    const projection = toPublicAiProviderConfig(stored);

    expect(projection).toEqual({
      provider: AiProvider.OPENROUTER,
      model: 'anthropic/claude-3.5-haiku',
      temperature: 0.4,
      maxTokens: 800,
      isEnabled: false,
      connectionStatus: AiConnectionStatus.NOT_CONFIGURED,
      lastTestedAt: null,
      lastTestOk: null,
      lastTestErrorCode: null,
      hasCredential: true,
    });
    expect(projection).not.toHaveProperty('credentialCiphertext');
    expect(projection).not.toHaveProperty('apiKey');
    expect(JSON.stringify(projection)).not.toContain('ciphertext-placeholder-only');
  });

  it('rejects non-plain objects and invalid provider/model pairs', () => {
    expect(() => parseAiProviderConfig(null)).toThrow('plain object');
    expect(() => parseAiProviderConfig(Object.create({ provider: AiProvider.OPENAI }))).toThrow(
      'plain object',
    );
    expect(() =>
      parseAiProviderConfig({
        ...stored,
        provider: AiProvider.OPENAI,
        model: 'anthropic/claude-3.5-haiku',
      }),
    ).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, unexpected: true })).toThrow('Unknown configuration field');
    expect(() => parseAiProviderConfig({ ...stored, singletonKey: 'other' })).toThrow('identity');
    expect(() => parseAiProviderConfig({ ...stored, credentialCiphertext: '' })).toThrow('ciphertext');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.OPENAI, model: 'https://evil.test/key' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/../secret' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/..' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/.' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: '../model' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.OPENAI, model: '.' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.OPENAI, model: '..' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/model\u0000' })).toThrow('model');
  });

  it('accepts valid OpenAI and OpenRouter model identifiers', () => {
    expect(parseAiProviderConfig({ ...stored, provider: AiProvider.OPENAI, model: 'future-model.v9:custom' }).model).toBe(
      'future-model.v9:custom',
    );
    expect(parseAiProviderConfig({ ...stored, provider: AiProvider.OPENAI, model: 'gpt-4.1' }).model).toBe('gpt-4.1');
    expect(parseAiProviderConfig({ ...stored, model: 'future-provider/future-model.v9:custom' }).model).toBe(
      'future-provider/future-model.v9:custom',
    );
    expect(parseAiProviderConfig({ ...stored, model: 'vendor/model.v2' }).model).toBe('vendor/model.v2');
  });

  it('accepts MiniMax-M3 and rejects unsafe or foreign MiniMax models', () => {
    expect(parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'MiniMax-M3' }).model).toBe('MiniMax-M3');
    expect(parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'MiniMax-M3.1' }).model).toBe('MiniMax-M3.1');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'minimax-m3' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'MiniMax/M3' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'https://evil.test/key' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: '.' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: '..' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'MiniMax-M3\u0000' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'gpt-4o-mini' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, provider: AiProvider.MINIMAX, model: 'openai/gpt-4o-mini' })).toThrow('model');
  });
});
