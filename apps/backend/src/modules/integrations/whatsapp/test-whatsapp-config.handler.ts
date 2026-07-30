import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';

@Injectable()
export class TestWhatsappConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute() {
    let result: { ok: boolean; state?: string; phone?: string; error?: string };
    try {
      const { client } = await this.transport.resolve();
      result = await client.verify();
    } catch (e: unknown) {
      result = {
        ok: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    if (existing) {
      await this.prisma.whatsappAgentConfig.update({
        where: { id: existing.id },
        data: {
          lastTestAt: new Date(),
          lastTestOk: result.ok,
          lastTestError: result.ok ? null : result.error ?? null,
        },
      });
    }

    return result.ok
      ? { ok: true, state: result.state, phone: result.phone }
      : { ok: false, error: result.error };
  }
}
