import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChatOperationStatus,
  ChatOperationType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import { assertAssistantOperationFence, type AssistantOperationFence } from './assistant-operation-fence';

export interface PrepareCancellationCommand {
  conversationId: string;
  clientId: string | null;
  sourceMessageId: string;
  bookingId: string;
  assistantFence?: AssistantOperationFence;
}

@Injectable()
export class PrepareCancellationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly quote: ChatBookingQuoteService,
  ) {}

  async execute(command: PrepareCancellationCommand): Promise<ChatOperation> {
    await this.assertConversation(command.conversationId, command.clientId);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const idempotencyKey = this.key(command);
    if (!command.clientId) {
      return this.createOrGet({
        conversationId: command.conversationId,
        clientId: null,
        type: ChatOperationType.CANCEL_BOOKING,
        status: ChatOperationStatus.AWAITING_AUTH,
        payload: { intent: 'CANCEL_BOOKING', request: { bookingId: command.bookingId } },
        summary: { action: 'LOGIN_REQUIRED', intent: 'CANCEL_BOOKING' },
        idempotencyKey,
        requiredConfirmations: 0,
        expiresAt,
        assistantFence: command.assistantFence,
      });
    }
    const prepared = await this.quote.quoteCancellation({
      clientId: command.clientId,
      bookingId: command.bookingId,
    });
    return this.createOrGet({
      conversationId: command.conversationId,
      clientId: command.clientId,
      type: ChatOperationType.CANCEL_BOOKING,
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

  private key(command: PrepareCancellationCommand): string {
    const hash = createHash('sha256').update(command.bookingId).digest('hex');
    return `chat:${command.sourceMessageId}:prepareCancellation:${hash}`;
  }

  private async createOrGet(data: {
    conversationId: string;
    clientId: string | null;
    type: ChatOperationType;
    status: ChatOperationStatus;
    payload: object;
    summary: object;
    idempotencyKey: string;
    requiredConfirmations: number;
    expiresAt: Date;
    assistantFence?: AssistantOperationFence;
  }): Promise<ChatOperation> {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        await assertAssistantOperationFence(tx, data.conversationId, data.clientId, data.assistantFence);
        const existing = await tx.chatOperation.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
        if (existing) return existing;
        return tx.chatOperation.create({
          data: {
            ...this.withoutFence(data),
            payload: data.payload as Prisma.InputJsonValue,
            summary: data.summary as Prisma.InputJsonValue,
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.chatOperation.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (!existing) throw error;
      return existing;
    }
  }

  private withoutFence<T extends { assistantFence?: AssistantOperationFence }>(data: T): Omit<T, 'assistantFence'> {
    const { assistantFence: _fence, ...persisted } = data;
    return persisted;
  }
}
