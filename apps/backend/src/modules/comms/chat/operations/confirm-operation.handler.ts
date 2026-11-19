import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatMessageKind,
  ChatOperationStatus,
  MessageSenderType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { TransactionService } from '../../../../infrastructure/database';
import { CreateBookingHandler } from '../../../bookings/create-booking/create-booking.handler';
import { ClientRescheduleBookingHandler } from '../../../bookings/client/client-reschedule-booking.handler';
import { ClientCancelBookingHandler } from '../../../bookings/client/client-cancel-booking.handler';
import { hashToInt32 } from '../../../bookings/booking-lifecycle.helper';
import { RESCHEDULE_TX_ATTEMPTS } from '../../../bookings/reschedule-booking/reschedule-booking.handler';
import { retrySerializableTransaction } from '../../../../common/database/person-reference-lock.helper';
import { lockChatConversation } from '../conversation-lock.helper';
import { ChatAuditService } from '../chat-audit.service';
import { assertOperationOwnership, lockChatOperation } from './acknowledge-existing-booking.handler';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import {
  defaultMutationOutcome,
  operationResultBody,
  TERMINAL_STATUSES,
  toOperationErrorCode,
} from './confirm-operation.errors';
import { assertConversationOwnership } from './confirm-operation.guards';
import { executeOperationMutation } from './confirm-operation.mutations';
import type { ConfirmOperationCommand } from './confirm-operation.types';

export type { ConfirmOperationCommand } from './confirm-operation.types';

