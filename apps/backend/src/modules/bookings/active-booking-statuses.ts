import { BookingStatus } from '@prisma/client';

/**
 * Non-terminal booking states used for client-level future/overlap checks.
 *
 * This is intentionally different from STAFF_TIME_BLOCKING_BOOKING_STATUSES:
 * completed/no-show rows can still block an employee's future slot when staff
 * finalized them early, but they are not active appointments owned by a client.
 */
export const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.PENDING_GROUP_FILL,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCEL_REQUESTED,
  BookingStatus.DEPOSIT_PAID,
] as const;

export const STAFF_TIME_BLOCKING_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCEL_REQUESTED,
  // A deposit-paid booking reserves the employee's time even though a balance is still due.
  BookingStatus.DEPOSIT_PAID,
  // COMPLETED / NO_SHOW occupy the practitioner's slot too. complete-booking and
  // no-show-booking have no time guard, so staff can finalize a booking before its
  // scheduled time — if these released the slot, a future-dated finalized booking
  // would reopen the time and allow a double-booking (prod incident 2026-06-24).
  // Past slots are never bookable anyway (minLead + scheduledAt<=now guard), so
  // keeping these here only closes the future double-booking hole.
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
] as const;
