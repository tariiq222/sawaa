import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { assertConversationAccess } from './assert-conversation-access.helper';
import { ChatAuditService } from './chat-audit.service';

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
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(cmd: CloseConversationCommand) {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const conversation = await tx.chatConversation.findFirst({
        where: { id: cmd.conversationId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      await assertConversationAccess(tx, conversation, cmd);
      if (conversation.status === ConversationStatus.CLOSED) {
        return conversation;
      }
      const closed = await tx.chatConversation.update({
        where: { id: cmd.conversationId },
        data: {
          status: ConversationStatus.CLOSED,
          closedAt: new Date(),
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      await this.audit.record({
        action: 'CONVERSATION_CLOSED',
        conversationId: cmd.conversationId,
        ...(cmd.requesterUserId ? { actorUserId: cmd.requesterUserId } : {}),
      }, tx);
      return closed;
    });
  }
}
