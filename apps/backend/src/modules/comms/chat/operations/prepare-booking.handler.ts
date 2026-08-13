import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  ChatOperationStatus,
  ChatOperationType,
  type DeliveryType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ACTIVE_BOOKING_STATUSES } from '../../../bookings/active-booking-statuses';
import {
  ChatBookingQuoteService,
  type PreparedBookingSummary,
} from './chat-booking-quote.service';

const OPERATION_TTL_MS = 15 * 60_000;

export interface PrepareBookingCommand {
  conversationId: string;
  clientId: string | null;
  sourceMessageId: string;
  branchId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: string;
  durationOptionId?: string;
  deliveryType: DeliveryType;
}

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

@Injectable()
export class PrepareBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly quote: ChatBookingQuoteService,
  ) {}

  async execute(command: PrepareBookingCommand): Promise<ChatOperation> {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: command.conversationId },
      select: { id: true, clientId: true, language: true },
    });
    if (!conversation || conversation.clientId !== command.clientId) {
      throw new ForbiddenException('Conversation does not belong to this client');
    }

    const expiresAt = new Date(Date.now() + OPERATION_TTL_MS);
    const idempotencyKey = this.idempotencyKey(command);

    if (!command.clientId) {
      const scheduledAt = new Date(command.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Booking time is invalid');
      }
      return this.createOrGet({
        conversationId: command.conversationId,
        clientId: null,
        type: ChatOperationType.CREATE_BOOKING,
        status: ChatOperationStatus.AWAITING_AUTH,
        payload: {
          intent: 'CREATE_BOOKING',
          request: {
            branchId: command.branchId,
            employeeId: command.employeeId,
            serviceId: command.serviceId,
            scheduledAt: scheduledAt.toISOString(),
            durationOptionId: command.durationOptionId ?? null,
            deliveryType: command.deliveryType,
          },
        },
        summary: {
          action: 'LOGIN_REQUIRED',
          intent: 'CREATE_BOOKING',
          scheduledAt: scheduledAt.toISOString(),
          deliveryType: command.deliveryType,
        },
        idempotencyKey,
        requiredConfirmations: 0,
        expiresAt,
      });
    }

    const proposed = await this.quote.quoteBooking({
      clientId: command.clientId,
      branchId: command.branchId,
      employeeId: command.employeeId,
      serviceId: command.serviceId,
      scheduledAt: command.scheduledAt,
      ...(command.durationOptionId ? { durationOptionId: command.durationOptionId } : {}),
      deliveryType: command.deliveryType,
    });

    const now = new Date();
    const futureBookings = await this.prisma.booking.findMany({
      where: {
        clientId: command.clientId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        isHistoricalImport: false,
        scheduledAt: { gt: now },
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
    if (futureBookings.some((booking) => booking.scheduledAt < proposedEnd && booking.endsAt > proposedStart)) {
      throw new ConflictException('Client already has an overlapping appointment');
    }

    const existing = futureBookings[0];
    const status = existing
      ? ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK
      : ChatOperationStatus.AWAITING_CONFIRMATION;
    const summary = existing
      ? {
          action: 'CREATE_BOOKING',
          existingBooking: this.existingBookingSummary(existing),
          proposedBooking: proposed.summary,
        }
      : proposed.summary;

    return this.createOrGet({
      conversationId: command.conversationId,
      clientId: command.clientId,
      type: ChatOperationType.CREATE_BOOKING,
      status,
      payload: proposed.payload,
      summary,
      idempotencyKey,
      requiredConfirmations: existing ? 2 : 1,
      expiresAt,
    });
  }

  private existingBookingSummary(booking: ExistingBooking) {
    return {
      id: booking.id,
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

  private idempotencyKey(command: PrepareBookingCommand): string {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({
        branchId: command.branchId,
        employeeId: command.employeeId,
        serviceId: command.serviceId,
        scheduledAt: command.scheduledAt,
        durationOptionId: command.durationOptionId ?? null,
        deliveryType: command.deliveryType,
      }))
      .digest('hex');
    return `chat:${command.sourceMessageId}:prepareBooking:${fingerprint}`;
  }

  private async createOrGet(data: {
    conversationId: string;
    clientId: string | null;
    type: ChatOperationType;
    status: ChatOperationStatus;
    payload: object;
    summary: PreparedBookingSummary | object;
    idempotencyKey: string;
    requiredConfirmations: number;
    expiresAt: Date;
  }): Promise<ChatOperation> {
    try {
      return await this.rlsTransaction.withTransaction(async (tx) => {
        const existing = await tx.chatOperation.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return existing;
        return tx.chatOperation.create({
          data: {
            ...data,
            payload: data.payload as Prisma.InputJsonValue,
            summary: data.summary as Prisma.InputJsonValue,
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const existing = await this.prisma.chatOperation.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (!existing) throw error;
      return existing;
    }
  }
}
