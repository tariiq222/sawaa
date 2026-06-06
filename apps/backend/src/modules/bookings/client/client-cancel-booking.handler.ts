import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CancellationReason, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { computeRefundType, computeRefundAmountHalalas } from '../cancellation-policy';
import { GroupSessionCapacityService } from '../group-session/group-session-capacity.service';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

export type ClientCancelCommand = ClientCancelBookingDto & {
  bookingId: string;
  clientId: string;
};

@Injectable()
export class ClientCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly eventBus: EventBusService,
    private readonly refundHandler: RefundPaymentHandler,
    private readonly groupSessionCapacity: GroupSessionCapacityService,
  ) {}

  async execute(cmd: ClientCancelCommand) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: cmd.bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    if (booking.clientId !== cmd.clientId) {
      throw new ForbiddenException('You do not own this booking');
    }

    const settings = await this.settingsHandler.execute({ branchId: booking.branchId });
    const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;

    if (settings.requireCancelApproval) {
      // CLIENT_REQUEST_CANCEL: PENDING | CONFIRMED | AWAITING_PAYMENT → CANCEL_REQUESTED
      const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');
      const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancel requested',
          data: {
            status: nextStatus,
            cancelNotes: cmd.reason ?? null,
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.clientId,
            reason: cmd.reason ?? 'CLIENT_CANCEL_REQUIRES_APPROVAL',
          },
        }),
      ]));
      return { status: 'CANCEL_REQUESTED', booking: updated, requiresApproval: true };
    }

    if (hoursUntilBooking < settings.freeCancelBeforeHours) {
      // Outside free-cancel window: escalate to CANCEL_REQUESTED for staff review
      const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');
      const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancel requested',
          data: {
            status: nextStatus,
            cancelNotes: cmd.reason ?? null,
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.clientId,
            reason: cmd.reason ?? 'CLIENT_CANCEL_WINDOW_EXPIRED',
          },
        }),
      ]));
      return { status: 'CANCEL_REQUESTED', booking: updated, requiresApproval: true };
    }

    // Within free-cancel window: direct cancel (CLIENT_DIRECT_CANCEL)
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

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
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
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: directCancelStatus,
          changedBy: cmd.clientId,
          reason: cmd.reason ?? 'CLIENT_CANCEL',
        },
      });
      if (refundType !== RefundType.NONE) {
        const completedPayment = await tx.payment.findFirst({
          where: { invoice: { bookingId: cmd.bookingId }, status: 'COMPLETED' },
          select: { id: true, amount: true },
        });
        if (completedPayment) {
          // Honour the configured refund percent. FULL → whole paid amount
          // (amount left undefined); PARTIAL → exact integer-halala
          // round(paidAmount * percent / 100) — never a fractional halala.
          const paidHalalas = Number(completedPayment.amount);
          const refundAmount =
            refundType === RefundType.FULL
              ? undefined
              : computeRefundAmountHalalas(paidHalalas, refundPercent);
          if (refundAmount === undefined || refundAmount > 0) {
            const created = await this.refundHandler.createRefundRequestInTx(
              tx,
              {
                paymentId: completedPayment.id,
                reason: `Booking ${cmd.bookingId} cancellation (${refundType})`,
                performedBy: cmd.clientId,
                amount: refundAmount,
              },
            );
            paymentId = completedPayment.id;
            refundRequestId = created.refundRequestId;
            idempotencyKey = created.idempotencyKey;
          }
        }
      }
      // Roll back sibling AWAITING_PAYMENT bookings for group sessions
      // when the cancellation drops the enrolled count below the threshold.
      if (booking.groupSessionId) {
        await this.groupSessionCapacity.recalculateGroupStatus(tx, booking.groupSessionId);
      }
      return cancelled;
    });

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
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { status: 'CANCELLED', booking: updated, requiresApproval: false };
  }
}
