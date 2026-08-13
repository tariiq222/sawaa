import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  DeliveryType,
  MessageSenderType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { CreateBookingHandler } from '../../../bookings/create-booking/create-booking.handler';
import { ClientRescheduleBookingHandler } from '../../../bookings/client/client-reschedule-booking.handler';
import { ClientCancelBookingHandler } from '../../../bookings/client/client-cancel-booking.handler';
import { hashToInt32 } from '../../../bookings/booking-lifecycle.helper';
import { ACTIVE_BOOKING_STATUSES } from '../../../bookings/active-booking-statuses';
import { lockChatConversation } from '../conversation-lock.helper';
import { assertOperationOwnership, lockChatOperation } from './acknowledge-existing-booking.handler';
import {
  ChatBookingQuoteService,
  type PreparedBookingPayload,
  type PreparedCancellationPayload,
  type PreparedReschedulePayload,
} from './chat-booking-quote.service';

export interface ConfirmOperationCommand {
  operationId: string;
  clientId: string;
  expectedVersion: number;
}

type MutationResult = {
  bookingId: string;
  outcome: 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED' | 'CANCELLATION_REQUESTED';
  postCommit?: () => Promise<void>;
};

class OperationExecutionError extends Error {
  constructor(readonly publicCode: string, message: string) {
    super(message);
  }
}

const TERMINAL_STATUSES = new Set<ChatOperationStatus>([
  ChatOperationStatus.SUCCEEDED,
  ChatOperationStatus.FAILED,
  ChatOperationStatus.DECLINED,
  ChatOperationStatus.EXPIRED,
]);

