import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappEvolutionConfigService } from '../../../infrastructure/whatsapp/whatsapp-evolution-config.service';

@Injectable()
export class SyncWhatsappConfigOnStartupService implements OnModuleInit {
  private readonly logger = new Logger(SyncWhatsappConfigOnStartupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionConfig: WhatsappEvolutionConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const runtime = this.evolutionConfig.get();
    if (!runtime) {
      this.logger.warn(
        'WhatsApp Evolution API is not configured in the backend environment',
      );
      return;
    }

    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    if (existing) {
      await this.prisma.whatsappAgentConfig.update({
        where: { id: existing.id },
        data: {
          provider: 'EVOLUTION_API',
          evolutionBaseUrl: runtime.baseUrl,
          evolutionInstanceName: runtime.instanceName,
        },
      });
      return;
    }

    await this.prisma.whatsappAgentConfig.create({
      data: {
        provider: 'EVOLUTION_API',
        evolutionBaseUrl: runtime.baseUrl,
        evolutionInstanceName: runtime.instanceName,
        isActive: false,
      },
    });
  }
}
