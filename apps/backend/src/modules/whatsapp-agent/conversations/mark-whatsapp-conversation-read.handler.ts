import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

@Injectable()
export class MarkWhatsappConversationReadHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(conversationId: string, throughMessageId?: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    let throughCreatedAt: Date | undefined;
    if (throughMessageId) {
      const message = await this.prisma.whatsappMessage.findUnique({
        where: { id: throughMessageId },
        select: { conversationId: true, createdAt: true },
      });
      if (!message || message.conversationId !== conversationId) {
        throw new BadRequestException('Message does not belong to this conversation');
      }
      throughCreatedAt = message.createdAt;
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      await tx.whatsappMessage.updateMany({
        where: {
          conversationId,
          role: 'USER',
          readAt: null,
          ...(throughCreatedAt ? { createdAt: { lte: throughCreatedAt } } : {}),
        },
        data: { readAt: new Date() },
      });

      const unreadCount = await tx.whatsappMessage.count({
        where: { conversationId, role: 'USER', readAt: null },
      });
      await tx.whatsappConversation.update({
        where: { id: conversationId },
        data: { unreadCount, lastReadAt: new Date() },
      });

      return { conversationId, unreadCount };
    });
  }
}
