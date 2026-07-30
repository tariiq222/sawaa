import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';

export interface WhatsappStatusView {
  isActive: boolean;
  isConnected: boolean;
  provider: string | null;
  evolutionState: string | null;
  connectedPhone: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  uptimeSeconds: number | null;
  messagesCount: number;
  activeChatCount: number;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
}

/**
 * Aggregates runtime state by polling the Evolution API + the local DB.
 * The dashboard refetches every 5s; we keep the call cheap by hitting
 * Evolution API's connectionState endpoint (lightweight) and counting
 * active conversations from the DB.
 */
@Injectable()
export class GetWhatsappStatusHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute(): Promise<WhatsappStatusView> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    const activeChatCount = await this.prisma.whatsappConversation.count({
      where: { status: 'ACTIVE' },
    });

    if (!config) {
      return {
        isActive: false,
        isConnected: false,
        provider: null,
        evolutionState: null,
        connectedPhone: null,
        connectedAt: null,
        disconnectedAt: null,
        uptimeSeconds: null,
        messagesCount: 0,
        activeChatCount,
        lastErrorAt: null,
        lastErrorMessage: null,
      };
    }

    // Poll Evolution API for the live state.
    let evolutionState: string | null = null;
    let connectedPhone = config.connectedPhone;
    let isConnected = config.isConnected;
    if (config.evolutionBaseUrl && config.evolutionInstanceName) {
      try {
        const { client } = await this.transport.resolve();
        const state = await client.getConnectionState();
        evolutionState = state.state;
        connectedPhone = state.connectedPhone ?? null;
        isConnected = state.state === 'open';

        // Persist the latest snapshot so we have history when the dashboard
        // is offline.
        if (isConnected !== config.isConnected) {
          await this.prisma.whatsappAgentConfig.update({
            where: { id: config.id },
            data: {
              isConnected,
              connectedPhone,
              connectedAt: isConnected ? new Date() : config.connectedAt,
              disconnectedAt: !isConnected ? new Date() : config.disconnectedAt,
            },
          });
        }
      } catch {
        // transport failure → keep last known state, surface via lastError*
      }
    }

    const uptimeSeconds =
      isConnected && config.connectedAt
        ? Math.floor((Date.now() - config.connectedAt.getTime()) / 1000)
        : null;

    return {
      isActive: config.isActive,
      isConnected,
      provider: config.provider,
      evolutionState,
      connectedPhone,
      connectedAt: config.connectedAt,
      disconnectedAt: config.disconnectedAt,
      uptimeSeconds,
      messagesCount: config.messagesCount,
      activeChatCount,
      lastErrorAt: config.lastErrorAt,
      lastErrorMessage: config.lastErrorMessage,
    };
  }
}
