import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertChatbotConfigDto } from './upsert-chatbot-config.dto';

export type UpsertChatbotConfigCommand = UpsertChatbotConfigDto;

@Injectable()
export class UpsertChatbotConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * SaaS-02f: ChatbotConfig is the singleton config row.
   * Accepts typed fields plus a free-form `settings` JSON blob for forward-compat.
   */
  async execute(cmd: UpsertChatbotConfigCommand) {
    const data = {
      ...(cmd.systemPromptAr !== undefined ? { systemPromptAr: cmd.systemPromptAr } : {}),
      ...(cmd.systemPromptEn !== undefined ? { systemPromptEn: cmd.systemPromptEn } : {}),
      ...(cmd.greetingAr !== undefined ? { greetingAr: cmd.greetingAr } : {}),
      ...(cmd.greetingEn !== undefined ? { greetingEn: cmd.greetingEn } : {}),
      ...(cmd.escalateToHumanAt !== undefined ? { escalateToHumanAt: cmd.escalateToHumanAt } : {}),
      ...(cmd.settings !== undefined ? { settings: cmd.settings as Prisma.InputJsonValue } : {}),
    };
    const existing = await this.prisma.chatbotConfig.findFirst();
    if (existing) {
      return this.prisma.chatbotConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.chatbotConfig.create({ data });
  }
}
