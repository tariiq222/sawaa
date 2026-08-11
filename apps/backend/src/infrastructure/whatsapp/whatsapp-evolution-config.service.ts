import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsappEvolutionConfig {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
  webhookSecret: string;
}

@Injectable()
export class WhatsappEvolutionConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): WhatsappEvolutionConfig | null {
    const baseUrl = this.config.get<string>('WHATSAPP_EVOLUTION_BASE_URL')?.trim();
    const instanceName = this.config
      .get<string>('WHATSAPP_EVOLUTION_INSTANCE_NAME')
      ?.trim();
    const apiKey = this.config.get<string>('WHATSAPP_EVOLUTION_API_KEY')?.trim();
    const webhookSecret = this.config
      .get<string>('WHATSAPP_EVOLUTION_WEBHOOK_SECRET')
      ?.trim();

    if (!baseUrl || !instanceName || !apiKey || !webhookSecret) return null;

    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      instanceName,
      apiKey,
      webhookSecret,
    };
  }
}
