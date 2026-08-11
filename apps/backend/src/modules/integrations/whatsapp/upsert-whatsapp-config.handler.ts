import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { EvolutionApiClient } from '../../../infrastructure/whatsapp/evolution-api.client';
import { WhatsappEvolutionConfigService } from '../../../infrastructure/whatsapp/whatsapp-evolution-config.service';
import { UpsertWhatsappConfigDto } from './dto/upsert-whatsapp-config.dto';

@Injectable()
export class UpsertWhatsappConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionConfig: WhatsappEvolutionConfigService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: UpsertWhatsappConfigDto) {
    if (dto.provider !== 'EVOLUTION_API') {
      throw new BadRequestException('Only Evolution API is configured for WhatsApp');
    }

    const runtime = this.evolutionConfig.get();
    if (!runtime) {
      throw new BadRequestException(
        'WhatsApp Evolution API is not configured on the backend',
      );
    }

    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    const data = {
      provider: 'EVOLUTION_API' as const,
      evolutionBaseUrl: runtime.baseUrl,
      evolutionInstanceName: runtime.instanceName,
      isActive: dto.isActive ?? existing?.isActive ?? false,
    };

    const upserted = existing
      ? await this.prisma.whatsappAgentConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.whatsappAgentConfig.create({
          data,
        });

    let verified = false;
    let verifiedPhone: string | undefined;
    let verifiedError: string | undefined;
    try {
      const client = new EvolutionApiClient({
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        instanceName: runtime.instanceName,
      });
      const result = await client.verify();
      verified = result.ok;
      verifiedPhone = result.phone;
      verifiedError = result.error;

      if (verified && data.isActive) {
        const publicApiUrl =
          this.config.get<string>('API_PUBLIC_URL') ||
          this.config.get<string>('BACKEND_URL') ||
          'http://localhost:5200';
        const webhookUrl = `${publicApiUrl.replace(/\/$/, '')}/api/v1/public/whatsapp/webhook`;
        await client.setWebhook(webhookUrl, runtime.webhookSecret);
      }
    } catch (e: unknown) {
      verifiedError = e instanceof Error ? e.message : 'unknown';
    }

    await this.prisma.whatsappAgentConfig.update({
      where: { id: upserted.id },
      data: {
        lastTestAt: new Date(),
        lastTestOk: verified,
        lastTestError: verified ? null : verifiedError ?? null,
      },
    });

    return {
      configured: true,
      isActive: upserted.isActive,
      verified,
      verifiedPhone,
      verifiedError,
    };
  }
}
