import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAuditService } from '../chat-audit.service';

export interface ReleaseConversationCommand {
  conversationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class ReleaseConversationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: ReleaseConversationCommand): Promise<ChatConversation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const conversation = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.status !== ConversationStatus.STAFF_ACTIVE) {
        throw new ConflictException('Only staff-active conversations can be released');
      }
      if (!conversation.isAiChat) {
        throw new ConflictException('Only AI conversations can be released to the assistant');
      }
      const isAdmin = command.actorRole === UserRole.ADMIN || command.actorRole === UserRole.SUPER_ADMIN;
      if (!isAdmin && conversation.assignedStaffUserId !== command.actorUserId) {
        throw new ForbiddenException('Conversation is assigned to another staff user');
      }

      const released = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: ConversationStatus.STAFF_ACTIVE,
          isAiChat: true,
          ...(!isAdmin ? { assignedStaffUserId: command.actorUserId } : {}),
        },
        data: {
          status: ConversationStatus.AI_ACTIVE,
          assignedStaffUserId: null,
          staffClaimedAt: null,
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      if (released.count !== 1) throw new ConflictException('Conversation state changed before release');
      const current = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!current) throw new NotFoundException('Conversation not found');
      await this.audit.record({
        action: 'RELEASED_TO_AI', conversationId: command.conversationId, actorUserId: command.actorUserId,
      }, tx);
      return current;
    });
  }
}
