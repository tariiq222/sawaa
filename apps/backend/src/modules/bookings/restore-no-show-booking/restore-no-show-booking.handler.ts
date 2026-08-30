import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, BookingType, ProgramStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { reclaimPackageCreditForBooking } from '../package-credit-return.helper';

export interface RestoreNoShowBookingCommand {
  bookingId: string;
  changedBy: string;
  reason: string;
}

/**
 * Sole audited handler for the RESTORE_NO_SHOW transition.
 *
 * Reverts a mistakenly auto-no-show'd booking back to CONFIRMED so the
 * client can still attend (or the slot is recoverable). Financial state is
 * NOT reversed: paid no-shows were forfeited and stay forfeited — this
 * handler never creates refunds, never mutates payments, never jumps the
 * booking to COMPLETED. The only things it touches are:
 *
 *   - Booking.status          NO_SHOW → CONFIRMED
 *   - Booking.checkedInAt     set to `now` (the cron checks this; this is
 *                              the durability guarantee that prevents
 *                              immediate re-mark).
 *   - Booking.noShowAt        cleared.
 *   - BookingStatusLog        one row with from=NO_SHOW, to=CONFIRMED,
 *                              changedBy, reason.
 *   - PackageCreditUsage      if the booking carried a credit, the
 *                              previously RETURNED usage is flipped back to
 *                              CONSUMED and the bucket counter is
 *                              incremented (rollback-on-failure).
 *   - Program enrollment      GROUP bookings are restored only when their
 *                              original program is still SCHEDULED and has
 *                              a valid enrollment or a seat that can be
 *                              atomically reclaimed. We never confirm a
 *                              GROUP booking without a valid seat.
 */
@Injectable()
export class RestoreNoShowBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: RestoreNoShowBookingCommand) {
    const trimmedReason = cmd.reason.trim();
    if (trimmedReason.length < 3) {
      // The DTO already enforces this via class-validator; the trim+check
      // here is the belt-and-braces guard for direct handler callers (e.g.
      // other modules that may invoke `execute` programmatically).
      throw new BadRequestException(
        'Restore reason must be at least 3 characters after trimming',
      );
    }

    const booking = await fetchBookingOrFail(
      this.prisma,
      cmd.bookingId,
      [BookingStatus.NO_SHOW],
      'restored from no-show',
    );
    const nextStatus = assertTransition(booking.status, 'RESTORE_NO_SHOW'); // CONFIRMED

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const isGroupBooking =
        booking.bookingType === BookingType.GROUP || Boolean(booking.programId);

      // 1) Re-establish the program-seat invariant before restoring the
      // booking status. The guarded update acquires the Program row lock and
      // serializes with enrollment/cancellation, so a successful restore
      // cannot leave a confirmed GROUP booking without a seat.
      if (isGroupBooking) {
        if (!booking.programId || !booking.clientId) {
          throw new BadRequestException(
            'Cannot restore a group booking without its program and client',
          );
        }

        // Use the same Program row lock as enrollment/cancellation. This
        // closes the existing-enrollment race too: cancellation either sees
        // the restored booking and cascades it, or restore sees CANCELLED and
        // fails before changing the booking status.
        await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${booking.programId} FOR UPDATE`;

        const program = await tx.program.findUnique({
          where: { id: booking.programId },
          select: { status: true, maxParticipants: true },
        });
        if (!program || program.status !== ProgramStatus.SCHEDULED) {
          throw new BadRequestException(
            'Cannot restore a group booking for an unavailable program',
          );
        }

        const existingEnrollment = await tx.programEnrollment.findUnique({
          where: { bookingId: cmd.bookingId },
          select: { id: true, programId: true, clientId: true },
        });
        if (existingEnrollment) {
          if (
            existingEnrollment.programId !== booking.programId ||
            existingEnrollment.clientId !== booking.clientId
          ) {
            throw new BadRequestException(
              'Cannot restore a group booking with an invalid enrollment',
            );
          }
        } else {
          const reserved = await tx.program.updateMany({
            where: {
              id: booking.programId,
              status: ProgramStatus.SCHEDULED,
              enrolledCount: { lt: program.maxParticipants },
            },
            data: { enrolledCount: { increment: 1 } },
          });
          if (reserved.count !== 1) {
            throw new BadRequestException(
              'Cannot restore a group booking because no seat is available',
            );
          }
          await tx.programEnrollment.create({
            data: {
              programId: booking.programId,
              clientId: booking.clientId,
              bookingId: cmd.bookingId,
            },
          });
        }
      }

      // 1) Flip the booking. Always set checkedInAt so the auto-no-show cron
      //    does not immediately re-mark the booking on its next pass.
      const [restored] = await Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'restored from no-show',
          data: {
            status: nextStatus,
            checkedInAt: new Date(),
            noShowAt: null,
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.changedBy,
            reason: `Restored from no-show: ${trimmedReason}`,
          },
        }),
      ]);

      // 2) Re-claim the seat credit (inverse of the no-show return).
      //    The booking was zero-value; we must re-consume the credit so the
      //    bucket math matches reality. The helper throws BadRequestException
      //    if the bucket is full — that throws out of the tx closure and
      //    triggers the surrounding transaction's rollback, so neither the
      //    booking flip nor the log row survives.
      if (booking.packageCreditId) {
        await reclaimPackageCreditForBooking(tx, cmd.bookingId);
      }

      return restored;
    });
    return updated;
  }
}
