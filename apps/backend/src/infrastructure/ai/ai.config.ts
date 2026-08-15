import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  providerEncryptionKey: process.env.AI_PROVIDER_ENCRYPTION_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  chatModel: process.env.OPENROUTER_CHAT_MODEL ?? 'anthropic/claude-3.5-haiku',
}));

export type AiConfig = ReturnType<typeof aiConfig>;
