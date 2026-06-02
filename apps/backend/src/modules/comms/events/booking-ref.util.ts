/**
 * Format a booking reference for notifications to match the dashboard list,
 * which renders `#${bookingNumber.padStart(4, '0')}` (e.g. #0001).
 * Falls back to the legacy id tail for older outbox events that predate
 * `bookingNumber` in the event payload.
 */
export function formatBookingRef(bookingNumber: number | undefined, bookingId: string): string {
  if (bookingNumber != null) return `#${String(bookingNumber).padStart(4, '0')}`;
  return `#${bookingId.slice(-6)}`;
}
