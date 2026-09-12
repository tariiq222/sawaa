import {
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PackageCreditUsageStatus, PackagePurchaseStatus } from '@prisma/client';
import { warnIfPackageCreditUsageRowMissing } from './booking-lifecycle.helper';

/**
 * Return a session-package credit held by a booking back to its bucket.
 *
 * Called from inside the cancel / no-show / expire transactions whenever a
 * booking carries `packageCreditId != null`. The plan ("الإلغاء/عدم الحضور:
 * الرصيد يرجع في كل الحالات — لا حرق") returns the credit in EVERY terminal
 * non-completed case, with no burn window and no refund/invoice (the booking
 * had zero monetary value). A booking can hold its credit in either of two
 * states — RESERVED (booked but not yet delivered) or CONSUMED (attended) —
 * and both must release back to the bucket.
 *
 * Steps (all keyed by id — never a nested save, per .tariq/memory/notes/lessons.md):
 *  1. Find the booking's RESERVED-or-CONSUMED usage row. Scoping the lookup
 *     to those two statuses makes the operation idempotent: a booking whose
 *     credit was already returned yields no row, so a double cancel/expire
 *     cannot double-credit.
 *  2. Flip that usage to RETURNED with `returnedAt = now`.
 *  3. Decrement whichever counter actually held the seat: `reservedQuantity`
 *     for a RESERVED row, `usedQuantity` for a CONSUMED one.
 *  4. If the parent purchase had auto-completed (`COMPLETED`), reopen it to
 *     `ACTIVE` — there is now free remaining capacity again. A `REFUNDED`
 *     purchase is terminal and is left untouched.
 *
 * @returns `true` when a credit was returned, `false` when there was nothing
 *          to return (no reserved or consumed usage for this booking).
 */
