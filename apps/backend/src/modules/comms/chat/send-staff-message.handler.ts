import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface SendStaffMessageCommand {
  conversationId: string;
  staffId: string;
  body: string;
}

@Injectable()
export class SendStaffMessageHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: SendStaffMessageCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: cmd.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Cannot send message to a closed conversation');
    }

    const [message] = await Promise.all([
      this.prisma.commsChatMessage.create({
        data: {
          // SaaS-02f: derive organizationId from the conversation anchor.
          conversationId: cmd.conversationId,
          senderType: MessageSenderType.EMPLOYEE,
          senderId: cmd.staffId,
          body: cmd.body,
        },
      }),
      this.prisma.chatConversation.update({
        where: { id: cmd.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return message;
  }
}
