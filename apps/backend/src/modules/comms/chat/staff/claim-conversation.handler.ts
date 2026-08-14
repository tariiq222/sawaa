import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, type ChatConversation } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAuditService } from '../chat-audit.service';

export interface ClaimConversationCommand {
  conversationId: string;
  staffUserId: string;
}

@Injectable()
export class ClaimConversationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: ClaimConversationCommand): Promise<ChatConversation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const claimed = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: ConversationStatus.WAITING_FOR_STAFF,
          assignedStaffUserId: null,
        },
        data: {
          status: ConversationStatus.STAFF_ACTIVE,
          assignedStaffUserId: command.staffUserId,
          staffClaimedAt: new Date(),
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException('Conversation is no longer available to claim');

      const conversation = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!conversation) throw new NotFoundException('Conversation not found');
      await this.audit.record({
        action: 'STAFF_CLAIMED', conversationId: command.conversationId, actorUserId: command.staffUserId,
      }, tx);
      return conversation;
    });
  }
}
