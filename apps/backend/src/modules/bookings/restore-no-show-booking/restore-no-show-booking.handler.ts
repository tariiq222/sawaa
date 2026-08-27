import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
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
 *   - Program enrollment      best-effort: if the program still has free
 *                              seats AND no enrollment for this booking
 *                              exists, a row is created and the counter
 *                              incremented. A full program NEVER fails the
 *                              restore.
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

      // 3) Best-effort re-enrollment for program bookings. The no-show
      //    handler deleted the ProgramEnrollment row and decremented the
      //    counter; we reverse that only when there is room. If the program
      //    filled up while the client was away, the restore still succeeds —
      //    staff can re-enroll manually and the seat credit already
      //    covers the booking.
      if (booking.programId && booking.clientId) {
        const existingEnrollment = await tx.programEnrollment.findUnique({
          where: { bookingId: cmd.bookingId },
          select: { id: true },
        });
        if (!existingEnrollment) {
          const program = await tx.program.findUnique({
            where: { id: booking.programId },
            select: { maxParticipants: true, enrolledCount: true },
          });
          if (program) {
            const reserved = await tx.program.updateMany({
              where: {
                id: booking.programId,
                enrolledCount: { lt: program.maxParticipants },
              },
              data: { enrolledCount: { increment: 1 } },
            });
            if (reserved.count === 1) {
              await tx.programEnrollment.create({
                data: {
                  programId: booking.programId,
                  clientId: booking.clientId,
                  bookingId: cmd.bookingId,
                },
              });
            }
            // reserved.count === 0 → program is full; skip re-enrollment
            // (the restore itself still succeeded).
          }
          // program missing → nothing to enroll against; skip.
        }
        // existingEnrollment present → already re-enrolled by a concurrent
        // restore attempt (idempotency guard).
      }

      return restored;
    });
    return updated;
  }
}
