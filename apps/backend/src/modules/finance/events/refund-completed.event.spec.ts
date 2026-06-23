import { RefundCompletedEvent } from './refund-completed.event';

// ---------------------------------------------------------------------------
// RefundCompletedEvent
//
// Emitted by both the legacy single-step `RefundPaymentHandler` flow and the
// gateway-driven `ApproveRefundHandler` (Moyasar) flow when a refund reaches
// COMPLETED. Cross-cluster subscribers depend on:
//   * eventName  → matching against `eventBus.subscribe('finance.refund.completed', ...)`,
//   * version    → for forward-compatible event evolution,
//   * source     → guards against cross-cluster impersonation,
//   * payload    → carries the ids + amount that downstream consumers (reports,
//                 booking cancellation) read without a second DB hit.
// ---------------------------------------------------------------------------

const PAYLOAD = {
  refundRequestId: 'rr-1',
  organizationId: 'org-1',
  invoiceId: 'inv-1',
  paymentId: 'pay-1',
  bookingId: 'book-1',
  amount: 5000,
  currency: 'SAR',
};

describe('RefundCompletedEvent', () => {
  it('uses the finance.refund.completed event name', () => {
    const event = new RefundCompletedEvent(PAYLOAD);
    expect(event.eventName).toBe('finance.refund.completed');
  });

  it('stamps source = "finance" and version = 1', () => {
    const event = new RefundCompletedEvent(PAYLOAD);
    expect(event.source).toBe('finance');
    expect(event.version).toBe(1);
  });

  it('auto-populates eventId + occurredAt on construction', () => {
    const event = new RefundCompletedEvent(PAYLOAD);
    expect(event.eventId).toEqual(expect.any(String));
    expect(event.eventId.length).toBeGreaterThan(20);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('toEnvelope() carries every field the EventBus transport expects', () => {
    const event = new RefundCompletedEvent(PAYLOAD);
    const envelope = event.toEnvelope();
    expect(envelope).toEqual({
      eventId: event.eventId,
      correlationId: event.correlationId,
      source: 'finance',
      version: 1,
      occurredAt: event.occurredAt,
      payload: PAYLOAD,
    });
  });

  it('toEnvelope().payload round-trips the required ids and amount', () => {
    const event = new RefundCompletedEvent(PAYLOAD);
    expect(event.toEnvelope().payload).toEqual(
      expect.objectContaining({
        refundRequestId: 'rr-1',
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
        bookingId: 'book-1',
        amount: 5000,
        currency: 'SAR',
      }),
    );
  });

  it('preserves a null bookingId (bundle-purchase refunds) without coercion to undefined', () => {
    // The booking-cancellation cascade is a no-op when bookingId is null, but
    // the field MUST round-trip as `null` so consumers can branch on it
    // (and not on a `bookings/refund-completed-handler` accidentally treating
    // a bundle refund as a booking refund).
    const event = new RefundCompletedEvent({ ...PAYLOAD, bookingId: null });
    const { payload } = event.toEnvelope();
    expect(payload.bookingId).toBeNull();
    expect('bookingId' in payload).toBe(true);
  });
});
