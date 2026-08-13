import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface AssignConversationCommand {
  conversationId: string;
  targetStaffUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class AssignConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: AssignConversationCommand): Promise<ChatConversation> {
    if (command.actorRole !== UserRole.ADMIN && command.actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only administrators can assign conversations');
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: command.targetStaffUserId,
        isActive: true,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RECEPTIONIST] },
      },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Active dashboard user not found');

    const assigned = await this.prisma.chatConversation.updateMany({
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

    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}
