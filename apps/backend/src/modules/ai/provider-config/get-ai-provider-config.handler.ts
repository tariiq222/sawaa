import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { isProviderEnumDecodeError } from '../../../infrastructure/ai/ai-provider-client.service';
import { AiConnectionStatus, AiProvider, DEFAULT_OPENROUTER_MODEL, toPublicAiProviderConfig } from './ai-provider-config.types';

const pinnedRetestProjection = (overrides: Record<string, unknown> = {}) => ({
  provider: AiProvider.OPENROUTER,
  model: DEFAULT_OPENROUTER_MODEL,
  temperature: 0.4,
  maxTokens: 800,
  isEnabled: false,
  connectionStatus: AiConnectionStatus.RETEST_REQUIRED,
  lastTestedAt: null,
  lastTestOk: false,
  lastTestErrorCode: 'RETEST_REQUIRED',
  hasCredential: false,
  ...overrides,
});

@Injectable()
export class GetAiProviderConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    let row;
    try {
      row = await this.prisma.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' } });
    } catch (error) {
      if (isProviderEnumDecodeError(error)) return pinnedRetestProjection();
      throw error;
    }
    if (row) {
      try {
        const projected = toPublicAiProviderConfig(row);
        if (projected.model !== DEFAULT_OPENROUTER_MODEL) {
          return pinnedRetestProjection({
            temperature: projected.temperature,
            maxTokens: projected.maxTokens,
            lastTestedAt: projected.lastTestedAt,
            hasCredential: projected.hasCredential,
          });
        }
        return projected;
      } catch {
        return pinnedRetestProjection({
          temperature: row.temperature,
          maxTokens: row.maxTokens,
          lastTestedAt: row.lastTestedAt,
        });
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
