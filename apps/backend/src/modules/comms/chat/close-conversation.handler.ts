import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { assertConversationAccess } from './assert-conversation-access.helper';

export interface CloseConversationCommand {
  conversationId: string;
  /**
   * Caller identity for role-based scoping (AUTHZ-004 / COMMS-004).
   * EMPLOYEE callers may only close conversations assigned to them.
   */
  requesterRole?: string | null;
  requesterUserId?: string;
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
    await assertConversationAccess(this.prisma, conversation, cmd);
    if (conversation.status === ConversationStatus.CLOSED) {
      return conversation;
    }
    return this.prisma.chatConversation.update({
      where: { id: cmd.conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  }
}
