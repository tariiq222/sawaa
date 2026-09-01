import { aiConfig } from './ai.config';

describe('aiConfig', () => {
  it('should return config with defaults', () => {
    const config = aiConfig();
    expect(config.openaiApiKey).toBeDefined();
    expect(config.embeddingModel).toBeDefined();
    expect(config.chatModel).toBeDefined();
  });

  it('defaults chat model to the pinned OpenRouter DeepSeek Flash id', () => {
    const original = process.env.OPENROUTER_CHAT_MODEL;
    delete process.env.OPENROUTER_CHAT_MODEL;
    try {
      expect(aiConfig().chatModel).toBe('deepseek/deepseek-v4-flash-0731');
    } finally {
      if (original === undefined) delete process.env.OPENROUTER_CHAT_MODEL;
      else process.env.OPENROUTER_CHAT_MODEL = original;
    }
  });
});
