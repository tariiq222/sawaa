import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AiConnectionStatus, AiProvider, DEFAULT_OPENROUTER_MODEL, toPublicAiProviderConfig } from './ai-provider-config.types';

@Injectable()
export class GetAiProviderConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const row = await this.prisma.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' } });
    if (row) {
      try { return toPublicAiProviderConfig(row); } catch {
        // Leftover OpenAI/MiniMax rows or incomplete credentials are not chat-ready.
        return { provider: AiProvider.OPENROUTER, model: DEFAULT_OPENROUTER_MODEL, temperature: row.temperature, maxTokens: row.maxTokens, isEnabled: false, connectionStatus: AiConnectionStatus.RETEST_REQUIRED, lastTestedAt: row.lastTestedAt, lastTestOk: false, lastTestErrorCode: 'RETEST_REQUIRED', hasCredential: false };
      }
    }
    return {
      provider: AiProvider.OPENROUTER,
      model: DEFAULT_OPENROUTER_MODEL,
      temperature: 0.4,
      maxTokens: 800,
      isEnabled: false,
      connectionStatus: AiConnectionStatus.NOT_CONFIGURED,
      lastTestedAt: null,
      lastTestOk: null,
      lastTestErrorCode: null,
      hasCredential: false,
    };
  }
}
