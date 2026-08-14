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
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ACTIVE_BOOKING_STATUSES } from '../../../bookings/active-booking-statuses';
import { lockChatConversation } from '../conversation-lock.helper';
import { ChatAuditService } from '../chat-audit.service';
import { lockChatOperation } from './acknowledge-existing-booking.handler';
import { toOperationCardMetadata } from './chat-operation-public.mapper';
import {
  ChatBookingQuoteService,
  type PreparedBookingSummary,
} from './chat-booking-quote.service';

const RESUMED_OPERATION_TTL_MS = 15 * 60_000;

export interface ResumeChatOperationsCommand {
  conversationId: string;
  clientId: string;
}

type PreparedResume = {
  type: ChatOperationType;
  status: ChatOperationStatus;
  payload: object;
  summary: object;
  requiredConfirmations: number;
  resultBody?: string;
};

type ExistingBooking = {
  id: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMins: number;
  status: string;
  serviceNameSnapshot: string | null;
  employeeNameSnapshot: string | null;
  branchNameSnapshot: string | null;
  deliveryType: DeliveryType;
};

/**
 * Resumes safe guest intents only after ChatAccessService has atomically
 * claimed the conversation. A replacement operation preserves the original
 * AWAITING_AUTH payload byte-for-byte while the new operation contains a fresh
 * authenticated quote. Each source operation is row-locked and linked once.
 */
