import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappCredentialsService } from '../../../infrastructure/whatsapp/whatsapp-credentials.service';
import { UpsertWhatsappAgentConfigDto } from '../../integrations/whatsapp/dto/upsert-whatsapp-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

@Injectable()
export class UpsertWhatsappAgentConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: WhatsappCredentialsService,
  ) {}

  async execute(dto: UpsertWhatsappAgentConfigDto) {
    const existing = await this.prisma.whatsappAgentConfig.findFirst();

    const data = {
      aiModel: dto.aiModel,
      aiTemperature: dto.aiTemperature,
      aiMaxTokens: dto.aiMaxTokens,
      systemPromptAr: dto.systemPromptAr,
      systemPromptEn: dto.systemPromptEn,
      greetingAr: dto.greetingAr ?? null,
      greetingEn: dto.greetingEn ?? null,
      defaultLanguage: dto.defaultLanguage,
      businessHoursOnly: dto.businessHoursOnly ?? false,
      activeDays: dto.activeDays ?? [0, 1, 2, 3, 4],
    };

    // Encrypt the API key if it was provided (write-only).
    // Empty string clears the stored key.
    let aiApiKeyEncrypted: string | null | undefined = existing?.aiApiKeyEncrypted;
    if (dto.aiApiKey !== undefined) {
      if (dto.aiApiKey.trim() === '') {
        aiApiKeyEncrypted = null;
      } else {
        aiApiKeyEncrypted = this.credentials.encrypt(
          { aiApiKey: dto.aiApiKey.trim() },
          DEFAULT_ORG_ID,
        );
      }
    }

    if (existing) {
      const updated = await this.prisma.whatsappAgentConfig.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(aiApiKeyEncrypted !== undefined ? { aiApiKeyEncrypted } : {}),
        },
      });
      return { id: updated.id, ...data, aiApiKeyConfigured: !!updated.aiApiKeyEncrypted };
    }

    const created = await this.prisma.whatsappAgentConfig.create({
      data: {
        ...data,
        provider: 'EVOLUTION_API',
        aiApiKeyEncrypted: aiApiKeyEncrypted ?? null,
      },
    });
    return { id: created.id, ...data, aiApiKeyConfigured: !!created.aiApiKeyEncrypted };
  }
}
