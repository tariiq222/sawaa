import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

/**
 * Closes a conversation and releases any active staff takeover.
 * The next inbound message from this phone will start a new conversation.
 */
@Injectable()
export class CloseWhatsappConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.whatsappConversation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        staffTakeover: false,
        staffUserId: null,
        staffTookOverAt: null,
      },
    });

    return { closed: true };
  }
}
