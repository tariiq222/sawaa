import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

/**
 * GroupSessionCapacityService
 * ============================
 * Handles capacity-related state changes for group sessions after a booking
 * cancellation.
 *
 * Rollback scenario
 * -----------------
 * When a participant cancels a group-session booking, the group session may
 * have already crossed the minimum-participants threshold (signalled by all
 * bookings having been transitioned to AWAITING_PAYMENT by
 * GroupSessionMinReachedHandler). If the cancellation drops the enrolled
 * active booking count below the service minimum, remaining AWAITING_PAYMENT
 * bookings for the same group session must be rolled back to
 * PENDING_GROUP_FILL so clients are not charged for a session that no longer
 * has enough participants.
 *
 * The rollback is triggered by `recalculateGroupStatus()`, which is called
 * from any cancel handler that can affect a GROUP booking.
 *
 * State machine transition used: GROUP_FILL_ROLLBACK
 *   AWAITING_PAYMENT → PENDING_GROUP_FILL
 */
@Injectable()
export class GroupSessionCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  /**
   * Recalculate the group session capacity state after a participant has left.
   *
   * Logic:
   * 1. Decrement groupSession.enrolledCount by 1 with a > 0 guard.
   * 2. Count bookings for the given groupSessionId that are still "active"
   *    (status in PENDING_GROUP_FILL | AWAITING_PAYMENT | CONFIRMED).
   * 3. If the active count is below Service.minParticipants, roll remaining
   *    AWAITING_PAYMENT bookings back to PENDING_GROUP_FILL.
   *
   * Calling it when there are no AWAITING_PAYMENT bookings only applies the
   * guarded enrolledCount decrement.
   *
   * @param tx      - The Prisma transaction client (pass the outer tx if inside
   *                  a transaction, or use this.prisma for a standalone call).
   * @param groupSessionId - The ID of the group session to recalculate.
   */
  async recalculateGroupStatus(
    tx: Prisma.TransactionClient,
    groupSessionId: string,
  ): Promise<void> {
    await tx.groupSession.updateMany({
      where: { id: groupSessionId, enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });

    const groupSession = await tx.groupSession.findUnique({
      where: { id: groupSessionId },
      select: { serviceId: true },
    });
    if (!groupSession) return;

    const service = await tx.service.findUnique({
      where: { id: groupSession.serviceId },
      select: { minParticipants: true },
    });
    if (!service) return;

    const activeBookingCount = await tx.booking.count({
      where: {
        groupSessionId,
        status: {
          in: [
            BookingStatus.PENDING_GROUP_FILL,
            BookingStatus.AWAITING_PAYMENT,
            BookingStatus.CONFIRMED,
          ],
        },
      },
    });

    if (activeBookingCount >= service.minParticipants) return;

    // Find all remaining AWAITING_PAYMENT bookings for this group session.
    const awaitingPaymentBookings = await tx.booking.findMany({
      where: {
        groupSessionId,
        status: BookingStatus.AWAITING_PAYMENT,
      },
      select: { id: true },
    });

    if (awaitingPaymentBookings.length === 0) {
      // No AWAITING_PAYMENT bookings — nothing to roll back.
      return;
    }

    const bookingIds = awaitingPaymentBookings.map((b) => b.id);

    // Roll back all AWAITING_PAYMENT bookings to PENDING_GROUP_FILL.
    await tx.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: {
        status: BookingStatus.PENDING_GROUP_FILL,
        expiresAt: null, // clear the payment deadline
      },
    });

    // Create a status log entry for each rolled-back booking.
    await Promise.all(
      bookingIds.map((bookingId) =>
        tx.bookingStatusLog.create({
          data: {
            bookingId,
            fromStatus: BookingStatus.AWAITING_PAYMENT,
            toStatus: BookingStatus.PENDING_GROUP_FILL,
            changedBy: 'system',
            reason: 'Group session capacity dropped below threshold after participant cancellation',
          },
        }),
      ),
    );
  }

  /**
   * Standalone version of recalculateGroupStatus for cancel handlers that do
   * not run inside a transaction. Opens its own transaction internally.
   *
   * @param groupSessionId - The ID of the group session to recalculate.
   */
  async recalculateGroupStatusStandalone(groupSessionId: string): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await this.recalculateGroupStatus(tx, groupSessionId);
    });
  }
}
