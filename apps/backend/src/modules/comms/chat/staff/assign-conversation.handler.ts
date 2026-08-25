import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAuditService } from '../chat-audit.service';

export interface AssignConversationCommand {
  conversationId: string;
  targetStaffUserId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class AssignConversationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: AssignConversationCommand): Promise<ChatConversation> {
    if (command.actorRole !== UserRole.ADMIN && command.actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only administrators can assign conversations');
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: {
          id: command.targetStaffUserId,
          isActive: true,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RECEPTIONIST] },
        },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Active dashboard user not found');

      const assigned = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: { in: [ConversationStatus.WAITING_FOR_STAFF, ConversationStatus.STAFF_ACTIVE] },
        },
        data: {
          status: ConversationStatus.STAFF_ACTIVE,
          assignedStaffUserId: target.id,
          staffClaimedAt: new Date(),
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      if (assigned.count !== 1) throw new ConflictException('Conversation cannot be assigned in its current state');

      const conversation = await tx.chatConversation.findUnique({ where: { id: command.conversationId } });
      if (!conversation) throw new NotFoundException('Conversation not found');
      await this.audit.record({
        action: 'STAFF_ASSIGNED', conversationId: command.conversationId,
        actorUserId: command.actorUserId, targetStaffUserId: command.targetStaffUserId,
      }, tx);
      return conversation;
    });
  }
}
