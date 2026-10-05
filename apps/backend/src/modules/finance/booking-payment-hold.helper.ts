import { BookingStatus } from '@prisma/client';
import { isUnconfirmedHoldStatus } from '../bookings/booking-hold-window';

/** Explicit unconfirmed deadlines apply to appointments and programs alike.
 * Historical imports and bookings without deadlines stay staff-managed.
 * A confirmed reservation's remaining balance is independent of its old hold. */
export function isElapsedUnconfirmedBookingHold(
  booking: {
    status: BookingStatus;
    expiresAt?: Date | null;
    isHistoricalImport?: boolean;
  },
  now = new Date(),
): boolean {
  return Boolean(
    !booking.isHistoricalImport &&
    booking.expiresAt &&
    booking.expiresAt <= now &&
    isUnconfirmedHoldStatus(booking.status),
  );
}
