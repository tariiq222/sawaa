import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { BookingCancelApprovedEvent } from '../events/booking-cancel-approved.event';
import { assertTransition } from '../booking-state-machine';
import { GroupSessionCapacityService } from '../group-session/group-session-capacity.service';
import { updateBookingAtomically } from '../booking-lifecycle.helper';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';

export interface ApproveCancelBookingCommand {
  bookingId: string;
  approvedBy: string;
  approverNotes?: string;
  /** Refund decision — determines whether a RefundRequest is created atomically with the cancellation. */
  refundType?: RefundType;
  /** Refund amount in halalas — required iff refundType is PARTIAL. */
  refundAmount?: number;
}

@Injectable()
export class ApproveCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupSessionCapacity: GroupSessionCapacityService,
    private readonly refundHandler: RefundPaymentHandler,
  ) {}

  async execute(cmd: ApproveCancelBookingCommand) {
    if (cmd.refundType === RefundType.PARTIAL && cmd.refundAmount === undefined) {
      throw new BadRequestException('refundAmount is required when refundType is PARTIAL');
    }
    if (cmd.refundType !== RefundType.PARTIAL && cmd.refundAmount !== undefined) {
      throw new BadRequestException('refundAmount is only allowed when refundType is PARTIAL');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    const nextStatus = assertTransition(booking.status, 'APPROVE_CANCEL');

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    const autoRefund =
      'autoRefundOnCancel' in settings
        ? (settings as Record<string, unknown>).autoRefundOnCancel === true
        : true;

    // Look up completed payment BEFORE the transaction (read-only — no race
    // risk here; the FOR UPDATE lock inside createRefundRequestInTx guards
    // against concurrent refunds on the same payment).
    const completedPayment = await this.prisma.payment.findFirst({
      where: { invoice: { bookingId: cmd.bookingId }, status: 'COMPLETED' },
      select: { id: true, amount: true },
    });

    const refundSummary = cmd.refundType
      ? ` — refund: ${cmd.refundType}${cmd.refundType === RefundType.PARTIAL ? ` ${cmd.refundAmount} halalas` : ''}`
      : '';
    const statusLogReason = `Cancel request approved${refundSummary}${cmd.approverNotes ? ` — ${cmd.approverNotes}` : ''}`;

    let refundRequestId: string | null = null;
    let idempotencyKey: string | null = null;

    const [updated] = await this.rlsTransaction.withTransaction(async (tx) => {
      const results = await Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancelled',
          data: {
            status: nextStatus,
            cancelledAt: new Date(),
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.approvedBy,
            reason: statusLogReason,
          },
        }),
      ]);

      // MONEY SAFETY: create the RefundRequest atomically with the status
      // change so a crash between commit and publish cannot lose the refund.
      // The same createRefundRequestInTx path used by cancel-booking.handler
      // ensures FOR UPDATE lock, idempotency, and accounting are all correct.
      if (completedPayment) {
        const effectiveRefundType = cmd.refundType ?? (autoRefund ? RefundType.FULL : RefundType.NONE);
        if (effectiveRefundType !== RefundType.NONE) {
          const refundAmount =
            effectiveRefundType === RefundType.PARTIAL ? cmd.refundAmount : undefined;
          const created = await this.refundHandler.createRefundRequestInTx(tx, {
            paymentId: completedPayment.id,
            reason: `Booking ${cmd.bookingId} cancel-approval (${effectiveRefundType})`,
            performedBy: cmd.approvedBy,
            amount: refundAmount,
          });
          refundRequestId = created.refundRequestId;
          idempotencyKey = created.idempotencyKey;
        }
      }

      // Roll back sibling AWAITING_PAYMENT bookings for group sessions.
      if (booking.groupSessionId) {
        // Remove the GroupEnrollment row so the client can re-enroll after
        // their seat is freed.
        await tx.groupEnrollment.deleteMany({ where: { bookingId: cmd.bookingId } });
        await this.groupSessionCapacity.recalculateGroupStatus(tx, booking.groupSessionId);
      }
      return results;
    });

    const event = new BookingCancelApprovedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      autoRefund,
      approverNotes: cmd.approverNotes,
      refundType: cmd.refundType,
      refundAmount: cmd.refundAmount,
      paymentId: completedPayment?.id ?? null,
      refundRequestId,
      idempotencyKey,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, autoRefund };
  }
}