@Injectable()
export class ResumeChatOperationsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly quote: ChatBookingQuoteService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: ResumeChatOperationsCommand): Promise<ChatOperation[]> {
    const originals = await this.prisma.chatOperation.findMany({
      where: {
        conversationId: command.conversationId,
        resumedFromOperationId: null,
        OR: [
          { status: ChatOperationStatus.AWAITING_AUTH },
          { authResumedAt: { not: null } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const results: ChatOperation[] = [];
    for (const original of originals) {
      if (original.resumedOperationId) {
        const replacement = await this.prisma.chatOperation.findUnique({
          where: { id: original.resumedOperationId },
        });
        if (replacement) results.push(replacement);
        continue;
      }
      if (original.status !== ChatOperationStatus.AWAITING_AUTH) {
        results.push(original);
        continue;
      }
      results.push(await this.resumeOne(original.id, command));
    }
    return results;
  }

  private async resumeOne(
    operationId: string,
    command: ResumeChatOperationsCommand,
  ): Promise<ChatOperation> {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        await lockChatOperation(tx, operationId);
        const original = await tx.chatOperation.findUnique({ where: { id: operationId } });
        if (!original) throw new NotFoundException('Guest operation not found');
        const conversation = await tx.chatConversation.findFirst({
          where: { id: command.conversationId, clientId: command.clientId },
          select: { id: true, language: true },
        });
        if (!conversation || original.conversationId !== command.conversationId) {
          throw new ForbiddenException('Claimed conversation does not belong to this client');
        }
        if (original.resumedOperationId) {
          return tx.chatOperation.findUniqueOrThrow({
            where: { id: original.resumedOperationId },
          });
        }
        if (original.status !== ChatOperationStatus.AWAITING_AUTH) return original;

        const now = new Date();
        if (original.expiresAt <= now) {
          return tx.chatOperation.update({
            where: { id: original.id },
            data: {
              clientId: command.clientId,
              status: ChatOperationStatus.EXPIRED,
              authResumedAt: now,
              errorCode: 'AUTH_INTENT_EXPIRED',
              version: { increment: 1 },
            },
          });
        }

        const prepared = await this.prepareAuthenticated(tx, original, command.clientId);
        const replacement = await tx.chatOperation.create({
          data: {
            conversationId: original.conversationId,
            clientId: command.clientId,
            type: prepared.type,
            status: prepared.status,
            payload: prepared.payload as Prisma.InputJsonValue,
            summary: prepared.summary as Prisma.InputJsonValue,
            idempotencyKey: `${original.idempotencyKey}:claimed:${command.clientId}`,
            requiredConfirmations: prepared.requiredConfirmations,
            confirmationCount: 0,
            version: 0,
            expiresAt: new Date(now.getTime() + RESUMED_OPERATION_TTL_MS),
            resumedFromOperationId: original.id,
            ...(prepared.status === ChatOperationStatus.SUCCEEDED
              ? { executedAt: now }
              : {}),
          },
        });

        await lockChatConversation(tx, original.conversationId);
        const isImmediateResult = prepared.status === ChatOperationStatus.SUCCEEDED;
        const message = await tx.commsChatMessage.create({
          data: {
            conversationId: original.conversationId,
            senderType: MessageSenderType.SYSTEM,
            senderId: null,
            body: prepared.resultBody ?? this.cardBody(prepared.type, conversation.language),
            kind: isImmediateResult
              ? ChatMessageKind.OPERATION_RESULT
              : ChatMessageKind.ACTION_CARD,
            metadata: (isImmediateResult
              ? {
                  operationId: replacement.id,
                  type: replacement.type,
                  status: ChatOperationStatus.SUCCEEDED,
                  bookingId: null,
                  outcome: 'APPOINTMENTS_LISTED',
                }
              : toOperationCardMetadata(replacement)) as Prisma.InputJsonValue,
          },
        });
        const completedReplacement = isImmediateResult
          ? await tx.chatOperation.update({
              where: { id: replacement.id },
              data: { resultMessageId: message.id },
            })
          : replacement;

        if (isImmediateResult) {
          await this.audit.record({
            action: 'OPERATION_SUCCEEDED',
            conversationId: original.conversationId,
            operationId: completedReplacement.id,
          }, tx);
        }

        await tx.chatOperation.update({
          where: { id: original.id },
          data: {
            clientId: command.clientId,
            status: ChatOperationStatus.DECLINED,
            authResumedAt: now,
            authResumeMessageId: message.id,
            resumedOperationId: replacement.id,
            errorCode: 'RESUMED_AFTER_AUTH',
            version: { increment: 1 },
          },
        });
        await tx.chatConversation.update({
          where: { id: original.conversationId },
          data: {
            stateVersion: { increment: 1 },
            assistantLeaseOwner: null,
            assistantLeaseExpiresAt: null,
            lastMessageAt: now,
            clientUnreadCount: { increment: 1 },
          },
        });
        return completedReplacement;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!this.isTerminalResumeError(error)) throw error;
      return this.markFailed(operationId, command, this.publicErrorCode(error));
    }
  }

  private async prepareAuthenticated(
    tx: Prisma.TransactionClient,
    original: ChatOperation,
    clientId: string,
  ): Promise<PreparedResume> {
    const payload = this.record(original.payload);
    const request = this.record(payload.request);

    if (original.type === ChatOperationType.CREATE_BOOKING) {
      const proposed = await this.quote.quoteBooking({
        clientId,
        branchId: this.string(request, 'branchId'),
        employeeId: this.string(request, 'employeeId'),
        serviceId: this.string(request, 'serviceId'),
        scheduledAt: this.isoDate(request, 'scheduledAt'),
        ...(this.optionalString(request, 'durationOptionId')
          ? { durationOptionId: this.optionalString(request, 'durationOptionId')! }
          : {}),
        deliveryType: this.deliveryType(request, 'deliveryType'),
        transaction: tx,
      });
      const future = await tx.booking.findMany({
        where: {
          clientId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          isHistoricalImport: false,
          scheduledAt: { gt: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          scheduledAt: true,
          endsAt: true,
          durationMins: true,
          status: true,
          serviceNameSnapshot: true,
          employeeNameSnapshot: true,
          branchNameSnapshot: true,
          deliveryType: true,
        },
      }) as ExistingBooking[];
      const proposedStart = new Date(proposed.payload.scheduledAt);
      const proposedEnd = new Date(proposed.payload.endsAt);
      if (future.some((booking) => booking.scheduledAt < proposedEnd && booking.endsAt > proposedStart)) {
        throw new ConflictException('Client already has an overlapping appointment');
      }
      const existing = future[0];
      return {
        type: original.type,
        status: existing
          ? ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK
          : ChatOperationStatus.AWAITING_CONFIRMATION,
        payload: proposed.payload,
        summary: existing
          ? {
              action: 'CREATE_BOOKING',
              existingBooking: this.existingBookingSummary(existing),
              proposedBooking: proposed.summary,
            }
          : proposed.summary,
        requiredConfirmations: existing ? 2 : 1,
      };
    }

    if (original.type === ChatOperationType.RESCHEDULE_BOOKING) {
      const prepared = await this.quote.quoteReschedule({
        clientId,
        bookingId: this.string(request, 'bookingId'),
        newScheduledAt: this.isoDate(request, 'newScheduledAt'),
        transaction: tx,
      });
      return {
        type: original.type,
        status: ChatOperationStatus.AWAITING_CONFIRMATION,
        payload: prepared.payload,
        summary: prepared.summary,
        requiredConfirmations: 1,
      };
    }

    if (original.type === ChatOperationType.CANCEL_BOOKING) {
      const prepared = await this.quote.quoteCancellation({
        clientId,
        bookingId: this.string(request, 'bookingId'),
        transaction: tx,
      });
      return {
        type: original.type,
        status: ChatOperationStatus.AWAITING_CONFIRMATION,
        payload: prepared.payload,
        summary: prepared.summary,
        requiredConfirmations: 1,
      };
    }

    if (original.type === ChatOperationType.LIST_OWN_APPOINTMENTS) {
      const appointments = await tx.booking.findMany({
        where: { clientId, isHistoricalImport: false },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        select: { id: true, scheduledAt: true, status: true },
      });
      const lines = appointments.map((booking) =>
        `- ${booking.id} — ${booking.scheduledAt.toISOString()} — ${booking.status}`);
      return {
        type: original.type,
        status: ChatOperationStatus.SUCCEEDED,
        payload: { intent: 'LIST_OWN_APPOINTMENTS', request: {} },
        summary: { action: 'LIST_OWN_APPOINTMENTS', status: 'SUCCEEDED' },
        requiredConfirmations: 0,
        resultBody: lines.length > 0
          ? `مواعيدك:\n${lines.join('\n')}`
          : 'لا توجد مواعيد مسجلة حاليًا.',
      };
    }

    throw new BadRequestException('Guest operation type cannot be resumed');
  }

  private async markFailed(
    operationId: string,
    command: ResumeChatOperationsCommand,
    errorCode: string,
  ): Promise<ChatOperation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatOperation(tx, operationId);
      const original = await tx.chatOperation.findUnique({ where: { id: operationId } });
      if (!original) throw new NotFoundException('Guest operation not found');
      if (original.resumedOperationId) {
        return tx.chatOperation.findUniqueOrThrow({ where: { id: original.resumedOperationId } });
      }
      if (original.status !== ChatOperationStatus.AWAITING_AUTH) return original;
      const conversation = await tx.chatConversation.findFirst({
        where: { id: command.conversationId, clientId: command.clientId },
        select: { id: true },
      });
      if (!conversation) throw new ForbiddenException('Claimed conversation does not belong to this client');
      const now = new Date();
      await lockChatConversation(tx, original.conversationId);
      const message = await tx.commsChatMessage.create({
        data: {
          conversationId: original.conversationId,
          senderType: MessageSenderType.SYSTEM,
          senderId: null,
          body: 'تعذر استكمال الطلب بعد تسجيل الدخول. يمكنك إعداد الطلب من جديد.',
          kind: ChatMessageKind.OPERATION_RESULT,
          metadata: {
            operationId: original.id,
            type: original.type,
            status: ChatOperationStatus.FAILED,
            bookingId: null,
            outcome: 'OPERATION_FAILED',
          },
        },
      });
      const failed = await tx.chatOperation.update({
        where: { id: original.id },
        data: {
          clientId: command.clientId,
          status: ChatOperationStatus.FAILED,
          authResumedAt: now,
          authResumeMessageId: message.id,
          resultMessageId: message.id,
          errorCode,
          executedAt: now,
          version: { increment: 1 },
        },
      });
      await tx.chatConversation.update({
        where: { id: original.conversationId },
        data: {
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
          lastMessageAt: now,
          clientUnreadCount: { increment: 1 },
        },
      });
      await this.audit.record({
        action: 'OPERATION_FAILED',
        conversationId: original.conversationId,
        operationId: failed.id,
      }, tx);
      return failed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private existingBookingSummary(booking: ExistingBooking): PreparedBookingSummary | object {
    return {
      scheduledAt: booking.scheduledAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      durationMins: booking.durationMins,
      status: booking.status,
      serviceName: booking.serviceNameSnapshot ?? '',
      employeeName: booking.employeeNameSnapshot ?? '',
      branchName: booking.branchNameSnapshot ?? '',
      deliveryType: booking.deliveryType,
    };
  }

  private cardBody(type: ChatOperationType, language: string): string {
    const english = language.toLowerCase().startsWith('en');
    if (type === ChatOperationType.RESCHEDULE_BOOKING) {
      return english ? 'Review the reschedule details and confirm.' : 'راجع تفاصيل إعادة الجدولة ثم أكّد الطلب.';
    }
    if (type === ChatOperationType.CANCEL_BOOKING) {
      return english ? 'Review the cancellation details and confirm.' : 'راجع تفاصيل الإلغاء ثم أكّد الطلب.';
    }
    return english ? 'Review the booking details and confirm.' : 'راجع تفاصيل الحجز ثم أكّد الطلب.';
  }

  private publicErrorCode(error: unknown): string {
    if (error instanceof ForbiddenException) return 'OWNERSHIP_REVALIDATION_FAILED';
    if (error instanceof ConflictException) return 'BOOKING_CONFLICT';
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      return 'REQUEST_NO_LONGER_AVAILABLE';
    }
    return 'RESUME_FAILED';
  }

  private isTerminalResumeError(error: unknown): boolean {
    return error instanceof BadRequestException
      || error instanceof ConflictException
      || error instanceof ForbiddenException
      || error instanceof NotFoundException;
  }

  private record(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Guest operation payload is invalid');
    }
    return value as Record<string, Prisma.JsonValue>;
  }

  private string(value: Record<string, Prisma.JsonValue>, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 160) {
      throw new BadRequestException(`Guest operation ${key} is invalid`);
    }
    return candidate;
  }

  private optionalString(value: Record<string, Prisma.JsonValue>, key: string): string | null {
    const candidate = value[key];
    if (candidate === null || candidate === undefined) return null;
    return this.string(value, key);
  }

  private isoDate(value: Record<string, Prisma.JsonValue>, key: string): string {
    const date = new Date(this.string(value, key));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Guest operation ${key} is invalid`);
    return date.toISOString();
  }

  private deliveryType(value: Record<string, Prisma.JsonValue>, key: string): DeliveryType {
    const candidate = this.string(value, key);
    if (!Object.values(DeliveryType).includes(candidate as DeliveryType)) {
      throw new BadRequestException('Guest operation delivery type is invalid');
    }
    return candidate as DeliveryType;
  }
}
