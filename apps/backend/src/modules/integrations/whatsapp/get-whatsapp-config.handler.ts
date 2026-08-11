import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappEvolutionConfigService } from '../../../infrastructure/whatsapp/whatsapp-evolution-config.service';

export interface WhatsappConfigView {
  configured: boolean;
  isActive: boolean;
  provider?: string;
  lastTestAt?: Date | null;
  lastTestOk?: boolean | null;
  lastTestError?: string | null;
  isConnected?: boolean;
  connectedPhone?: string | null;
  connectedAt?: Date | null;
  messagesCount?: number;
  activeChatCount?: number;
}

@Injectable()
export class GetWhatsappConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionConfig: WhatsappEvolutionConfigService,
  ) {}

  async execute(): Promise<WhatsappConfigView> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    const runtime = this.evolutionConfig.get();

    if (!config || !runtime) {
      return { configured: false, isActive: false };
    }

    return {
      configured: true,
      isActive: config.isActive,
      provider: 'EVOLUTION_API',
      lastTestAt: config.lastTestAt,
      lastTestOk: config.lastTestOk,
      lastTestError: config.lastTestError,
      isConnected: config.isConnected,
      connectedPhone: config.connectedPhone,
      connectedAt: config.connectedAt,
      messagesCount: config.messagesCount,
      activeChatCount: config.activeChatCount,
    };
  }
}
