import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ReleaseConversationCommand {
  conversationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class ReleaseConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReleaseConversationCommand): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.status !== ConversationStatus.STAFF_ACTIVE) {
      throw new ConflictException('Only staff-active conversations can be released');
    }
    const isAdmin = command.actorRole === UserRole.ADMIN || command.actorRole === UserRole.SUPER_ADMIN;
    if (!isAdmin && conversation.assignedStaffUserId !== command.actorUserId) {
      throw new ForbiddenException('Conversation is assigned to another staff user');
    }

    const released = await this.prisma.chatConversation.updateMany({
      where: {
        id: command.conversationId,
        status: ConversationStatus.STAFF_ACTIVE,
        ...(!isAdmin ? { assignedStaffUserId: command.actorUserId } : {}),
      },
      data: {
        status: ConversationStatus.AI_ACTIVE,
        assignedStaffUserId: null,
        staffClaimedAt: null,
      },
    });
    if (released.count !== 1) throw new ConflictException('Conversation state changed before release');
    const current = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!current) throw new NotFoundException('Conversation not found');
    return current;
  }
}
