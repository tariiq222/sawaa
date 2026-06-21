import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, BookingType } from '@prisma/client';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertProgramTransition } from '../program/program-state-machine';
import { CancelProgramDto } from '../enroll-in-program/enroll-in-program.dto';
import { CancellationReason, RefundType } from '@prisma/client';

/**
 * Cancels a program and cascades the cancellation to every active enrollment
 * booking — but does NOT issue refunds. Refunds are performed manually per
 * invoice by the staff using the existing refund flow.
 */
@Injectable()
export class CancelProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(programId: string, dto: CancelProgramDto) {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const program = await tx.program.findUnique({ where: { id: programId } });
      if (!program) throw new NotFoundException('Program not found');

      const nextStatus = assertProgramTransition(program.status, 'CANCEL');

      // Snapshot the enrollment booking ids so we can cancel them with the
      // proper status-log + event after the program row is updated.
      const enrollments = await tx.programEnrollment.findMany({
        where: { programId },
        select: {
          bookingId: true,
          booking: {
            select: {
              id: true,
              status: true,
              clientId: true,
              employeeId: true,
              scheduledAt: true,
              bookingNumber: true,
            },
          },
        },
      });

      await tx.program.update({
        where: { id: programId },
        data: {
          status: nextStatus,
          cancelReason: dto.reason,
          cancelledAt: new Date(),
          enrolledCount: 0,
        },
      });

      // Cancel each enrollment booking that is not already in a terminal
      // status. We deliberately skip CANCELLED/COMPLETED/NO_SHOW/EXPIRED to
      // avoid re-writing history rows on a re-cancel.
      const cancellableStatuses: BookingStatus[] = [
        BookingStatus.PENDING,
        BookingStatus.AWAITING_PAYMENT,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCEL_REQUESTED,
        BookingStatus.DEPOSIT_PAID,
        BookingStatus.PENDING_GROUP_FILL,
      ];

      for (const enrollment of enrollments) {
        const booking = enrollment.booking;
        if (!cancellableStatuses.includes(booking.status)) continue;

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CANCELLED,
            cancelReason: CancellationReason.SYSTEM_EXPIRED,
            cancelNotes: `Program cancelled: ${dto.reason}`,
            cancelledAt: new Date(),
          },
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: BookingStatus.CANCELLED,
            changedBy: 'system:cancel-program',
            reason: `Program cancelled: ${dto.reason}`,
          },
        });

        const event = new BookingCancelledEvent({
          organizationId: DEFAULT_ORG_ID,
          scheduledAt: booking.scheduledAt,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          clientId: booking.clientId,
          employeeId: booking.employeeId,
          reason: CancellationReason.SYSTEM_EXPIRED,
          cancelNotes: `Program cancelled: ${dto.reason}`,
          refundType: RefundType.NONE,
          paymentId: null,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      }

      return {
        id: programId,
        status: nextStatus,
        cancelledEnrollments: enrollments.length,
      };
    });
  }
}
