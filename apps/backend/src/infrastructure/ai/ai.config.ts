import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  providerEncryptionKey: process.env.AI_PROVIDER_ENCRYPTION_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  chatModel: process.env.OPENROUTER_CHAT_MODEL ?? 'deepseek/deepseek-v4-flash-0731',
}));

export type AiConfig = ReturnType<typeof aiConfig>;
