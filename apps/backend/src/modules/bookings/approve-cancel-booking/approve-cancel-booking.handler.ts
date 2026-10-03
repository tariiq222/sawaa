import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { stableEventId } from '../../../common/events';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { BookingCancelApprovedEvent } from '../events/booking-cancel-approved.event';
import { assertTransition } from '../booking-state-machine';
import { ProgramCapacityService } from '../program/program-capacity.service';
import { assertBookingIsMutable, updateBookingAtomically } from '../booking-lifecycle.helper';
import { returnPackageCreditForBooking } from '../package-credit-return.helper';
import { readCancellationPayments } from '../client/client-cancellation-preview.handler';
import { buildStaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';

export interface ApproveCancelBookingCommand {
  bookingId: string;
  approvedBy: string;
  approverNotes?: string;
  /** Refund decision — freezes the additional refund budget atomically with cancellation. */
  refundType?: RefundType;
  /** Refund amount in halalas — required iff refundType is PARTIAL. */
  refundAmount?: number;
}

@Injectable()
export class ApproveCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    _eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupSessionCapacity: ProgramCapacityService,
    _refundHandler: RefundPaymentHandler,
  ) {}

  async execute(cmd: ApproveCancelBookingCommand) {
    if (cmd.refundType === RefundType.PARTIAL && cmd.refundAmount === undefined) {
      throw new BadRequestException('refundAmount is required when refundType is PARTIAL');
    }
    if (cmd.refundType !== RefundType.PARTIAL && cmd.refundAmount !== undefined) {
      throw new BadRequestException('refundAmount is only allowed when refundType is PARTIAL');
    }

    const initialBooking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!initialBooking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    const refundSummary = cmd.refundType
      ? ` — refund: ${cmd.refundType}${cmd.refundType === RefundType.PARTIAL ? ` ${cmd.refundAmount} halalas` : ''}`
      : '';
    const statusLogReason = `Cancel request approved${refundSummary}${cmd.approverNotes ? ` — ${cmd.approverNotes}` : ''}`;

    const cancellationEventId = stableEventId(`booking:${cmd.bookingId}:cancel-approved`);

    return this.rlsTransaction.withTransaction(async (tx) => {
      // Program operations serialize membership before individual bookings. Use
      // NOWAIT for the booking to avoid deadlocking older Booking -> Program flows.
      if (initialBooking.programId) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Program" WHERE "id" = ${initialBooking.programId} FOR UPDATE`);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${cmd.bookingId} FOR UPDATE NOWAIT`);
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${cmd.bookingId} FOR UPDATE`);
      }
      const booking = await tx.booking.findFirst({ where: { id: cmd.bookingId } });
      if (!booking) throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
      if (booking.programId !== initialBooking.programId) throw new ConflictException('Booking program changed concurrently');
      assertBookingIsMutable(booking);
      const nextStatus = assertTransition(booking.status, 'APPROVE_CANCEL');
      const settings = await this.settingsHandler.execute({ branchId: booking.branchId, transaction: tx });
      const autoRefund = 'autoRefundOnCancel' in settings ? settings.autoRefundOnCancel === true : true;
      const effectiveRefundType = cmd.refundType ?? (autoRefund ? RefundType.FULL : RefundType.NONE);
      const payments = await readCancellationPayments(tx, booking.id, true);
      const staffCancellation = buildStaffCancellationIntent({
        payments, currency: booking.currency,
        refundAmount: effectiveRefundType === RefundType.NONE ? 0 : effectiveRefundType === RefundType.PARTIAL ? cmd.refundAmount : undefined,
        initiatedBy: 'STAFF', performedBy: cmd.approvedBy,
        reason: statusLogReason, automatic: autoRefund,
      });
      const updatedBooking = await updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancelled',
          data: {
            status: nextStatus,
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
          toStatus: nextStatus,
          changedBy: cmd.approvedBy,
          reason: statusLogReason,
        },
      });

      // The durable intent is committed with cancellation; settlement happens
      // independently and never blocks appointment cancellation on provider failure.

      // Session-package credit bookings: return the credit to its bucket
      // on cancel-approval. Mirrors the cancel-booking behaviour so every
      // terminal non-completed case reopens the credit (no burn window, no
      // refund — the booking had zero monetary value).
      if (booking.packageCreditId) {
        await returnPackageCreditForBooking(tx, cmd.bookingId);
      }

      // Return this participant seat for program enrollments.
      if (booking.programId) {
        // Remove the ProgramEnrollment row so the client can re-enroll after
        // their seat is freed.
        await tx.programEnrollment.deleteMany({ where: { bookingId: cmd.bookingId } });
        await this.groupSessionCapacity.decrementEnrollment(tx, booking.programId);
      }

      const event = new BookingCancelApprovedEvent({
        bookingId: booking.id,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        autoRefund,
        approverNotes: cmd.approverNotes,
        refundType: cmd.refundType,
        refundAmount: cmd.refundAmount,
        staffCancellation,
      }, cancellationEventId);
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: booking.id,
          eventType: event.eventName,
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
      return { ...updatedBooking, autoRefund };
    });
  }
}
