import { PaymentCompletedEvent } from './payment-completed.event';

// ---------------------------------------------------------------------------
// PaymentCompletedEvent
//
// Cross-cluster signal that a payment has reached COMPLETED status. The
// envelope (eventName + version + source + payload) is the contract that
// downstream subscribers (bookings, comms, finance.refund-completed handler)
// depend on. Anything that drops a field here will silently break
// `eventBus.subscribe` matching in the consumer.
// ---------------------------------------------------------------------------

const PAYLOAD = {
  paymentId: 'pay-1',
  invoiceId: 'inv-1',
  bookingId: 'book-1',
  amount: 15000,
  currency: 'SAR',
  organizationId: 'org-1',
};

describe('PaymentCompletedEvent', () => {
  it('uses the finance.payment.completed event name (the contract consumers subscribe to)', () => {
    const event = new PaymentCompletedEvent(PAYLOAD);
    expect(event.eventName).toBe('finance.payment.completed');
  });

  it('stamps source = "finance" and version = 1 on the event', () => {
    const event = new PaymentCompletedEvent(PAYLOAD);
    expect(event.source).toBe('finance');
    expect(event.version).toBe(1);
  });

  it('auto-populates eventId and occurredAt as fresh values per construction', () => {
    const a = new PaymentCompletedEvent(PAYLOAD);
    const b = new PaymentCompletedEvent(PAYLOAD);
    // eventId is a random UUID — two constructions never collide.
    expect(a.eventId).toEqual(expect.any(String));
    expect(a.eventId.length).toBeGreaterThan(20);
    expect(a.eventId).not.toBe(b.eventId);
    // occurredAt is a Date in the present.
    expect(a.occurredAt).toBeInstanceOf(Date);
    const now = Date.now();
    expect(a.occurredAt.getTime()).toBeLessThanOrEqual(now);
    expect(b.occurredAt.getTime()).toBeGreaterThanOrEqual(a.occurredAt.getTime());
  });

  it('toEnvelope() carries every field the EventBus transport expects', () => {
    const event = new PaymentCompletedEvent(PAYLOAD);
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

  it('toEnvelope().payload passes through every field, including the optional bundlePurchaseId', () => {
    const event = new PaymentCompletedEvent({
      ...PAYLOAD,
      bookingId: null,
      bundlePurchaseId: 'bp-1',
    });
    expect(event.toEnvelope().payload).toEqual(
      expect.objectContaining({
        paymentId: 'pay-1',
        invoiceId: 'inv-1',
        bookingId: null,
        bundlePurchaseId: 'bp-1',
        amount: 15000,
        currency: 'SAR',
        organizationId: 'org-1',
      }),
    );
  });

  it('preserves a null bookingId (bundle-purchase invoices) without coercion to undefined', () => {
    const event = new PaymentCompletedEvent({
      ...PAYLOAD,
      bookingId: null,
    });
    expect(event.toEnvelope().payload).toEqual(
      expect.objectContaining({ bookingId: null }),
    );
    // Explicit check: the field is present, not missing.
    expect('bookingId' in event.toEnvelope().payload).toBe(true);
  });
});
