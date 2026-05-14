import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpsertChatbotConfigDto } from './upsert-chatbot-config.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpsertChatbotConfigCommand = UpsertChatbotConfigDto;

@Injectable()
export class UpsertChatbotConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  /**
   * SaaS-02f: ChatbotConfig is the org-unique singleton.
   * Accepts typed fields plus a free-form `settings` JSON blob for forward-compat.
   */
  async execute(cmd: UpsertChatbotConfigCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const data = {
      ...(cmd.systemPromptAr !== undefined ? { systemPromptAr: cmd.systemPromptAr } : {}),
      ...(cmd.systemPromptEn !== undefined ? { systemPromptEn: cmd.systemPromptEn } : {}),
      ...(cmd.greetingAr !== undefined ? { greetingAr: cmd.greetingAr } : {}),
      ...(cmd.greetingEn !== undefined ? { greetingEn: cmd.greetingEn } : {}),
      ...(cmd.escalateToHumanAt !== undefined ? { escalateToHumanAt: cmd.escalateToHumanAt } : {}),
      ...(cmd.settings !== undefined ? { settings: cmd.settings as Prisma.InputJsonValue } : {}),
    };
    return this.prisma.chatbotConfig.upsert({
      where: { organizationId },
      create: { ...data },
      update: data,
    });
  }
}
