import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappTransportService } from '../../../infrastructure/whatsapp/whatsapp-transport.service';
import { WhatsappControlDto } from '../../integrations/whatsapp/dto/upsert-whatsapp-config.dto';

@Injectable()
export class ControlWhatsappHandler {
  private readonly logger = new Logger(ControlWhatsappHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: WhatsappTransportService,
  ) {}

  async execute(dto: WhatsappControlDto) {
    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    if (!existing) {
      throw new Error('WhatsApp agent is not configured yet');
    }

    try {
      if (dto.action === 'stop') {
        await this.prisma.whatsappAgentConfig.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
        return { action: dto.action, isActive: false };
      } else if (dto.action === 'restart') {
        const { client } = await this.transport.resolve();
        await client.restart();
        await this.prisma.whatsappAgentConfig.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            disconnectedAt: new Date(),
          },
        });
      } else {
        // start
        await this.prisma.whatsappAgentConfig.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed';
      this.logger.warn(`WhatsApp control ${dto.action} failed: ${message}`);
      await this.prisma.whatsappAgentConfig.update({
        where: { id: existing.id },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: message,
        },
      });
      throw new Error(message);
    }

    return { action: dto.action, isActive: true };
  }
}
