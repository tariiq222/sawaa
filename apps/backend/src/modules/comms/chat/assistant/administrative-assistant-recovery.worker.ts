import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { BullMqService } from '../../../../infrastructure/queue/bull-mq.service';
import { stageAdministrativeMessageProcessing } from './administrative-message-processing-requested.event';
import {
  queuedAdministrativeMessageState,
  readAdministrativeMessageState,
  readNonNegativeInteger,
} from './administrative-message-state';

const QUEUE_NAME = 'comms-chat-assistant-recovery';
const SWEEP_JOB = 'sweep-stale-administrative-messages';
const STALE_AFTER_MS = 2 * 60_000;
const MAX_DISPATCH_ATTEMPTS = 5;
const BATCH_SIZE = 50;

@Injectable()
export class AdministrativeAssistantRecoveryWorker implements OnModuleInit {
  private readonly logger = new Logger(AdministrativeAssistantRecoveryWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly bullMq: BullMqService,
  ) {}

  onModuleInit(): void {
    const queue = this.bullMq.getQueue(QUEUE_NAME);
    void queue.add(SWEEP_JOB, {}, {
      repeat: { every: 60_000 },
      jobId: `repeat:${SWEEP_JOB}`,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 100 },
    }).catch((error: unknown) => {
      this.logger.error('Failed to schedule administrative assistant recovery', error);
    });
    const worker = this.bullMq.createWorker(QUEUE_NAME, async () => this.execute());
    worker.on('failed', (_job, error) => {
      this.logger.error('Administrative assistant recovery sweep failed', error);
    });
  }

  async execute(): Promise<void> {
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
    const limit = BATCH_SIZE;
    const candidates = await this.prisma.$queryRaw<Array<{ id: string; conversationId: string }>>`
      SELECT message."id", message."conversationId"
      FROM "CommsChatMessage" message
      JOIN "ChatConversation" conversation ON conversation."id" = message."conversationId"
      LEFT JOIN "CommsChatMessage" response ON response."responseForMessageId" = message."id"
      WHERE message."senderType" IN ('CLIENT'::"MessageSenderType", 'VISITOR'::"MessageSenderType")
        AND response."id" IS NULL
        AND conversation."isAiChat" = true
        AND conversation."status" = 'AI_ACTIVE'::"ConversationStatus"
        AND message."metadata"->>'assistantStatus' IN ('QUEUED', 'RETRYING')
        AND (message."metadata"->>'queuedAt')::timestamptz < ${staleBefore}
      ORDER BY message."createdAt" ASC
      LIMIT ${limit}
    `;

    for (const candidate of candidates) {
      await this.recover(candidate.id, candidate.conversationId);
    }
  }

  private async recover(messageId: string, conversationId: string): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ChatConversation" WHERE "id" = ${conversationId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "CommsChatMessage" WHERE "id" = ${messageId} FOR UPDATE`;
      const message = await tx.commsChatMessage.findUnique({ where: { id: messageId } });
      if (
        !message
        || message.conversationId !== conversationId
        || (message.senderType !== MessageSenderType.CLIENT && message.senderType !== MessageSenderType.VISITOR)
      ) return;
      const state = readAdministrativeMessageState(message.metadata);
      if (state.assistantStatus !== 'QUEUED' && state.assistantStatus !== 'RETRYING') return;

      const response = await tx.commsChatMessage.findUnique({ where: { responseForMessageId: messageId } });
      if (response) return;
      const conversation = await tx.chatConversation.findUnique({
        where: { id: conversationId },
        select: { status: true, isAiChat: true, stateVersion: true, clientId: true },
      });
      if (!conversation?.isAiChat || conversation.status !== ConversationStatus.AI_ACTIVE) return;
      if (
        state.assistantStateVersion !== conversation.stateVersion
        || (state.assistantClientId ?? null) !== conversation.clientId
      ) {
        await tx.commsChatMessage.update({
          where: { id: messageId },
          data: { metadata: Prisma.JsonNull },
        });
        return;
      }

      const dispatchAttempt = readNonNegativeInteger(state.dispatchAttempt);
      if (dispatchAttempt >= MAX_DISPATCH_ATTEMPTS) {
        await tx.commsChatMessage.update({
          where: { id: messageId },
          data: { metadata: {
            assistantStatus: 'RETRYABLE_FAILURE',
            retryable: true,
            retryAttempts: readNonNegativeInteger(state.retryAttempts),
            dispatchAttempt,
            assistantStateVersion: conversation.stateVersion,
            assistantClientId: conversation.clientId,
          } },
        });
        return;
      }

      const nextAttempt = dispatchAttempt + 1;
      const manualRetry = state.assistantStatus === 'RETRYING';
      await tx.commsChatMessage.update({
        where: { id: messageId },
        data: { metadata: queuedAdministrativeMessageState({
          status: state.assistantStatus,
          dispatchAttempt: nextAttempt,
          assistantStateVersion: readNonNegativeInteger(state.assistantStateVersion),
          assistantClientId: typeof state.assistantClientId === 'string' ? state.assistantClientId : null,
          ...(manualRetry ? { retryAttempts: readNonNegativeInteger(state.retryAttempts) } : {}),
        }) },
      });
      await stageAdministrativeMessageProcessing(tx, {
        messageId,
        manualRetry,
        dispatchAttempt: nextAttempt,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
