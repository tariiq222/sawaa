import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingType,
  CancellationReason,
  Prisma,
  RefundType,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { stableEventId } from '../../../common/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { computeRefundAmountHalalas, computeRefundType } from '../cancellation-policy';
import { ProgramCapacityService } from '../program/program-capacity.service';
import {
  assertBookingIsMutable,
  hashToInt32,
  updateBookingAtomically,
} from '../booking-lifecycle.helper';
import { returnPackageCreditForBooking } from '../package-credit-return.helper';

export type ClientCancelCommand = ClientCancelBookingDto & {
  bookingId: string;
  clientId: string;
  sourceActionId?: string;
  transaction?: Prisma.TransactionClient;
};

type CancelResult = {
  status: 'CANCELLED' | 'CANCEL_REQUESTED';
  booking: Awaited<ReturnType<typeof updateBookingAtomically>>;
  requiresApproval: boolean;
};

@Injectable()
export class ClientCancelBookingHandler {
  constructor(
    _prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    _eventBus: EventBusService,
    private readonly refundHandler: RefundPaymentHandler,
    private readonly programCapacity: ProgramCapacityService,
  ) {}

  async execute(cmd: ClientCancelCommand): Promise<CancelResult> {
    const actionHash = this.actionHash(cmd);
    const cancellationEventId = cmd.sourceActionId
      ? stableEventId(`booking:${cmd.bookingId}:client-cancel:${cmd.sourceActionId}`)
      : randomUUID();
    const mutate = async (tx: Prisma.TransactionClient): Promise<CancelResult> => {
      // Cancellation needs no employee-slot lock. The client lock precedes the booking mutation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32('client_booking')}::int, ${hashToInt32(cmd.clientId)}::int)`;
      const booking = await tx.booking.findUnique({ where: { id: cmd.bookingId } });
      if (!booking) throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
      if (booking.clientId !== cmd.clientId) throw new ForbiddenException('You do not own this booking');
      assertBookingIsMutable(booking);

      if (cmd.sourceActionId) {
        const previous = await tx.bookingStatusLog.findUnique({
          where: { sourceActionId: cmd.sourceActionId },
        });
        if (previous) {
          if (previous.sourceActionHash !== actionHash || previous.bookingId !== cmd.bookingId) {
            throw new ConflictException('Action id was already used with different cancellation data');
          }
          const stored = previous.sourceActionResult as Record<string, unknown> | null;
          const status = stored?.status;
          if (status !== 'CANCELLED' && status !== 'CANCEL_REQUESTED') {
            throw new ConflictException('Stored cancellation result is invalid');
          }
          return {
            status,
            booking,
            requiresApproval: stored?.requiresApproval === true,
          };
        }
      }

      if (booking.bookingType === BookingType.GROUP) {
        throw new ForbiddenException('Program enrollments can only be cancelled by staff');
      }
      const settings = await this.settingsHandler.execute({
        branchId: booking.branchId,
        transaction: tx,
      });
      const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;

      if (settings.requireCancelApproval || hoursUntilBooking < settings.freeCancelBeforeHours) {
        const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');
        const updated = await updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancel requested',
          data: { status: nextStatus, cancelNotes: cmd.reason ?? null },
          ...(booking.deliveryType === 'ONLINE' ? {
            extraWhere: {
              AND: [
                { OR: [
                  { zoomCreateLeaseOwner: null },
                  { zoomCreateLeaseExpiresAt: null },
                  { zoomCreateLeaseExpiresAt: { lt: new Date() } },
                ] },
                { OR: [
                  { zoomSyncLeaseOwner: null },
                  { zoomSyncLeaseExpiresAt: null },
                  { zoomSyncLeaseExpiresAt: { lt: new Date() } },
                ] },
              ],
            },
          } : {}),
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.clientId,
            reason: cmd.reason ?? (
              settings.requireCancelApproval
                ? 'CLIENT_CANCEL_REQUIRES_APPROVAL'
                : 'CLIENT_CANCEL_WINDOW_EXPIRED'
            ),
            sourceActionId: cmd.sourceActionId,
            sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
            sourceActionResult: cmd.sourceActionId
              ? {
                  kind: 'CANCELLATION', bookingId: cmd.bookingId,
                  status: 'CANCEL_REQUESTED', requiresApproval: true,
                }
              : undefined,
          },
        });
        return { status: 'CANCEL_REQUESTED', booking: updated, requiresApproval: true };
      }

      const directCancelStatus = assertTransition(booking.status, 'CLIENT_DIRECT_CANCEL');
      const { refundType, refundPercent } = computeRefundType({
        scheduledAt: booking.scheduledAt,
        freeCancelBeforeHours: settings.freeCancelBeforeHours,
        freeCancelRefundType: settings.freeCancelRefundType,
        lateCancelRefundPercent: settings.lateCancelRefundPercent,
      });
      let refundRequestId: string | null = null;
      let paymentId: string | null = null;
      let idempotencyKey: string | null = null;

      const cancelled = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancelled',
        data: {
          status: directCancelStatus,
          cancelReason: 'CLIENT_REQUESTED',
          cancelNotes: cmd.reason ?? null,
          cancelledAt: new Date(),
        },
        ...(booking.deliveryType === 'ONLINE' ? {
          extraWhere: {
            AND: [
              { OR: [
                { zoomCreateLeaseOwner: null },
                { zoomCreateLeaseExpiresAt: null },
                { zoomCreateLeaseExpiresAt: { lt: new Date() } },
              ] },
              { OR: [
                { zoomSyncLeaseOwner: null },
                { zoomSyncLeaseExpiresAt: null },
                { zoomSyncLeaseExpiresAt: { lt: new Date() } },
              ] },
            ],
          },
        } : {}),
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: directCancelStatus,
          changedBy: cmd.clientId,
          reason: cmd.reason ?? 'CLIENT_CANCEL',
          sourceActionId: cmd.sourceActionId,
          sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
          sourceActionResult: cmd.sourceActionId
            ? {
                kind: 'CANCELLATION', bookingId: cmd.bookingId,
                status: 'CANCELLED', requiresApproval: false,
              }
            : undefined,
        },
      });

      if (refundType !== RefundType.NONE) {
        const completedPayment = await tx.payment.findFirst({
          where: { invoice: { bookingId: cmd.bookingId }, status: 'COMPLETED' },
          select: { id: true, amount: true },
        });
        if (completedPayment) {
          const paidHalalas = Number(completedPayment.amount);
          const refundAmount = refundType === RefundType.FULL
            ? undefined
            : computeRefundAmountHalalas(paidHalalas, refundPercent);
          if (refundAmount === undefined || refundAmount > 0) {
            const created = await this.refundHandler.createRefundRequestInTx(tx, {
              paymentId: completedPayment.id,
              reason: `Booking ${cmd.bookingId} cancellation (${refundType})`,
              performedBy: cmd.clientId,
              amount: refundAmount,
              sourceEventId: cancellationEventId,
            });
            paymentId = completedPayment.id;
            refundRequestId = created.refundRequestId;
            idempotencyKey = created.idempotencyKey;
          }
        }
      }
      if (booking.packageCreditId) await returnPackageCreditForBooking(tx, cmd.bookingId);
      if (booking.programId) {
        await tx.programEnrollment.deleteMany({ where: { bookingId: cmd.bookingId } });
        await this.programCapacity.decrementEnrollment(tx, booking.programId);
      }

      const event = new BookingCancelledEvent({
        organizationId: DEFAULT_ORG_ID,
        scheduledAt: booking.scheduledAt,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        reason: CancellationReason.CLIENT_REQUESTED,
        cancelNotes: cmd.reason ?? undefined,
        refundType,
        paymentId,
        refundRequestId,
        idempotencyKey,
      }, cancellationEventId);
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: booking.id,
          eventType: event.eventName,
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
      return { status: 'CANCELLED', booking: cancelled, requiresApproval: false };
    };

    const result = cmd.transaction
      ? await mutate(cmd.transaction)
      : await this.rlsTransaction.withTransaction(mutate, { isolationLevel: 'Serializable' });
    return cmd.transaction ? result : {
      status: result.status,
      booking: result.booking,
      requiresApproval: result.requiresApproval,
    };
  }

  private actionHash(cmd: ClientCancelCommand): string {
    return createHash('sha256')
      .update(JSON.stringify({
        action: 'CLIENT_CANCELLATION',
        bookingId: cmd.bookingId,
        clientId: cmd.clientId,
        reason: cmd.reason ?? null,
      }))
      .digest('hex');
  }
}
