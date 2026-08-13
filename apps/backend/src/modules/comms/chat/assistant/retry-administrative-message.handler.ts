import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma, type CommsChatMessage } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { AdministrativeAssistantService } from './administrative-assistant.service';

const MAX_MANUAL_RETRIES = 2;

export type RetryAdministrativeMessageCommand =
  | { audience: 'guest'; conversationId: string; messageId: string; guestToken: string }
  | { audience: 'client'; conversationId: string; messageId: string; clientId: string };

@Injectable()
export class RetryAdministrativeMessageHandler {
  constructor(
    private readonly access: ChatAccessService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly assistant: AdministrativeAssistantService,
  ) {}

  async execute(command: RetryAdministrativeMessageCommand): Promise<CommsChatMessage> {
    if (command.audience === 'guest') {
      await this.access.assertGuestAccess(command.conversationId, command.guestToken);
    } else {
      await this.access.assertClientAccess(command.conversationId, command.clientId);
    }

    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CommsChatMessage" WHERE "id" = ${command.messageId} FOR UPDATE`;
      const conversation = await tx.chatConversation.findUnique({
        where: { id: command.conversationId },
        select: { id: true, status: true, isAiChat: true },
      });
      if (!conversation || !conversation.isAiChat || conversation.status !== ConversationStatus.AI_ACTIVE) {
        throw new BadRequestException('Administrative assistant retry is unavailable');
      }

      const message = await tx.commsChatMessage.findUnique({ where: { id: command.messageId } });
      if (!message || message.conversationId !== command.conversationId) {
        throw new NotFoundException('Message not found');
      }
      if (message.senderType !== MessageSenderType.CLIENT && message.senderType !== MessageSenderType.VISITOR) {
        throw new BadRequestException('Only an inbound message can be retried');
      }

      const metadata = readMetadata(message.metadata);
      if (metadata.assistantStatus === 'RETRYING') {
        throw new ConflictException('Administrative assistant retry is already in progress');
      }
      const attempts = readRetryAttempts(metadata.retryAttempts);
      if (metadata.assistantStatus !== 'RETRYABLE_FAILURE' || metadata.retryable !== true) {
        throw new BadRequestException('Message is not retryable');
      }
      if (attempts >= MAX_MANUAL_RETRIES) {
        throw new BadRequestException('Administrative assistant retry limit reached');
      }

      await tx.commsChatMessage.update({
        where: { id: command.messageId },
        data: {
          metadata: {
            assistantStatus: 'RETRYING',
            retryable: false,
            retryAttempts: attempts + 1,
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Model/provider work is deliberately outside the database transaction.
    const response = await this.assistant.processMessage(command.messageId, { manualRetry: true });
    if (response) return response;

    const inbound = await this.rlsTransaction.withTransaction((tx) => tx.commsChatMessage.findUnique({
      where: { id: command.messageId },
    }));
    if (!inbound) throw new NotFoundException('Message not found');
    return inbound;
  }
}

function readMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readRetryAttempts(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
