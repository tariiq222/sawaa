import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
      const changed = await tx.chatConversation.updateMany({
        where: { id: cmd.conversationId, status: { not: ConversationStatus.CLOSED } },
        data: {
          status: ConversationStatus.CLOSED,
          closedAt: new Date(),
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      const current = await tx.chatConversation.findFirst({ where: { id: cmd.conversationId } });
      if (!current) throw new NotFoundException('Conversation not found');
      if (changed.count !== 1) {
        if (current.status === ConversationStatus.CLOSED) return current;
        throw new ConflictException('Conversation changed before it could be closed');
      }
      await this.audit.record({
        action: 'CONVERSATION_CLOSED',
        conversationId: cmd.conversationId,
        ...(cmd.requesterUserId ? { actorUserId: cmd.requesterUserId } : {}),
      }, tx);
      return current;
    });
  }
}
