import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../database/prisma.service';
import { AiConnectionStatus, AiProvider, parseAiProviderConfig } from '../../modules/ai/provider-config/ai-provider-config.types';
import { AiProviderCredentialsService } from './ai-provider-credentials.service';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Resolves the baseURL for an AI provider client. The OPENAI provider can be
 * redirected to an OpenAI-compatible deployment via OPENAI_BASE_URL (env only —
 * DB rows are never trusted to supply a base URL). OPENROUTER always uses the
 * official OpenRouter endpoint.
 */
const resolveBaseUrl = (provider: AiProvider): string => {
  if (provider === AiProvider.OPENAI) {
    const override = process.env.OPENAI_BASE_URL;
    if (isHttpUrl(override)) return override;
    return DEFAULT_OPENAI_BASE_URL;
  }
  return DEFAULT_OPENROUTER_BASE_URL;
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
      baseURL: resolveBaseUrl(provider),
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
