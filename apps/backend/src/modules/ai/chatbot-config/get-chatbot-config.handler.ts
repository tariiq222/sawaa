import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetChatbotConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * SaaS-02f: ChatbotConfig is the singleton config row.
   * Upsert-on-read: the first call lazily creates the row.
   */
  async execute() {
    const existing = await this.prisma.chatbotConfig.findFirst();
    if (existing) return existing;
    return this.prisma.chatbotConfig.create({ data: {} });
  }
}
