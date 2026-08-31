import {
  AiConnectionStatus,
  AiProvider,
  DEFAULT_OPENROUTER_MODEL,
  parseAiProviderConfig,
  toPublicAiProviderConfig,
} from './ai-provider-config.types';

describe('AI provider configuration contracts', () => {
  const stored = {
    id: 'default',
    singletonKey: 'singleton',
    provider: AiProvider.OPENROUTER,
    credentialCiphertext: 'ciphertext-placeholder-only',
    model: DEFAULT_OPENROUTER_MODEL,
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
      model: DEFAULT_OPENROUTER_MODEL,
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
    expect(() => parseAiProviderConfig(Object.create({ provider: AiProvider.OPENROUTER }))).toThrow(
      'plain object',
    );
    expect(() =>
      parseAiProviderConfig({
        ...stored,
        provider: 'OPENAI',
        model: DEFAULT_OPENROUTER_MODEL,
      }),
    ).toThrow('provider');
    expect(() =>
      parseAiProviderConfig({
        ...stored,
        provider: 'MINIMAX',
        model: 'MiniMax-M3',
      }),
    ).toThrow('provider');
    expect(() => parseAiProviderConfig({ ...stored, unexpected: true })).toThrow('Unknown configuration field');
    expect(() => parseAiProviderConfig({ ...stored, singletonKey: 'other' })).toThrow('identity');
    expect(() => parseAiProviderConfig({ ...stored, credentialCiphertext: '' })).toThrow('ciphertext');
    expect(() => parseAiProviderConfig({ ...stored, model: 'https://evil.test/key' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/../secret' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/..' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/.' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: '../model' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'gpt-4o-mini' })).toThrow('model');
    expect(() => parseAiProviderConfig({ ...stored, model: 'provider/model\u0000' })).toThrow('model');
  });

  it('accepts valid OpenRouter model identifiers including the pinned default', () => {
    expect(parseAiProviderConfig(stored).model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(parseAiProviderConfig({ ...stored, model: 'future-provider/future-model.v9:custom' }).model).toBe(
      'future-provider/future-model.v9:custom',
    );
    expect(parseAiProviderConfig({ ...stored, model: 'vendor/model.v2' }).model).toBe('vendor/model.v2');
  });
});
