import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, UserRole, type ChatConversation } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface CloseConversationCommand {
  conversationId: string;
  actorUserId: string;
  actorRole: string | null | undefined;
}

@Injectable()
export class CloseConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CloseConversationCommand): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.status === ConversationStatus.CLOSED) {
      throw new ConflictException('Conversation is already closed');
    }
    const isAdmin = command.actorRole === UserRole.ADMIN || command.actorRole === UserRole.SUPER_ADMIN;
    if (!isAdmin && conversation.assignedStaffUserId !== command.actorUserId) {
      throw new ForbiddenException('Conversation is not assigned to this staff user');
    }

    const closed = await this.prisma.chatConversation.updateMany({
      where: {
        id: command.conversationId,
        status: { not: ConversationStatus.CLOSED },
        ...(!isAdmin ? { assignedStaffUserId: command.actorUserId } : {}),
      },
      data: { status: ConversationStatus.CLOSED, closedAt: new Date() },
    });
    if (closed.count !== 1) throw new ConflictException('Conversation state changed before close');
    const current = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!current) throw new NotFoundException('Conversation not found');
    return current;
  }
}
