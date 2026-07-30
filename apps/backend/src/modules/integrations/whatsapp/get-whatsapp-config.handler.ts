import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface WhatsappConfigView {
  configured: boolean;
  isActive: boolean;
  provider?: string;
  evolutionBaseUrl?: string;
  evolutionInstanceName?: string;
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
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<WhatsappConfigView> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();

    if (!config) {
      return { configured: false, isActive: false };
    }

    return {
      configured: true,
      isActive: config.isActive,
      provider: config.provider,
      evolutionBaseUrl: config.evolutionBaseUrl ?? undefined,
      evolutionInstanceName: config.evolutionInstanceName ?? undefined,
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
