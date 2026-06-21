import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

/**
 * GroupSessionCapacityService
 * ============================
 * Keeps GroupSession.enrolledCount in sync after a participant leaves a
 * scheduled group session (cancellation, no-show, or expiry).
 *
 * The previous fill-then-charge rollback path (AWAITING_PAYMENT →
 * PENDING_GROUP_FILL) belonged to the capacity-based group-service flow that
 * has been removed. Scheduled group sessions never enter PENDING_GROUP_FILL —
 * a booking is created directly in AWAITING_PAYMENT/CONFIRMED by
 * BookGroupSessionHandler — so the only remaining responsibility here is the
 * guarded enrolled-count decrement.
 */
@Injectable()
export class GroupSessionCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  /**
   * Decrement the group session's enrolled count after a participant has left,
   * floored at 0 via a guarded conditional update.
   *
   * @param tx             - The Prisma transaction client (pass the outer tx if
   *                         inside a transaction).
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
