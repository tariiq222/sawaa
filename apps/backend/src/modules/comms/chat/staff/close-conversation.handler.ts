import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAuditService } from '../chat-audit.service';

export interface CloseConversationCommand {
  conversationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class CloseConversationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: CloseConversationCommand): Promise<ChatConversation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const conversation = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ConflictException('Conversation is already closed');
      }
      const isAdmin = command.actorRole === UserRole.ADMIN || command.actorRole === UserRole.SUPER_ADMIN;
      if (!isAdmin && conversation.assignedStaffUserId !== command.actorUserId) {
        throw new ForbiddenException('Conversation is not assigned to this staff user');
      }

      const closed = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: { not: ConversationStatus.CLOSED },
          ...(!isAdmin ? { assignedStaffUserId: command.actorUserId } : {}),
        },
        data: {
          status: ConversationStatus.CLOSED,
          closedAt: new Date(),
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      if (closed.count !== 1) throw new ConflictException('Conversation state changed before close');
      const current = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!current) throw new NotFoundException('Conversation not found');
      await this.audit.record({
        action: 'CONVERSATION_CLOSED', conversationId: command.conversationId, actorUserId: command.actorUserId,
      }, tx);
      return current;
    });
  }
}
