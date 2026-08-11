// whatsapp-transport — resolves the active Evolution API client for the
// singleton WhatsApp config. Returns null when not configured.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database';
import { EvolutionApiClient } from './evolution-api.client';
import { WhatsappEvolutionConfigService } from './whatsapp-evolution-config.service';
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
    private readonly evolutionConfig: WhatsappEvolutionConfigService,
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
    const runtime = this.evolutionConfig.get();
    if (!runtime) {
      throw new Error('Evolution API is not configured on the backend');
    }

    // Resolve DNS again immediately before attaching the API key. This closes
    // the configuration-time DNS rebinding window for the backend-owned host.
    await this.urlValidator.validate({
      newBaseUrl: runtime.baseUrl,
      previousBaseUrl: runtime.baseUrl,
    });

    const client = new EvolutionApiClient({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      instanceName: runtime.instanceName,
    });

    return {
      client,
      instanceName: runtime.instanceName,
      evolutionBaseUrl: runtime.baseUrl,
      provider: config.provider,
      configId: config.id,
    };
  }
}
