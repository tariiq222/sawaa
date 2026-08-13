import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationStatus, MessageSenderType, Prisma, type CommsChatMessage } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import type { SendChatMessageDto } from './send-chat-message.dto';

export type SendChatMessageCommand = SendChatMessageDto & (
  | { audience: 'guest'; conversationId: string; guestToken: string }
  | { audience: 'client'; conversationId: string; clientId: string }
  | { audience: 'staff'; conversationId: string; staffUserId: string }
);

@Injectable()
export class SendChatMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly config: ConfigService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(command: SendChatMessageCommand): Promise<CommsChatMessage> {
    const body = command.body.trim();
    const maxLength = this.config.getOrThrow<number>('CHAT_MAX_MESSAGE_LENGTH');
    if (body.length === 0 || body.length > maxLength) {
      throw new BadRequestException(`Message body must be between 1 and ${maxLength} characters`);
    }

    const conversation = command.audience === 'guest'
      ? await this.access.assertGuestAccess(command.conversationId, command.guestToken)
      : command.audience === 'client'
        ? await this.access.assertClientAccess(command.conversationId, command.clientId)
        : await this.prisma.chatConversation.findFirst({
            where: {
              id: command.conversationId,
              status: ConversationStatus.STAFF_ACTIVE,
              assignedStaffUserId: command.staffUserId,
            },
          });
    if (!conversation) throw new BadRequestException('Conversation is not assigned to this staff user');

    const existing = await this.findExistingMessage(command.conversationId, command.clientMessageId);
    if (existing) return existing;

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Cannot send message to a closed conversation');
    }

    const sender = command.audience === 'guest'
      ? { senderType: MessageSenderType.VISITOR, senderId: null }
      : command.audience === 'client'
        ? { senderType: MessageSenderType.CLIENT, senderId: command.clientId }
        : { senderType: MessageSenderType.STAFF, senderId: command.staffUserId };

    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        const message = await tx.commsChatMessage.create({
          data: {
            conversationId: command.conversationId,
            ...sender,
            body,
            clientMessageId: command.clientMessageId,
          },
        });
        const updated = command.audience === 'staff'
          ? await tx.chatConversation.updateMany({
              where: {
                id: command.conversationId,
                status: ConversationStatus.STAFF_ACTIVE,
                assignedStaffUserId: command.staffUserId,
              },
              data: { lastMessageAt: new Date(), clientUnreadCount: { increment: 1 } },
            })
          : await tx.chatConversation.updateMany({
              where: { id: command.conversationId, status: { not: ConversationStatus.CLOSED } },
              data: {
                lastMessageAt: new Date(),
                staffUnreadCount: { increment: 1 },
              },
            });
        if (updated.count !== 1) {
          throw new BadRequestException('Cannot send message to a closed conversation');
        }
        return message;
      });
    } catch (error) {
      if (!this.isDuplicateClientMessage(error)) throw error;

      const existing = await this.findExistingMessage(command.conversationId, command.clientMessageId);
      if (existing) return existing;
      throw error;
    }
  }

  private isDuplicateClientMessage(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private findExistingMessage(conversationId: string, clientMessageId: string): Promise<CommsChatMessage | null> {
    return this.prisma.commsChatMessage.findUnique({
      where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
    });
  }
}
