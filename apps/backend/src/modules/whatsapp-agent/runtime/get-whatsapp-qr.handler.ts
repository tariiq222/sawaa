import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';

export interface WhatsappQrView {
  status: 'pending' | 'connected' | 'disconnected' | 'not_configured';
  base64: string | null;
  pairingCode: string | null;
  count: number;
  connectedPhone: string | null;
  error: string | null;
}

/**
 * Proxies the QR pairing artifact from Evolution API to the dashboard.
 * When the instance is already connected, returns status='connected' so the
 * UI can render the success state instead of the QR code.
 */
@Injectable()
export class GetWhatsappQrHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute(): Promise<WhatsappQrView> {
    const config = await this.prisma.whatsappAgentConfig.findFirst();
    if (!config) {
      return {
        status: 'not_configured',
        base64: null,
        pairingCode: null,
        count: 0,
        connectedPhone: null,
        error: null,
      };
    }

    let transport;
    try {
      transport = await this.transport.resolve();
    } catch (e: unknown) {
      return {
        status: 'not_configured',
        base64: null,
        pairingCode: null,
        count: 0,
        connectedPhone: null,
        error: e instanceof Error ? e.message : 'Not configured',
      };
    }

    // First glance: is the instance already paired?
    try {
      const state = await transport.client.getConnectionState();
      if (state.state === 'open') {
        return {
          status: 'connected',
          base64: null,
          pairingCode: null,
          count: 0,
          connectedPhone: state.connectedPhone,
          error: null,
        };
      }
    } catch {
      // fall through to QR fetch
    }

    try {
      const qr = await transport.client.getQr();
      return this.toView(qr);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch QR';
      if (message.includes('Evolution API 404')) {
        try {
          await transport.client.createInstance();
          const qr = await transport.client.getQr();
          return this.toView(qr);
        } catch (createError: unknown) {
          return {
            status: 'disconnected',
            base64: null,
            pairingCode: null,
            count: 0,
            connectedPhone: null,
            error: createError instanceof Error ? createError.message : message,
          };
        }
      }
      return {
        status: 'disconnected',
        base64: null,
        pairingCode: null,
        count: 0,
        connectedPhone: null,
        error: message,
      };
    }
  }

  private toView(qr: {
    base64: string | null;
    pairingCode: string | null;
    count: number;
  }): WhatsappQrView {
    return {
      status: qr.base64 ? 'pending' : 'disconnected',
      base64: qr.base64,
      pairingCode: qr.pairingCode,
      count: qr.count,
      connectedPhone: null,
      error: null,
    };
  }
}
