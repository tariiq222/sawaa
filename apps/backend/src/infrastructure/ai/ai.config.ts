import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  chatModel: process.env.OPENROUTER_CHAT_MODEL ?? 'anthropic/claude-3.5-haiku',
}));

export type AiConfig = ReturnType<typeof aiConfig>;
