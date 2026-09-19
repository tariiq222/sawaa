import { Prisma, PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { warnIfPackageCreditUsageRowMissing } from './booking-lifecycle.helper';
import { lockPackagePurchase } from './package-purchase-lock.helper';

/**
 * Consume a session that was reserved for a booking, once the session has
 * actually been delivered (check-in, or completion without a check-in).
 *
 * Scoping the lookup to RESERVED makes the call idempotent: a booking already
 * consumed yields no row, so checking in twice cannot double-charge the bucket.
 * A booking that never reserved a credit (paid bookings) also yields nothing.
 *
 * Steps (all keyed by id — never a nested save):
 *  1. Find the booking's RESERVED usage row and identify its parent purchase.
 *  2. Lock the parent purchase, then re-read the RESERVED usage row.
 *  3. Flip that usage to CONSUMED and move one unit from `reservedQuantity`
 *     to `usedQuantity` on the credit.
 *  4. Re-read the credit and siblings while the purchase lock is held. Only
 *     then may the parent transition to COMPLETED, and never from REFUNDED.
 *
 * @returns `true` when a session was consumed, `false` when there was nothing
 *          to consume.
 */
export async function consumePackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const referencedUsage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.RESERVED },
    select: { id: true, creditId: true },
  });
  if (!referencedUsage) {
    // Idempotent no-op UNLESS no usage row exists for this booking at all —
    // see warnIfPackageCreditUsageRowMissing for why that case is logged.
    await warnIfPackageCreditUsageRowMissing(tx, bookingId, 'consumePackageCreditForBooking');
    return false;
  }

  const creditReference = await tx.packageCredit.findUnique({
    where: { id: referencedUsage.creditId },
    select: { purchaseId: true },
  });
  if (!creditReference) return false;

  const purchase = await lockPackagePurchase(tx, creditReference.purchaseId);
  if (!purchase || purchase.status === PackagePurchaseStatus.REFUNDED) return false;

  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.RESERVED },
    select: { id: true, creditId: true },
  });
  if (!usage) return false;

  const creditWithVersion = await tx.packageCredit.findUnique({
    where: { id: usage.creditId },
    select: { purchaseGroupId: true },
  });
  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: {
      status: PackageCreditUsageStatus.CONSUMED,
      ...(creditWithVersion?.purchaseGroupId ? { consumedAt: new Date() } : {}),
    },
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

/** Mark the active consumed usage as delivered when a booking is completed. */
export async function markPackageCreditDeliveredForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const referencedUsage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.CONSUMED },
    select: { id: true, creditId: true, deliveredAt: true },
  });
  if (!referencedUsage) return false;

  const reference = await tx.packageCredit.findUnique({
    where: { id: referencedUsage.creditId },
    select: { purchaseId: true, purchaseGroupId: true },
  });
  if (!reference?.purchaseGroupId) return false;

  const purchase = await lockPackagePurchase(tx, reference.purchaseId);
  if (!purchase || purchase.status === PackagePurchaseStatus.REFUNDED) {
    throw new Error('Package purchase is refunded');
  }

  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.CONSUMED },
    select: { id: true, deliveredAt: true },
  });
  if (!usage || usage.deliveredAt) return false;

  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: { deliveredAt: new Date() },
  });
  return true;
}