@Injectable()
export class ConfirmOperationHandler {
  constructor(
    private readonly rlsTransaction: TransactionService,
    private readonly quote: ChatBookingQuoteService,
    private readonly createBooking: CreateBookingHandler,
    private readonly rescheduleBooking: ClientRescheduleBookingHandler,
    _cancelBooking: ClientCancelBookingHandler,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: ConfirmOperationCommand): Promise<ChatOperation> {
    let executionStarted = false;

    try {
      // The mutation runs inside this caller-owned Serializable transaction,
      // so a conflict with a concurrent staff/client change aborts all of it
      // (the operation stays AWAITING_CONFIRMATION). Retry the whole
      // transaction rather than recording a transient conflict as FAILED.
      const completed = await retrySerializableTransaction(() => {
        executionStarted = false;
        return this.rlsTransaction.withTransaction(async (tx) => {
          await lockChatOperation(tx, command.operationId);
          const operation = await tx.chatOperation.findUnique({ where: { id: command.operationId } });
          if (!operation) throw new NotFoundException('Chat operation not found');
          assertOperationOwnership(operation, command.clientId);
          await assertConversationOwnership(tx, operation, command.clientId);

          if (TERMINAL_STATUSES.has(operation.status)) {
            if (operation.status === ChatOperationStatus.SUCCEEDED && !operation.resultMessageId) {
              const messageId = await this.writeResultMessage(tx, operation, {
                status: ChatOperationStatus.SUCCEEDED,
                bookingId: operation.bookingId,
                outcome: defaultMutationOutcome(operation.type),
              });
              return tx.chatOperation.update({
                where: { id: operation.id },
                data: { resultMessageId: messageId },
              });
            }
            return operation;
          }
          if (operation.expiresAt <= new Date()) {
            await tx.chatOperation.updateMany({
              where: { id: operation.id, version: operation.version, status: operation.status },
              data: { status: ChatOperationStatus.EXPIRED, version: { increment: 1 } },
            });
            return (await tx.chatOperation.findUnique({ where: { id: operation.id } }))!;
          }
          if (operation.status !== ChatOperationStatus.AWAITING_CONFIRMATION) {
            throw new BadRequestException('Operation is not awaiting confirmation');
          }
          if (operation.version !== command.expectedVersion) {
            throw new ConflictException('Operation version is stale');
          }
          if (operation.confirmationCount !== operation.requiredConfirmations - 1) {
            throw new BadRequestException('Required confirmation steps are incomplete');
          }

          // Operation row is already locked. Client lock is always next, before any booking resource.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32('client_booking')}::int, ${hashToInt32(command.clientId)}::int)`;
          const executing = await tx.chatOperation.updateMany({
            where: {
              id: operation.id,
              version: operation.version,
              status: ChatOperationStatus.AWAITING_CONFIRMATION,
            },
            data: {
              status: ChatOperationStatus.EXECUTING,
              confirmationCount: { increment: 1 },
              version: { increment: 1 },
              confirmedAt: new Date(),
            },
          });
          if (executing.count !== 1) throw new ConflictException('Operation changed concurrently');
          executionStarted = true;

          const mutation = await executeOperationMutation({
            quote: this.quote,
            createBooking: this.createBooking,
            rescheduleBooking: this.rescheduleBooking,
          }, tx, operation);
          await this.audit.record({
            action: 'OPERATION_CONFIRMED', conversationId: operation.conversationId, operationId: operation.id,
          }, tx);
          const messageId = await this.writeResultMessage(tx, operation, {
            status: ChatOperationStatus.SUCCEEDED,
            bookingId: mutation.bookingId,
            outcome: mutation.outcome,
            syncPending: mutation.syncPending,
          });
          const succeeded = await tx.chatOperation.update({
            where: { id: operation.id },
            data: {
              status: ChatOperationStatus.SUCCEEDED,
              bookingId: mutation.bookingId,
              executedAt: new Date(),
              resultMessageId: messageId,
              errorCode: null,
            },
          });
          await this.audit.record({
            action: 'OPERATION_SUCCEEDED', conversationId: operation.conversationId, operationId: operation.id,
          }, tx);
          return succeeded;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      }, RESCHEDULE_TX_ATTEMPTS);

      return completed;
    } catch (error) {
      if (!executionStarted) throw error;
      return this.markFailed(command, toOperationErrorCode(error));
    }
  }

  private async markFailed(
    command: ConfirmOperationCommand,
    errorCode: string,
  ): Promise<ChatOperation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatOperation(tx, command.operationId);
      const operation = await tx.chatOperation.findUnique({ where: { id: command.operationId } });
      if (!operation) throw new NotFoundException('Chat operation not found');
      assertOperationOwnership(operation, command.clientId);
      if (operation.status === ChatOperationStatus.SUCCEEDED || operation.status === ChatOperationStatus.FAILED) {
        return operation;
      }
      const messageId = await this.writeResultMessage(tx, operation, {
        status: ChatOperationStatus.FAILED,
        bookingId: null,
        outcome: errorCode === 'CANCELLATION_CONSENT_REQUIRED' ? errorCode : 'OPERATION_FAILED',
      });
      const failed = await tx.chatOperation.update({
        where: { id: operation.id },
        data: {
          status: ChatOperationStatus.FAILED,
          executedAt: new Date(),
          resultMessageId: messageId,
          errorCode,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        action: 'OPERATION_CONFIRMED', conversationId: operation.conversationId, operationId: operation.id,
      }, tx);
      await this.audit.record({
        action: 'OPERATION_FAILED', conversationId: operation.conversationId, operationId: operation.id,
      }, tx);
      return failed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async writeResultMessage(
    tx: Prisma.TransactionClient,
    operation: Pick<ChatOperation, 'id' | 'conversationId' | 'type'>,
    result: {
      status: ChatOperationStatus;
      bookingId: string | null;
      outcome: string;
      syncPending?: boolean;
    },
  ): Promise<string> {
    await lockChatConversation(tx, operation.conversationId);
    const message = await tx.commsChatMessage.create({
      data: {
        conversationId: operation.conversationId,
        senderType: MessageSenderType.SYSTEM,
        senderId: null,
        body: operationResultBody(result.status, result.outcome, result.syncPending === true),
        kind: ChatMessageKind.OPERATION_RESULT,
        metadata: {
          operationId: operation.id,
          type: operation.type,
          status: result.status,
          bookingId: result.bookingId,
          outcome: result.outcome,
          ...(result.syncPending ? { syncPending: true } : {}),
        },
      },
    });
    await tx.chatConversation.update({
      where: { id: operation.conversationId },
      data: {
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
        lastMessageAt: new Date(),
        clientUnreadCount: { increment: 1 },
      },
    });
    return message.id;
  }
}
