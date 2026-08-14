import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationStatus, MessageSenderType, Prisma, type CommsChatMessage } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { lockChatConversation } from '../conversation-lock.helper';
import type { SendChatMessageDto } from './send-chat-message.dto';
import { queuedAdministrativeMessageState } from '../assistant/administrative-message-state';
import { stageAdministrativeMessageProcessing } from '../assistant/administrative-message-processing-requested.event';
import { ChatUsageLimitsService } from '../chat-usage-limits.service';

export type SendChatMessageCommand = SendChatMessageDto & (
  | { audience: 'guest'; conversationId: string; guestToken: string; ipAddress?: string }
  | { audience: 'client'; conversationId: string; clientId: string; ipAddress?: string }
  | { audience: 'staff'; conversationId: string; staffUserId: string }
);

@Injectable()
export class SendChatMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly config: ConfigService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly limits: ChatUsageLimitsService,
  ) {}

  async execute(command: SendChatMessageCommand): Promise<CommsChatMessage> {
    if (command.audience === 'staff') {
      const existing = await this.findExistingMessage(command.conversationId, command.clientMessageId);
      if (existing) return this.staffOwnedDuplicate(existing, command.staffUserId);
    }

    const body = command.body.trim();
    const maxLength = this.config.getOrThrow<number>('CHAT_MAX_MESSAGE_LENGTH');
    if (body.length === 0 || body.length > maxLength) {
      throw new BadRequestException(`Message body must be between 1 and ${maxLength} characters`);
    }

    if (command.audience !== 'staff') {
      const existing = await this.findOwnedExistingMessage(command);
      if (existing) return existing;
      await this.limits.consumeMessage({
        identity: command.audience === 'guest'
          ? `guest:${this.access.guestTokenHash(command.guestToken)}`
          : `client:${command.clientId}`,
        ipAddress: command.ipAddress ?? 'unknown',
      });
    }

    const staffConversation = command.audience === 'staff'
      ? await this.prisma.chatConversation.findFirst({
            where: {
              id: command.conversationId,
              status: ConversationStatus.STAFF_ACTIVE,
              assignedStaffUserId: command.staffUserId,
            },
          })
      : null;
    if (command.audience === 'staff' && !staffConversation) {
      throw new BadRequestException('Conversation is not assigned to this staff user');
    }

    const sender = command.audience === 'guest'
      ? { senderType: MessageSenderType.VISITOR, senderId: null }
      : command.audience === 'client'
        ? { senderType: MessageSenderType.CLIENT, senderId: command.clientId }
        : { senderType: MessageSenderType.STAFF, senderId: command.staffUserId };

    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        await lockChatConversation(tx, command.conversationId);
        await tx.$queryRaw`SELECT "id" FROM "ChatConversation" WHERE "id" = ${command.conversationId} FOR UPDATE`;
        const conversation = command.audience === 'guest'
          ? await tx.chatConversation.findFirst({
              where: {
                id: command.conversationId,
                clientId: null,
                guestTokenHash: this.access.guestTokenHash(command.guestToken),
              },
            })
          : command.audience === 'client'
            ? await tx.chatConversation.findFirst({
                where: { id: command.conversationId, clientId: command.clientId },
              })
            : staffConversation;
        if (!conversation) {
          if (command.audience === 'staff') {
            throw new BadRequestException('Conversation is not assigned to this staff user');
          }
          throw new NotFoundException('Conversation not found');
        }
        const existing = await tx.commsChatMessage.findUnique({
          where: {
            conversationId_clientMessageId: {
              conversationId: command.conversationId,
              clientMessageId: command.clientMessageId,
            },
          },
        });
        if (existing) {
          return command.audience === 'staff'
            ? this.staffOwnedDuplicate(existing, command.staffUserId)
            : existing;
        }
        if (conversation.status === ConversationStatus.CLOSED) {
          throw new BadRequestException('Cannot send message to a closed conversation');
        }
        const dispatchAssistant = command.audience !== 'staff'
          && conversation.isAiChat
          && conversation.status === ConversationStatus.AI_ACTIVE;
        const message = await tx.commsChatMessage.create({
          data: {
            conversationId: command.conversationId,
            ...sender,
            body,
            clientMessageId: command.clientMessageId,
            ...(dispatchAssistant
              ? { metadata: queuedAdministrativeMessageState({
                  status: 'QUEUED',
                  dispatchAttempt: 0,
                  assistantStateVersion: conversation.stateVersion,
                  assistantClientId: conversation.clientId,
                }) }
              : {}),
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
              where: {
                id: command.conversationId,
                status: { not: ConversationStatus.CLOSED },
                ...(command.audience === 'guest'
                  ? { clientId: null, guestTokenHash: this.access.guestTokenHash(command.guestToken) }
                  : { clientId: command.clientId }),
              },
              data: {
                lastMessageAt: new Date(),
                staffUnreadCount: { increment: 1 },
              },
            });
        if (updated.count !== 1) {
          throw new BadRequestException('Cannot send message to a closed conversation');
        }
        if (dispatchAssistant) {
          await stageAdministrativeMessageProcessing(tx, {
            messageId: message.id,
            manualRetry: false,
            dispatchAttempt: 0,
          });
        }
        return message;
      });
    } catch (error) {
      if (!this.isDuplicateClientMessage(error)) throw error;

      const existing = command.audience === 'staff'
        ? await this.findExistingMessage(command.conversationId, command.clientMessageId)
        : await this.findOwnedExistingMessage(command);
      if (existing) {
        return command.audience === 'staff'
          ? this.staffOwnedDuplicate(existing, command.staffUserId)
          : existing;
      }
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

  private findOwnedExistingMessage(
    command: Exclude<SendChatMessageCommand, { audience: 'staff' }>,
  ): Promise<CommsChatMessage | null> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      await tx.$queryRaw`SELECT "id" FROM "ChatConversation" WHERE "id" = ${command.conversationId} FOR UPDATE`;
      const conversation = await tx.chatConversation.findFirst({
        where: command.audience === 'guest'
          ? {
              id: command.conversationId,
              clientId: null,
              guestTokenHash: this.access.guestTokenHash(command.guestToken),
            }
          : { id: command.conversationId, clientId: command.clientId },
        select: { id: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
      return tx.commsChatMessage.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId: command.conversationId,
            clientMessageId: command.clientMessageId,
          },
        },
      });
    });
  }

  private staffOwnedDuplicate(message: CommsChatMessage, staffUserId: string): CommsChatMessage {
    if (message.senderType !== MessageSenderType.STAFF || message.senderId !== staffUserId) {
      throw new ConflictException('Idempotency key belongs to another sender');
    }
    return message;
  }
}
