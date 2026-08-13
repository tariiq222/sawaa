import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

@Injectable()
export class StaffConversationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertReadAccess(conversationId: string, staffUserId: string, staffRole: string | null | undefined) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, assignedStaffUserId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isAdmin = staffRole === UserRole.ADMIN || staffRole === UserRole.SUPER_ADMIN;
    if (
      !isAdmin
      && conversation.assignedStaffUserId !== null
      && conversation.assignedStaffUserId !== staffUserId
    ) {
      throw new ForbiddenException('Conversation is assigned to another staff user');
    }
    return conversation;
  }
}
