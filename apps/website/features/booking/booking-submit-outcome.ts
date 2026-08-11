/**
 * Decide what the booking wizard must do after `createBooking` succeeds.
 *
 * The backend returns the persisted booking row plus a nullable `invoiceId`:
 *  - paid bookings carry an invoice → the wizard must initialize payment;
 *  - pay-at-clinic / zero-price bookings are already final (CONFIRMED or
 *    DEPOSIT_PAID) with `invoiceId: null` → show success, never init payment;
 *  - any response with a missing invoice and a non-success status (e.g.
 *    AWAITING_PAYMENT) is malformed → fail safely instead of proceeding.
 */
export type BookingSubmitOutcome =
  | { kind: 'payment'; invoiceId: string }
  | { kind: 'success' }
  | { kind: 'failure' };

export function resolveBookingSubmitOutcome(input: {
  invoiceId: string | null;
  status?: string | null;
}): BookingSubmitOutcome {
  if (input.invoiceId) {
    return { kind: 'payment', invoiceId: input.invoiceId };
  }
  if (input.status === 'CONFIRMED' || input.status === 'DEPOSIT_PAID') {
    return { kind: 'success' };
  }
  return { kind: 'failure' };
}
