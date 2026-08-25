import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma, type CommsChatMessage } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { lockChatConversation } from '../conversation-lock.helper';
import { queuedAdministrativeMessageState, readAdministrativeMessageState, readNonNegativeInteger } from './administrative-message-state';
import { stageAdministrativeMessageProcessing } from './administrative-message-processing-requested.event';

const MAX_MANUAL_RETRIES = 2;

export type RetryAdministrativeMessageCommand =
  | { audience: 'guest'; conversationId: string; messageId: string; guestToken: string }
  | { audience: 'client'; conversationId: string; messageId: string; clientId: string };

@Injectable()
export class RetryAdministrativeMessageHandler {
  constructor(
    private readonly access: ChatAccessService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(command: RetryAdministrativeMessageCommand): Promise<CommsChatMessage> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      await tx.$queryRaw`SELECT "id" FROM "ChatConversation" WHERE "id" = ${command.conversationId} FOR UPDATE`;
      const conversation = await tx.chatConversation.findFirst({
        where: command.audience === 'guest'
          ? { id: command.conversationId, clientId: null, guestTokenHash: this.access.guestTokenHash(command.guestToken) }
          : { id: command.conversationId, clientId: command.clientId },
        select: { id: true, clientId: true, status: true, isAiChat: true, stateVersion: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (!conversation || !conversation.isAiChat || conversation.status !== ConversationStatus.AI_ACTIVE) {
        throw new BadRequestException('Administrative assistant retry is unavailable');
      }

      await tx.$queryRaw`SELECT "id" FROM "CommsChatMessage" WHERE "id" = ${command.messageId} FOR UPDATE`;
      const message = await tx.commsChatMessage.findUnique({ where: { id: command.messageId } });
      if (!message || message.conversationId !== command.conversationId) {
        throw new NotFoundException('Message not found');
      }
      if (message.senderType !== MessageSenderType.CLIENT && message.senderType !== MessageSenderType.VISITOR) {
        throw new BadRequestException('Only an inbound message can be retried');
      }

      const metadata = readAdministrativeMessageState(message.metadata);
      if (metadata.assistantStatus === 'RETRYING') {
        throw new ConflictException('Administrative assistant retry is already in progress');
      }
      const attempts = readNonNegativeInteger(metadata.retryAttempts);
      if (metadata.assistantStatus !== 'RETRYABLE_FAILURE' || metadata.retryable !== true) {
        throw new BadRequestException('Message is not retryable');
      }
      if (attempts >= MAX_MANUAL_RETRIES) {
        throw new BadRequestException('Administrative assistant retry limit reached');
      }

      const dispatchAttempt = readNonNegativeInteger(metadata.dispatchAttempt) + 1;
      const updated = await tx.commsChatMessage.update({
        where: { id: command.messageId },
        data: {
          metadata: queuedAdministrativeMessageState({
            status: 'RETRYING',
            dispatchAttempt,
            retryAttempts: attempts + 1,
            assistantStateVersion: conversation.stateVersion,
            assistantClientId: conversation.clientId,
          }),
        },
      });
      await stageAdministrativeMessageProcessing(tx, {
        messageId: command.messageId,
        manualRetry: true,
        dispatchAttempt,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
