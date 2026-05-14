import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateChatMessageDto {
  conversationId: string;
  senderType: MessageSenderType;
  senderId?: string;
  body: string;
}

@Injectable()
export class CreateChatMessageHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateChatMessageDto) {
    // SaaS-02f: Proxy auto-scopes findFirst by organizationId.
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const [message] = await Promise.all([
      this.prisma.commsChatMessage.create({
        data: {
          // SaaS-02f: derive organizationId from the conversation anchor (never trust client input).
          conversationId: dto.conversationId,
          senderType: dto.senderType,
          senderId: dto.senderId ?? null,
          body: dto.body,
        },
      }),
      this.prisma.chatConversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return message;
  }
}
