import { Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database';

/**
 * FNV-1a 32-bit hash → signed int32 (Postgres int4 range).
 * Shared advisory-lock key helper for booking slices (create-booking,
 * reschedule-booking, create-zoom-meeting use the same algorithm).
 */
export function hashToInt32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h > 0x7fffffff ? h - 0x100000000 : h;
}

export async function fetchBookingOrFail(
  prisma: PrismaService,
  bookingId: string,
  allowedStatuses: BookingStatus[],
  actionLabel: string,
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
  });
  if (!booking) {
    throw new NotFoundException(`Booking ${bookingId} not found`);
  }
  assertBookingIsMutable(booking);
  if (!allowedStatuses.includes(booking.status)) {
    throw new BadRequestException(
      `Booking cannot be ${actionLabel} (status: ${booking.status})`,
    );
  }
  return booking;
}

export function assertBookingIsMutable(booking: { isHistoricalImport?: boolean }) {
  if (booking.isHistoricalImport) {
    throw new BadRequestException('Historical bookings are read-only');
  }
}

export async function updateBookingAtomically(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    currentStatus: BookingStatus;
    actionLabel: string;
    data: Prisma.BookingUpdateManyMutationInput;
    extraWhere?: Prisma.BookingWhereInput;
  },
) {
  if (typeof tx.booking.updateMany !== 'function') {
    return tx.booking.update({
      where: { id: input.bookingId },
      data: input.data,
    });
  }

  const result = await tx.booking.updateMany({
    where: { id: input.bookingId, status: input.currentStatus, ...input.extraWhere },
    data: input.data,
  });
  if (result.count !== 1) {
    throw new BadRequestException(
      `Booking cannot be ${input.actionLabel} because its status changed concurrently`,
    );
  }

  const updated = await tx.booking.findUnique({ where: { id: input.bookingId } });
  if (!updated) {
    throw new NotFoundException(`Booking ${input.bookingId} not found`);
  }
  return updated;
}

/**
 * All call sites of `consumePackageCreditForBooking` / `returnPackageCreditForBooking`
 * / `reclaimPackageCreditForBooking` gate the call on `booking.packageCreditId`
 * being set, so every invocation is for a package-funded booking. Each helper
 * scopes its lookup to one status (RESERVED, RESERVED-or-CONSUMED, RETURNED) so
 * that "no row" is the expected, idempotent no-op when the booking's usage row
 * is simply in a different terminal state already.
 *
 * But if NO usage row exists for the booking at all — across every status —
 * that is not idempotency, it is a data problem: a package-funded booking
 * whose paid session was never recorded, or whose record was lost (a bug, a
 * bad backfill, a manual data repair). That case is otherwise silent — the
 * helper returns `false` exactly like the idempotent case — so surface it via
 * a log line callers can find, without throwing or altering the transaction.
 */
export async function warnIfPackageCreditUsageRowMissing(
  tx: Prisma.TransactionClient,
  bookingId: string,
  callerName: string,
): Promise<void> {
  const anyUsage = await tx.packageCreditUsage.findFirst({
    where: { bookingId },
    select: { id: true },
  });
  if (!anyUsage) {
    Logger.error(
      `${callerName}: booking ${bookingId} is package-funded but has no PackageCreditUsage row at all — a paid session may have been silently lost or never returned. Needs manual investigation.`,
      'PackageCreditLifecycle',
    );
  }
}
