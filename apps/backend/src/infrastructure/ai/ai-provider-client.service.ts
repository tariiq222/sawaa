import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../database/prisma.service';
import { AiConnectionStatus, AiProvider, parseAiProviderConfig } from '../../modules/ai/provider-config/ai-provider-config.types';
import { AiProviderCredentialsService } from './ai-provider-credentials.service';

const BASE_URLS: Record<AiProvider, string> = {
  [AiProvider.OPENROUTER]: 'https://openrouter.ai/api/v1',
  [AiProvider.OPENAI]: 'https://api.openai.com/v1',
  [AiProvider.MINIMAX]: 'https://api.minimax.io/v1',
};

@Injectable()
export class AiProviderClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: AiProviderCredentialsService,
  ) {}

  /** Builds a bounded candidate client for the dashboard connection test. */
  createCandidateClient(provider: AiProvider, apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: BASE_URLS[provider],
      timeout: 10_000,
      maxRetries: 0,
      ...(provider === AiProvider.OPENROUTER ? { defaultHeaders: { 'HTTP-Referer': 'https://sawaa.app', 'X-Title': 'Sawaa AI' } } : {}),
    });
  }

  async getReadyClient(): Promise<{
    client: OpenAI;
    model: string;
    provider: AiProvider;
    configVersion: number;
    testedConfigHash: string;
  } | null> {
    const row = await this.prisma.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' } });
    if (!row) return null;
    let config;
    try { config = parseAiProviderConfig(row); } catch { return null; }
    if (
      !config.isEnabled
      || config.connectionStatus !== AiConnectionStatus.CONNECTED
      || config.lastTestOk !== true
      || !config.credentialCiphertext
      || !config.testedConfigHash
    ) return null;
    let apiKey: string;
    try { apiKey = this.credentials.decrypt(config.credentialCiphertext); } catch { return null; }
    try {
      if (this.credentials.fingerprint(apiKey, config.provider, config.model) !== config.testedConfigHash) return null;
    } catch { return null; }
    return {
      client: this.createCandidateClient(config.provider, apiKey),
      model: config.model,
      provider: config.provider,
      configVersion: config.configVersion ?? 0,
      testedConfigHash: config.testedConfigHash,
    };
  }

  async markRetestRequired(): Promise<void> {
    await this.prisma.aiProviderConfig.updateMany({
      where: { singletonKey: 'singleton', connectionStatus: 'CONNECTED' },
      data: { connectionStatus: 'RETEST_REQUIRED', lastTestOk: false, lastTestErrorCode: 'PROVIDER_AUTH' },
    });
  }
}
