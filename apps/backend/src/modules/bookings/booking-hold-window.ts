import { BookingStatus } from '@prisma/client';

/**
 * Payment-hold windows for unconfirmed bookings.
 * ===============================================
 * New unconfirmed bookings hold the practitioner's time for an explicit
 * window, and `booking-expiry.cron` releases them when it elapses. Legacy
 * bookings without a deadline remain staff-managed; age is not a deadline.
 *
 * Only two creation paths produce unconfirmed holds today, and each stamps
 * `expiresAt` at creation:
 *   - `create-booking.handler.ts`  → AWAITING_PAYMENT, 15 minutes
 *   - `enroll-in-program.handler.ts` → AWAITING_PAYMENT, 30 minutes
 *
 * The 15-minute literal stays inline in `create-booking.handler.ts` on purpose:
 * that file is an owner-only surface (see the root CLAUDE.md operational safety
 * rules — no cleanliness refactors without approval). `UNCONFIRMED_HOLD_MS`
 * below is the same value for every other caller; keep them in sync.
 */
export const UNCONFIRMED_HOLD_MS = 15 * 60 * 1000;

/**
 * Statuses that represent an unconfirmed hold — a booking whose slot is
 * reserved but whose payment/confirmation has not settled. They carry an
 * expiry window and must never be treated as a settled appointment.
 */
export const UNCONFIRMED_HOLD_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.PENDING_GROUP_FILL,
  BookingStatus.AWAITING_PAYMENT,
];

export function isUnconfirmedHoldStatus(status: BookingStatus): boolean {
  return UNCONFIRMED_HOLD_STATUSES.includes(status);
}

/**
 * The subset of holds whose *staff cancellation* is penalty-free.
 *
 * These are the automated holds: the slot is reserved only while an online
 * payment is pending, no human confirmation happened, and the client never got
 * a confirmed appointment. Releasing one must never charge a late-cancellation
 * penalty, and anything actually captured (a deposit, or a card payment whose
 * webhook was lost) is refunded in FULL — mirroring `expire-booking`.
 *
 * PENDING is deliberately excluded: it is the human-confirmation pipeline, and
 * the configured cancellation policy applies to it as before.
 */
export const CANCELLATION_HOLD_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING_GROUP_FILL,
  BookingStatus.AWAITING_PAYMENT,
];

export function isCancellationHoldStatus(status: BookingStatus): boolean {
  return CANCELLATION_HOLD_STATUSES.includes(status);
}

/** Next expiry timestamp for a (re-armed) unconfirmed hold. */
export function nextHoldExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + UNCONFIRMED_HOLD_MS);
}
