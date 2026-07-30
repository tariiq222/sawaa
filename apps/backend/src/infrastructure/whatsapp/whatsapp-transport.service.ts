// whatsapp-transport — resolves the active Evolution API client for the
// singleton WhatsApp config. Returns null when not configured.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database';
import { WhatsappCredentialsService } from './whatsapp-credentials.service';
import { EvolutionApiClient } from './evolution-api.client';
import { DEFAULT_ORG_ID } from '../../common/constants';
import { EvolutionUrlValidator } from './evolution-url.validator';

export interface ResolvedTransport {
  client: EvolutionApiClient;
  instanceName: string;
  evolutionBaseUrl: string;
  provider: string;
  configId: string;
}

@Injectable()
export class WhatsappTransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: WhatsappCredentialsService,
    private readonly urlValidator: EvolutionUrlValidator,
  ) {}

  /**
   * Returns a usable Evolution API client backed by the stored singleton config.
   * Throws if not configured (so callers can decide whether 503 vs 400).
   */
  async resolve(): Promise<ResolvedTransport> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    if (!config) {
      throw new Error('WhatsApp agent is not configured');
    }
    if (!config.evolutionBaseUrl || !config.evolutionInstanceName) {
      throw new Error('Evolution API URL or instance name is missing');
    }
    if (!config.credentialsCiphertext) {
      throw new Error('Evolution API credentials are not stored');
    }

    // Resolve DNS again immediately before attaching the API key. This closes
    // the save-time DNS rebinding window for a stored hostname.
    await this.urlValidator.validate({
      newBaseUrl: config.evolutionBaseUrl,
      previousBaseUrl: config.evolutionBaseUrl,
    });

    const stored = this.credentials.decrypt<{
      evolutionApiKey?: string;
    }>(config.credentialsCiphertext, DEFAULT_ORG_ID);

    if (!stored.evolutionApiKey) {
      throw new Error('Evolution API key is not stored');
    }

    const client = new EvolutionApiClient({
      baseUrl: config.evolutionBaseUrl,
      apiKey: stored.evolutionApiKey,
      instanceName: config.evolutionInstanceName,
    });

    return {
      client,
      instanceName: config.evolutionInstanceName,
      evolutionBaseUrl: config.evolutionBaseUrl,
      provider: config.provider,
      configId: config.id,
    };
  }
}
