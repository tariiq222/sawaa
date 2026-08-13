import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, type ChatConversation } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ClaimConversationCommand {
  conversationId: string;
  staffUserId: string;
}

@Injectable()
export class ClaimConversationHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ClaimConversationCommand): Promise<ChatConversation> {
    const claimed = await this.prisma.chatConversation.updateMany({
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

    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}
