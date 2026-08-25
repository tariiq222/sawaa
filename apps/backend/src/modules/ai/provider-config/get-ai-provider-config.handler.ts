import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AiConnectionStatus, AiProvider, toPublicAiProviderConfig } from './ai-provider-config.types';

@Injectable()
export class GetAiProviderConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const row = await this.prisma.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' } });
    if (row) {
      try { return toPublicAiProviderConfig(row); } catch {
        // A settings row may exist before the first credential is saved.
        return { provider: row.provider, model: row.model, temperature: row.temperature, maxTokens: row.maxTokens, isEnabled: false, connectionStatus: row.connectionStatus, lastTestedAt: row.lastTestedAt, lastTestOk: row.lastTestOk, lastTestErrorCode: row.lastTestErrorCode, hasCredential: false };
      }
    }
    return {
      provider: AiProvider.OPENROUTER,
      model: 'openai/gpt-4o-mini',
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
