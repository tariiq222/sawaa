import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChatOperationStatus,
  ChatOperationType,
  type ChatOperation,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import { assistantDispatchIdempotencyKey, type AssistantOperationFence } from './assistant-operation-fence';
import { createOrGetPreparedOperation } from './create-or-get-prepared-operation';

export interface PrepareRescheduleCommand {
  conversationId: string;
  clientId: string | null;
  sourceMessageId: string;
  bookingId: string;
  newScheduledAt: string;
  assistantFence?: AssistantOperationFence;
}

@Injectable()
export class PrepareRescheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly quote: ChatBookingQuoteService,
  ) {}

  async execute(command: PrepareRescheduleCommand): Promise<ChatOperation> {
    await this.assertConversation(command.conversationId, command.clientId);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const idempotencyKey = this.key(command);
    if (!command.clientId) {
      const newScheduledAt = new Date(command.newScheduledAt);
      if (Number.isNaN(newScheduledAt.getTime())) {
        throw new BadRequestException('New scheduled time is invalid');
      }
      return createOrGetPreparedOperation(this.prisma, this.rlsTransaction, {
        conversationId: command.conversationId,
        clientId: null,
        type: ChatOperationType.RESCHEDULE_BOOKING,
        status: ChatOperationStatus.AWAITING_AUTH,
        payload: {
          intent: 'RESCHEDULE_BOOKING',
          request: {
            bookingId: command.bookingId,
            newScheduledAt: newScheduledAt.toISOString(),
          },
        },
        summary: {
          action: 'LOGIN_REQUIRED',
          intent: 'RESCHEDULE_BOOKING',
          newScheduledAt: newScheduledAt.toISOString(),
        },
        idempotencyKey,
        requiredConfirmations: 0,
        expiresAt,
        assistantFence: command.assistantFence,
      });
    }
    const prepared = await this.quote.quoteReschedule({
      clientId: command.clientId,
      bookingId: command.bookingId,
      newScheduledAt: command.newScheduledAt,
    });
    return createOrGetPreparedOperation(this.prisma, this.rlsTransaction, {
      conversationId: command.conversationId,
      clientId: command.clientId,
      type: ChatOperationType.RESCHEDULE_BOOKING,
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      payload: prepared.payload,
      summary: prepared.summary,
      idempotencyKey,
      requiredConfirmations: 1,
      expiresAt,
      assistantFence: command.assistantFence,
    });
  }

  private async assertConversation(conversationId: string, clientId: string | null) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, clientId: true },
    });
    if (!conversation || conversation.clientId !== clientId) {
      throw new ForbiddenException('Conversation does not belong to this client');
    }
  }

  private key(command: PrepareRescheduleCommand): string {
    const hash = createHash('sha256')
      .update(JSON.stringify({ bookingId: command.bookingId, newScheduledAt: command.newScheduledAt }))
      .digest('hex');
    return assistantDispatchIdempotencyKey(`chat:${command.sourceMessageId}:prepareReschedule:${hash}`, command.assistantFence);
  }

}
