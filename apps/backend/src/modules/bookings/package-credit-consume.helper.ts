import { Prisma, PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { warnIfPackageCreditUsageRowMissing } from './booking-lifecycle.helper';

/**
 * Consume a session that was reserved for a booking, once the session has
 * actually been delivered (check-in, or completion without a check-in).
 *
 * Scoping the lookup to RESERVED makes the call idempotent: a booking already
 * consumed yields no row, so checking in twice cannot double-charge the bucket.
 * A booking that never reserved a credit (paid bookings) also yields nothing.
 *
 * Steps (all keyed by id — never a nested save, per .tariq/memory/notes/lessons.md):
 *  1. Find the booking's RESERVED usage row. Scoping to RESERVED is what makes
 *     the operation idempotent.
 *  2. Flip that usage to CONSUMED.
 *  3. Move one unit from `reservedQuantity` to `usedQuantity` on the credit via
 *     an id-keyed update.
 *  4. Re-read the credit and, if it is now fully delivered, check every
 *     sibling credit under the same purchase — when all of them are fully
 *     delivered too, auto-complete the parent `PackagePurchase`. This is the
 *     only path that delivers a session, so the auto-complete rule lives here.
 *
 * @returns `true` when a session was consumed, `false` when there was nothing
 *          to consume.
 */
export async function consumePackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.RESERVED },
    select: { id: true, creditId: true },
  });
  if (!usage) {
    // Idempotent no-op UNLESS no usage row exists for this booking at all —
    // see warnIfPackageCreditUsageRowMissing for why that case is logged.
    await warnIfPackageCreditUsageRowMissing(tx, bookingId, 'consumePackageCreditForBooking');
    return false;
  }

  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: { status: PackageCreditUsageStatus.CONSUMED },
  });

  await tx.packageCredit.update({
    where: { id: usage.creditId },
    data: {
      reservedQuantity: { decrement: 1 },
      usedQuantity: { increment: 1 },
    },
  });

  // A purchase completes when its last session is delivered — this is the only
  // path that delivers one, so the auto-complete rule lives here.
  const credit = await tx.packageCredit.findUnique({
    where: { id: usage.creditId },
    select: { purchaseId: true, totalQuantity: true, usedQuantity: true, reservedQuantity: true },
  });
  if (credit && credit.usedQuantity >= credit.totalQuantity) {
    const siblings = await tx.packageCredit.findMany({
      where: { purchaseId: credit.purchaseId },
      select: { totalQuantity: true, usedQuantity: true },
    });
    const allDelivered = siblings.every((c) => c.usedQuantity >= c.totalQuantity);
    if (allDelivered) {
      await tx.packagePurchase.update({
        where: { id: credit.purchaseId },
        data: { status: PackagePurchaseStatus.COMPLETED },
      });
    }
  }

  return true;
}
