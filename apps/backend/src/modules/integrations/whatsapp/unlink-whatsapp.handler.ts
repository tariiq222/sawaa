import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/database";
import { WhatsappTransportService } from "../../../infrastructure/whatsapp/whatsapp-transport.service";

/**
 * Disconnects the paired WhatsApp number while preserving the Evolution API
 * configuration. After unlink:
 *   - the WhatsApp session is logged out from the Evolution instance (best effort)
 *   - the Evolution URL, instance name, and encrypted credentials are retained
 *   - the agent is paused until a number is paired again
 *   - historical conversations remain available
 */
@Injectable()
export class UnlinkWhatsappHandler {
  private readonly logger = new Logger(UnlinkWhatsappHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute(): Promise<{ unlinked: true; logoutOk: boolean }> {
    let logoutOk = false;
    try {
      const { client } = await this.transport.resolve();
      await client.logout();
      logoutOk = true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown";
      this.logger.warn(`WhatsApp logout during unlink failed: ${message}`);
    }

    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    if (existing) {
      await this.prisma.whatsappAgentConfig.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          isConnected: false,
          connectedPhone: null,
          connectedAt: null,
          disconnectedAt: new Date(),
          lastTestAt: null,
          lastTestOk: null,
          lastTestError: null,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
    }

    return { unlinked: true, logoutOk };
  }
}
