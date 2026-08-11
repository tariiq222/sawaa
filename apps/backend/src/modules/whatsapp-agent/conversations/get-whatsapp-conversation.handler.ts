import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetWhatsappConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const messages = await this.prisma.whatsappMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        toolCalls: true,
        toolResults: true,
        tokenUsage: true,
        latencyMs: true,
        errorMessage: true,
        deliveryStatus: true,
        providerMessageId: true,
        externalMessageId: true,
        inReplyToExternalMessageId: true,
        readAt: true,
        createdAt: true,
      },
    });

    return {
      ...conversation,
      messages,
    };
  }
}