export async function returnPackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<boolean> {
  const usage = await tx.packageCreditUsage.findFirst({
    where: {
      bookingId,
      status: {
        in: [PackageCreditUsageStatus.RESERVED, PackageCreditUsageStatus.CONSUMED],
      },
    },
    select: { id: true, creditId: true, status: true },
  });
  if (!usage) {
    // Idempotent no-op UNLESS no usage row exists for this booking at all —
    // see warnIfPackageCreditUsageRowMissing for why that case is logged.
    await warnIfPackageCreditUsageRowMissing(tx, bookingId, 'returnPackageCreditForBooking');
    return false;
  }

  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: { status: PackageCreditUsageStatus.RETURNED, returnedAt: new Date() },
  });

  await tx.packageCredit.update({
    where: { id: usage.creditId },
    data:
      usage.status === PackageCreditUsageStatus.RESERVED
        ? { reservedQuantity: { decrement: 1 } }
        : { usedQuantity: { decrement: 1 } },
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

/**
 * Inverse of `returnPackageCreditForBooking` — re-claim a credit that was
 * previously returned to the bucket.
 *
 * Called from the restore-no-show handler: when an auto-no-show is reverted,
 * the booking must own a seat credit again (matching the pre-no-show state)
 * so the client's plan balance is back to "one seat taken". The booking's
 * financial state (no-show = forfeited) is NOT reversed — payments are not
 * touched, this only re-claims the seat credit that was returned at no-show
 * time. The restored status mirrors whether the session was actually
 * attended: CONSUMED if it was, RESERVED if it was not.
 *
 * `wasAttended` MUST be read by the caller from the booking's `checkedInAt`
 * BEFORE the restore transaction stamps it. The restore handler always sets
 * `checkedInAt = now()` on the same booking row (so the auto-no-show cron
 * does not immediately re-mark it) in the same transaction that calls this
 * helper — by the time this function runs, `checkedInAt` is unconditionally
 * non-null and no longer tells you whether the client actually attended.
 * This helper used to re-read `checkedInAt` off the booking itself and was
 * silently always getting `true` because of that same-transaction stamp,
 * which meant every restored no-show came back as CONSUMED. Taking the flag
 * as a parameter forces the caller to capture the fact before it is
 * destroyed, instead of the helper reading already-corrupted state.
 *
 * Steps (mirrors `book-from-credit` consumption patterns — id-keyed update,
 * no nested save):
 *  1. Find the booking's RETURNED usage row. Scoping to RETURNED makes the
 *     call idempotent: a usage already CONSUMED/RESERVED yields no row and
 *     the helper returns `false`. A booking that never held a credit (e.g.
 *     paid bookings, or no-shows that did not touch a credit) also yields
 *     nothing.
 *  2. Lock the credit row with `SELECT ... FOR UPDATE` (same locking style as
 *     `book-from-credit.handler.ts`'s OVERDRAW GUARD) and recount
 *     `usedQuantity + reservedQuantity` INSIDE the lock. Without the lock, a
 *     concurrent booking could take the last seat between a plain read and
 *     this write (TOCTOU) — the row lock forces the two to serialize. If the
 *     bucket is already full, refuse with `BadRequestException` so the
 *     transaction rolls back.
 *  3. Flip the usage back to CONSUMED (if `wasAttended`) or RESERVED (if
 *     not), with `returnedAt = null`.
 *  4. Increment the matching counter by 1 via an id-keyed update:
 *     `usedQuantity` when attended, `reservedQuantity` when not.
 *
 * The purchase auto-complete rule from `book-from-credit` is intentionally NOT
 * mirrored here — auto-complete fires only on the consume path, and toggling
 * a purchase back to COMPLETED on a restore would race with any concurrent
 * consumption on sibling credits. The purchase status is left as-is, which is
 * always safe (ACTIVE stays ACTIVE, COMPLETED stays COMPLETED).
 *
 * @returns `true` when a credit was reclaimed, `false` when there was nothing
 *          to reclaim (no RETURNED usage for this booking).
 * @throws  `BadRequestException` when the credit bucket has no remaining
 *          capacity to absorb the reclaim — the surrounding transaction
 *          MUST roll back.
 */
export async function reclaimPackageCreditForBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
  wasAttended: boolean,
): Promise<boolean> {
  const usage = await tx.packageCreditUsage.findFirst({
    where: { bookingId, status: PackageCreditUsageStatus.RETURNED },
    select: { id: true, creditId: true },
  });
  if (!usage) {
    // Idempotent no-op UNLESS no usage row exists for this booking at all —
    // see warnIfPackageCreditUsageRowMissing for why that case is logged.
    await warnIfPackageCreditUsageRowMissing(tx, bookingId, 'reclaimPackageCreditForBooking');
    return false;
  }

  // Row lock, matching book-from-credit.handler.ts's OVERDRAW GUARD — a plain
  // findUnique here would be a TOCTOU: a concurrent booking could take the
  // last seat between this read and the increment below.
  const lockedRows = await tx.$queryRaw<
    Array<{ totalQuantity: number; usedQuantity: number; reservedQuantity: number }>
  >`
    SELECT "totalQuantity", "usedQuantity", "reservedQuantity"
    FROM "PackageCredit"
    WHERE id = ${usage.creditId}
    FOR UPDATE
  `;
  const credit = lockedRows[0];
  if (!credit) {
    throw new BadRequestException('Package credit not found for this booking');
  }
  if (credit.usedQuantity + credit.reservedQuantity >= credit.totalQuantity) {
    // Bucket is full — refusing is the safe path. The transaction must roll
    // back so the booking stays in NO_SHOW and staff can investigate.
    throw new BadRequestException(
      'Package credit has no remaining sessions to reclaim',
    );
  }

  // A no-show that is restored goes back to the state it held before: a
  // session it actually attended is CONSUMED, one it never attended is only
  // RESERVED. `wasAttended` is the caller's pre-transaction snapshot — see
  // the JSDoc above for why this function cannot read it off the booking
  // itself any more.
  await tx.packageCreditUsage.update({
    where: { id: usage.id },
    data: {
      status: wasAttended
        ? PackageCreditUsageStatus.CONSUMED
        : PackageCreditUsageStatus.RESERVED,
      returnedAt: null,
    },
  });

  await tx.packageCredit.update({
    where: { id: usage.creditId },
    data: wasAttended
      ? { usedQuantity: { increment: 1 } }
      : { reservedQuantity: { increment: 1 } },
  });

  return true;
}
