/**
 * Booking status sets shared by the bookings feature.
 *
 * These mirror the backend state machine
 * (`apps/backend/src/modules/bookings/booking-state-machine.ts`) so the UI can
 * never advertise an action the API rejects.
 *
 * Payment holds are unconfirmed bookings: the slot is reserved for a bounded
 * payment window (15 min individual / 30 min program). No staff transition
 * accepts them — CONFIRM is PENDING-only, DIRECT_CANCEL and RESCHEDULE both
 * exclude them — so the only exits are a completed payment (record it from the
 * booking row) or the booking-expiry cron releasing the slot.
 */
export const PAYMENT_HOLD_STATUSES: ReadonlySet<string> = new Set([
  "awaiting_payment",
  "pending_group_fill",
])

/** Statuses DIRECT_CANCEL accepts — the admin cancel dialog's contract. */
export const CANCELLABLE_BOOKING_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "confirmed",
  "cancel_requested",
])
