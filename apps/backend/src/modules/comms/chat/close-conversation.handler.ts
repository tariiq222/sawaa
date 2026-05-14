import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CloseConversationCommand {
  conversationId: string;
}

@Injectable()
export class CloseConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CloseConversationCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: cmd.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.status === ConversationStatus.CLOSED) {
      return conversation;
    }
    return this.prisma.chatConversation.update({
      where: { id: cmd.conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  }
}
