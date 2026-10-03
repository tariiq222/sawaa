/**
 * Booking status sets shared by the bookings feature.
 *
 * They mirror the backend state machine
 * (`apps/backend/src/modules/bookings/booking-state-machine.ts`) so the UI can
 * never advertise an action the API rejects.
 */

/**
 * Statuses DIRECT_CANCEL accepts — the admin cancel dialog's contract.
 *
 * `awaiting_payment` and `pending_group_fill` are unconfirmed payment holds:
 * the slot is reserved for a bounded payment window (15 min individual / 30 min
 * program) while an online payment is pending. Staff cancellation is allowed so
 * reception can release the slot immediately instead of waiting for the expiry
 * cron, and it is penalty-free — see `cancel-booking.handler.ts`.
 */
export const CANCELLABLE_BOOKING_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "pending_group_fill",
  "awaiting_payment",
  "confirmed",
  "deposit_paid",
  "cancel_requested",
])
