import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface GetConversationCommand {
  conversationId: string;
}

const SENDER_TYPE_TO_ROLE: Record<MessageSenderType, 'user' | 'staff' | 'assistant'> = {
  [MessageSenderType.CLIENT]: 'user',
  [MessageSenderType.EMPLOYEE]: 'staff',
  [MessageSenderType.AI]: 'assistant',
};

@Injectable()
export class GetConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetConversationCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: cmd.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: conversation.clientId },
      select: { id: true, firstName: true, lastName: true },
    });

    return {
      id: conversation.id,
      clientId: conversation.clientId,
      employeeId: conversation.employeeId,
      handedOff: conversation.employeeId != null,
      startedAt: conversation.createdAt,
      endedAt:
        conversation.status === ConversationStatus.CLOSED ? conversation.updatedAt : null,
      lastMessageAt: conversation.lastMessageAt,
      user: {
        id: conversation.clientId,
        firstName: client?.firstName ?? '',
        lastName: client?.lastName ?? '',
      },
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: SENDER_TYPE_TO_ROLE[m.senderType],
        content: m.body,
        createdAt: m.createdAt,
      })),
    };
  }
}
