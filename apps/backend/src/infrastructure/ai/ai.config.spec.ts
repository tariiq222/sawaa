import { aiConfig } from './ai.config';

describe('aiConfig', () => {
  it('should return config with defaults', () => {
    const config = aiConfig();
    expect(config.openaiApiKey).toBeDefined();
    expect(config.embeddingModel).toBeDefined();
    expect(config.chatModel).toBeDefined();
  });
});