@Injectable()
export class ConfirmOperationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly quote: ChatBookingQuoteService,
    private readonly createBooking: CreateBookingHandler,
    private readonly rescheduleBooking: ClientRescheduleBookingHandler,
    private readonly cancelBooking: ClientCancelBookingHandler,
  ) {}

  async execute(command: ConfirmOperationCommand): Promise<ChatOperation> {
    let executionStarted = false;
    let postCommit: (() => Promise<void>) | undefined;

    try {
      const completed = await this.rlsTransaction.withTransaction(async (tx) => {
        await lockChatOperation(tx, command.operationId);
        const operation = await tx.chatOperation.findUnique({ where: { id: command.operationId } });
        if (!operation) throw new NotFoundException('Chat operation not found');
        assertOperationOwnership(operation, command.clientId);
        await this.assertConversationOwnership(tx, operation, command.clientId);

        if (TERMINAL_STATUSES.has(operation.status)) {
          if (operation.status === ChatOperationStatus.SUCCEEDED && !operation.resultMessageId) {
            const messageId = await this.writeResultMessage(tx, operation, {
              status: ChatOperationStatus.SUCCEEDED,
              bookingId: operation.bookingId,
              outcome: this.defaultOutcome(operation.type),
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

        const mutation = await this.executeMutation(tx, operation);
        postCommit = mutation.postCommit;
        const messageId = await this.writeResultMessage(tx, operation, {
          status: ChatOperationStatus.SUCCEEDED,
          bookingId: mutation.bookingId,
          outcome: mutation.outcome,
        });
        return tx.chatOperation.update({
          where: { id: operation.id },
          data: {
            status: ChatOperationStatus.SUCCEEDED,
            bookingId: mutation.bookingId,
            executedAt: new Date(),
            resultMessageId: messageId,
            errorCode: null,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (postCommit) await postCommit().catch(() => {});
      return completed;
    } catch (error) {
      if (!executionStarted) throw error;
      return this.markFailed(command, this.errorCode(error));
    }
  }

  private async executeMutation(
    tx: Prisma.TransactionClient,
    operation: ChatOperation,
  ): Promise<MutationResult> {
    const payload = this.record(operation.payload);
    const clientId = operation.clientId!;

    if (operation.type === ChatOperationType.CREATE_BOOKING) {
      const creationIdempotencyKey = `chat-operation:${operation.id}`;
      const recovered = await tx.booking.findUnique({
        where: { creationIdempotencyKey },
      });
      if (recovered) {
        this.assertRecoveredCreation(payload, clientId, recovered);
        return { bookingId: recovered.id, outcome: 'BOOKING_CREATED' };
      }
      if (operation.requiredConfirmations === 1) {
        const futureBooking = await tx.booking.findFirst({
          where: {
            clientId,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            isHistoricalImport: false,
            scheduledAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (futureBooking) {
          throw new OperationExecutionError(
            'EXISTING_BOOKING_CHANGED',
            'A future appointment now requires an additional-booking acknowledgement',
          );
        }
      }
      const input = {
        clientId,
        branchId: this.string(payload, 'branchId'),
        employeeId: this.string(payload, 'employeeId'),
        serviceId: this.string(payload, 'serviceId'),
        scheduledAt: this.string(payload, 'scheduledAt'),
        durationOptionId: this.optionalString(payload, 'durationOptionId') ?? undefined,
        deliveryType: this.deliveryType(payload, 'deliveryType'),
        transaction: tx,
      };
      const fresh = await this.quote.quoteBooking(input);
      this.assertUnchanged(operation.payload, fresh.payload);
      const trusted = fresh.payload as PreparedBookingPayload;
      const booking = await this.createBooking.execute({
        branchId: trusted.branchId,
        clientId,
        employeeId: trusted.employeeId,
        serviceId: trusted.serviceId,
        scheduledAt: new Date(trusted.scheduledAt),
        ...(trusted.durationOptionId ? { durationOptionId: trusted.durationOptionId } : {}),
        bookingType: trusted.bookingType,
        deliveryType: trusted.deliveryType,
        currency: trusted.currency,
        source: 'AI_CHAT',
        creationIdempotencyKey,
        transaction: tx,
      });
      return { bookingId: booking.id, outcome: 'BOOKING_CREATED' };
    }

    if (operation.type === ChatOperationType.RESCHEDULE_BOOKING) {
      const bookingId = this.string(payload, 'bookingId');
      const newScheduledAt = this.string(payload, 'newScheduledAt');
      const recovered = await tx.bookingStatusLog.findUnique({
        where: { sourceActionId: operation.id },
        select: { id: true },
      });
      if (recovered) {
        const result = await this.rescheduleBooking.execute({
          bookingId,
          clientId,
          newScheduledAt,
          sourceActionId: operation.id,
          transaction: tx,
        });
        return {
          bookingId: result.booking.id,
          outcome: 'BOOKING_RESCHEDULED',
          postCommit: result.postCommit,
        };
      }
      const fresh = await this.quote.quoteReschedule({
        clientId, bookingId, newScheduledAt, transaction: tx,
      });
      this.assertUnchanged(operation.payload, fresh.payload as PreparedReschedulePayload);
      const result = await this.rescheduleBooking.execute({
        bookingId,
        clientId,
        newScheduledAt,
        sourceActionId: operation.id,
        transaction: tx,
      });
      return {
        bookingId: result.booking.id,
        outcome: 'BOOKING_RESCHEDULED',
        postCommit: result.postCommit,
      };
    }

    if (operation.type === ChatOperationType.CANCEL_BOOKING) {
      const bookingId = this.string(payload, 'bookingId');
      const recovered = await tx.bookingStatusLog.findUnique({
        where: { sourceActionId: operation.id },
        select: { id: true },
      });
      if (recovered) {
        const result = await this.cancelBooking.execute({
          bookingId,
          clientId,
          sourceActionId: operation.id,
          transaction: tx,
        });
        return {
          bookingId: result.booking.id,
          outcome: result.status === 'CANCEL_REQUESTED'
            ? 'CANCELLATION_REQUESTED'
            : 'BOOKING_CANCELLED',
          postCommit: result.postCommit,
        };
      }
      const fresh = await this.quote.quoteCancellation({ clientId, bookingId, transaction: tx });
      this.assertUnchanged(operation.payload, fresh.payload as PreparedCancellationPayload);
      const result = await this.cancelBooking.execute({
        bookingId,
        clientId,
        sourceActionId: operation.id,
        transaction: tx,
      });
      return {
        bookingId: result.booking.id,
        outcome: result.status === 'CANCEL_REQUESTED'
          ? 'CANCELLATION_REQUESTED'
          : 'BOOKING_CANCELLED',
        postCommit: result.postCommit,
      };
    }

    throw new OperationExecutionError('UNSUPPORTED_OPERATION', 'Operation cannot be confirmed');
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
        outcome: 'OPERATION_FAILED',
      });
      return tx.chatOperation.update({
        where: { id: operation.id },
        data: {
          status: ChatOperationStatus.FAILED,
          executedAt: new Date(),
          resultMessageId: messageId,
          errorCode,
          version: { increment: 1 },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async writeResultMessage(
    tx: Prisma.TransactionClient,
    operation: Pick<ChatOperation, 'id' | 'conversationId' | 'type'>,
    result: {
      status: ChatOperationStatus;
      bookingId: string | null;
      outcome: string;
    },
  ): Promise<string> {
    await lockChatConversation(tx, operation.conversationId);
    const message = await tx.commsChatMessage.create({
      data: {
        conversationId: operation.conversationId,
        senderType: MessageSenderType.SYSTEM,
        senderId: null,
        body: this.resultBody(result.status, result.outcome),
        kind: ChatMessageKind.OPERATION_RESULT,
        metadata: {
          operationId: operation.id,
          type: operation.type,
          status: result.status,
          bookingId: result.bookingId,
          outcome: result.outcome,
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

  private async assertConversationOwnership(
    tx: Prisma.TransactionClient,
    operation: Pick<ChatOperation, 'conversationId'>,
    clientId: string,
  ): Promise<void> {
    const conversation = await tx.chatConversation.findFirst({
      where: { id: operation.conversationId, clientId },
      select: { id: true },
    });
    if (!conversation) throw new ForbiddenException('Conversation does not belong to this client');
  }

  private assertUnchanged(stored: Prisma.JsonValue, fresh: object): void {
    if (!isDeepStrictEqual(stored, fresh)) {
      throw new OperationExecutionError('QUOTE_CHANGED', 'Prepared appointment details changed');
    }
  }

  private assertRecoveredCreation(
    payload: Record<string, Prisma.JsonValue>,
    clientId: string,
    booking: {
      clientId: string;
      branchId: string;
      employeeId: string;
      serviceId: string | null;
      scheduledAt: Date;
      endsAt: Date;
      durationMins: number;
      durationOptionId: string | null;
      bookingType: string;
      deliveryType: string;
      price: Prisma.Decimal;
      currency: string;
      source: string;
    },
  ): void {
    const matches = booking.clientId === clientId
      && booking.branchId === this.string(payload, 'branchId')
      && booking.employeeId === this.string(payload, 'employeeId')
      && booking.serviceId === this.string(payload, 'serviceId')
      && booking.scheduledAt.toISOString() === new Date(this.string(payload, 'scheduledAt')).toISOString()
      && booking.endsAt.toISOString() === new Date(this.string(payload, 'endsAt')).toISOString()
      && booking.durationMins === this.number(payload, 'durationMins')
      && booking.durationOptionId === this.optionalString(payload, 'durationOptionId')
      && booking.bookingType === this.string(payload, 'bookingType')
      && booking.deliveryType === this.deliveryType(payload, 'deliveryType')
      && Number(booking.price) === this.number(payload, 'price')
      && booking.currency === this.string(payload, 'currency')
      && booking.source === 'AI_CHAT';
    if (!matches) {
      throw new OperationExecutionError(
        'IDEMPOTENCY_CONFLICT',
        'Durable creation key belongs to a different booking',
      );
    }
  }

  private record(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new OperationExecutionError('INVALID_PAYLOAD', 'Operation payload is invalid');
    }
    return value as Record<string, Prisma.JsonValue>;
  }

  private string(payload: Record<string, Prisma.JsonValue>, key: string): string {
    const value = payload[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
    }
    return value;
  }

  private optionalString(payload: Record<string, Prisma.JsonValue>, key: string): string | null {
    const value = payload[key];
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || value.length === 0) {
      throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
    }
    return value;
  }

  private number(payload: Record<string, Prisma.JsonValue>, key: string): number {
    const value = payload[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
    }
    return value;
  }

  private deliveryType(payload: Record<string, Prisma.JsonValue>, key: string): DeliveryType {
    const value = this.string(payload, key);
    if (!Object.values(DeliveryType).includes(value as DeliveryType)) {
      throw new OperationExecutionError('INVALID_PAYLOAD', 'Operation delivery type is invalid');
    }
    return value as DeliveryType;
  }

  private errorCode(error: unknown): string {
    if (error instanceof OperationExecutionError) return error.publicCode;
    if (error instanceof ConflictException) return 'BOOKING_CONFLICT';
    if (error instanceof BadRequestException) return 'VALIDATION_FAILED';
    return 'EXECUTION_FAILED';
  }

  private defaultOutcome(type: ChatOperationType): MutationResult['outcome'] {
    if (type === ChatOperationType.RESCHEDULE_BOOKING) return 'BOOKING_RESCHEDULED';
    if (type === ChatOperationType.CANCEL_BOOKING) return 'BOOKING_CANCELLED';
    return 'BOOKING_CREATED';
  }

  private resultBody(status: ChatOperationStatus, outcome: string): string {
    if (status === ChatOperationStatus.FAILED) return 'تعذر تنفيذ الإجراء. يمكنك إعداد الطلب من جديد.';
    if (outcome === 'BOOKING_RESCHEDULED') return 'تمت إعادة جدولة الموعد بنجاح.';
    if (outcome === 'BOOKING_CANCELLED') return 'تم إلغاء الموعد بنجاح.';
    if (outcome === 'CANCELLATION_REQUESTED') return 'تم تسجيل طلب إلغاء الموعد للمراجعة.';
    return 'تم تأكيد الحجز بنجاح.';
  }
}
