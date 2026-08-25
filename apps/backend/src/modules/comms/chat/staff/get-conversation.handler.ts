import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { STAFF_CONVERSATION_SELECT, toStaffConversationResponse } from './staff-conversation.mapper';
import { StaffConversationAccessService } from './staff-conversation-access.service';

export interface GetConversationCommand {
  conversationId: string;
  staffUserId: string;
  staffRole: string | null | undefined;
}

@Injectable()
export class GetConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StaffConversationAccessService,
  ) {}

  async execute(command: GetConversationCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: this.access.buildReadWhere(command.conversationId, command.staffUserId, command.staffRole),
      select: STAFF_CONVERSATION_SELECT,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return toStaffConversationResponse(conversation);
  }
}
