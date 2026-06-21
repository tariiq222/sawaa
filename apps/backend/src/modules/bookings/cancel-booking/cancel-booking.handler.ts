import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';

import { CancelBookingDto } from './cancel-booking.dto';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { computeRefundType, computeRefundAmountHalalas } from '../cancellation-policy';
import { ProgramCapacityService } from '../program/program-capacity.service';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

export type CancelBookingCommand = CancelBookingDto & {
  bookingId: string;
  changedBy: string;
  source?: string;
  clientId?: string;
};

// Allowed source statuses are defined by the DIRECT_CANCEL transition in booking-state-machine.ts
// PENDING | CONFIRMED | CANCEL_REQUESTED → CANCELLED

@Injectable()
export class CancelBookingHandler {
  private readonly logger = new Logger(CancelBookingHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly zoomMeetingService: ZoomMeetingService,
    private readonly refundHandler: RefundPaymentHandler,
    private readonly groupSessionCapacity: ProgramCapacityService,
  ) {}

  async execute(cmd: CancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (cmd.source === 'client' && cmd.clientId && booking.clientId !== cmd.clientId) {
      throw new ForbiddenException('Not your booking');
    }
    const nextStatus = assertTransition(booking.status, 'DIRECT_CANCEL');

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    if (cmd.source === 'client') {
      const requireApproval = 'requireCancelApproval' in settings
        ? (settings as Record<string, unknown>).requireCancelApproval
        : false;
      if (requireApproval) {
        throw new BadRequestException(
          'Cancel approval is required. Use request-cancel-booking instead.',
        );
      }
    }

    const { refundType, refundPercent } = computeRefundType({
      scheduledAt: booking.scheduledAt,
      freeCancelBeforeHours: settings.freeCancelBeforeHours,
      freeCancelRefundType: settings.freeCancelRefundType,
      lateCancelRefundPercent: settings.lateCancelRefundPercent,
    });

    const completedPayment = await this.prisma.payment.findFirst({
      where: { invoice: { bookingId: booking.id }, status: 'COMPLETED' },
      select: { id: true, amount: true, refundedAmount: true },
    });

    let refundRequestId: string | null = null;
    let idempotencyKey: string | null = null;

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const cancelledBooking = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancelled',
        data: {
          status: nextStatus,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
          cancelledAt: new Date(),
          zoomMeetingStatus: booking.zoomMeetingId ? 'CANCELLED' : undefined,
        },
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
        },
      });
      if (booking.couponCode) {
        await tx.coupon.updateMany({
          where: {
            code: booking.couponCode,
            usedCount: { gt: 0 },
          },
          data: { usedCount: { decrement: 1 } },
        });
      }
      if (completedPayment && refundType !== RefundType.NONE) {
        // Honour the configured refund percent. FULL → 100% (refundAmount
        // left undefined so the finance handler refunds the whole paid
        // amount); PARTIAL → round(paidAmount * percent / 100) in exact
        // integer halalas — never a fractional halala. A computed 0 here
        // would be a policy bug (refundType would be NONE), but we guard
        // against creating a zero-amount refund request anyway.
        const paidHalalas = Number(completedPayment.amount);
        const refundAmount =
          refundType === RefundType.FULL
            ? undefined
            : computeRefundAmountHalalas(paidHalalas, refundPercent);
        if (refundAmount === undefined || refundAmount > 0) {
          const created = await this.refundHandler.createRefundRequestInTx(tx, {
            paymentId: completedPayment.id,
            reason: `Booking ${booking.id} cancellation (${refundType})`,
            performedBy: cmd.changedBy,
            amount: refundAmount,
          });
          refundRequestId = created.refundRequestId;
          idempotencyKey = created.idempotencyKey;
        }
      }
      // Roll back sibling AWAITING_PAYMENT bookings for program enrollments
      // when the cancellation drops the enrolled count below the threshold.
      if (booking.programId) {
        // Remove the ProgramEnrollment row so the client can re-enroll after
        // their seat is freed. deleteMany is safe: a booking has at most one
        // enrollment (@@unique on bookingId) and returns count=0 silently if
        // there is none.
        await tx.programEnrollment.deleteMany({ where: { bookingId: cmd.bookingId } });
        await this.groupSessionCapacity.decrementEnrollment(tx, booking.programId);
      }
      return cancelledBooking;
    });

    const event = new BookingCancelledEvent({
      organizationId: DEFAULT_ORG_ID,
      scheduledAt: booking.scheduledAt,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
      zoomMeetingId: (booking as Record<string, unknown>).zoomMeetingId as string | null ?? null,
      refundType,
      paymentId: completedPayment?.id ?? null,
      refundRequestId,
      idempotencyKey,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    if (booking.zoomMeetingId) {
      this.zoomMeetingService.deleteMeeting(DEFAULT_ORG_ID, booking.zoomMeetingId).catch((err) => {
        this.logger.error(
          `Failed to delete Zoom meeting ${booking.zoomMeetingId} for booking ${booking.id} after cancel. Meeting may be orphaned on Zoom.`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }

    return { ...updated, refundType };
  }
}
