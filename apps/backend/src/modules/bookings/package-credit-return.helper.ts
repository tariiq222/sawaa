import { Prisma, PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';

/**
 * Return a session-package credit consumed by a booking back to its bucket.
 *
 * Called from inside the cancel / no-show / expire transactions whenever a
 * booking carries `packageCreditId != null`. The plan ("الإلغاء/عدم الحضور:
 * الرصيد يرجع في كل الحالات — لا حرق") returns the credit in EVERY terminal
 * non-completed case, with no burn window and no refund/invoice (the booking
 * had zero monetary value).
 *
 * Steps (all keyed by id — never a nested save, per .tariq/lessons.md):
 *  1. Find the booking's CONSUMED usage row. Scoping the lookup to CONSUMED
 *     makes the operation idempotent: a booking whose credit was already
 *     returned yields no row, so a double cancel/expire cannot double-credit.
 *  2. Flip that usage to RETURNED with `returnedAt = now`.
 *  3. Decrement the credit's `usedQuantity` by 1 via an id-keyed update.
 *  4. If the parent purchase had auto-completed (`COMPLETED`), reopen it to
 *     `ACTIVE` — there is now free remaining capacity again. A `REFUNDED`
 *     purchase is terminal and is left untouched.
 *
 * @returns `true` when a credit was returned, `false` when there was nothing
 *          to return (no consumed usage for this booking).
 */
export async function returnPackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.CONSUMED },
    select: { id: true, creditId: true },
  });
  if (!usage) return false;

  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: { status: PackageCreditUsageStatus.RETURNED, returnedAt: new Date() },
  });

  await tx.packageCredit.update({
    where: { id: usage.creditId },
    data: { usedQuantity: { decrement: 1 } },
  });

  const credit = await tx.packageCredit.findUnique({
    where: { id: usage.creditId },
    select: { purchaseId: true },
  });
  if (credit?.purchaseId) {
    const purchase = await tx.packagePurchase.findUnique({
      where: { id: credit.purchaseId },
      select: { status: true },
    });
    if (purchase?.status === PackagePurchaseStatus.COMPLETED) {
      await tx.packagePurchase.update({
        where: { id: credit.purchaseId },
        data: { status: PackagePurchaseStatus.ACTIVE },
      });
    }
  }

  return true;
}
