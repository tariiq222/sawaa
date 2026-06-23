import { PaymentFailedEvent } from './payment-failed.event';

// ---------------------------------------------------------------------------
// PaymentFailedEvent
//
// Emitted by the finance cluster when a payment transitions to FAILED
// (e.g. bank transfer rejected, gateway declined). comms/on-payment-failed
// subscribes to notify the client. The optional context fields
// (clientEmail/clientName/fcmToken) let comms render a single
// notification without a second DB read.
// ---------------------------------------------------------------------------

const PAYLOAD = {
  paymentId: 'pay-1',
  invoiceId: 'inv-1',
  clientId: 'client-1',
  amount: 15000,
  currency: 'SAR',
  reason: 'Card declined',
  clientEmail: 'fatima@example.com',
  clientName: 'فاطمة',
  fcmToken: 'fcm-token-abc',
  organizationId: 'org-1',
};

describe('PaymentFailedEvent', () => {
  it('uses the finance.payment.failed event name', () => {
    const event = new PaymentFailedEvent(PAYLOAD);
    expect(event.eventName).toBe('finance.payment.failed');
  });

  it('stamps source = "finance" and version = 1', () => {
    const event = new PaymentFailedEvent(PAYLOAD);
    expect(event.source).toBe('finance');
    expect(event.version).toBe(1);
  });

  it('auto-populates eventId + occurredAt on construction', () => {
    const event = new PaymentFailedEvent(PAYLOAD);
    expect(event.eventId).toEqual(expect.any(String));
    expect(event.eventId.length).toBeGreaterThan(20);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('toEnvelope() round-trips every payload field exactly', () => {
    const event = new PaymentFailedEvent(PAYLOAD);
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

  it('toEnvelope().payload preserves the optional context fields that comms relies on', () => {
    const event = new PaymentFailedEvent(PAYLOAD);
    expect(event.toEnvelope().payload).toEqual(
      expect.objectContaining({
        paymentId: 'pay-1',
        invoiceId: 'inv-1',
        clientId: 'client-1',
        amount: 15000,
        currency: 'SAR',
        reason: 'Card declined',
        clientEmail: 'fatima@example.com',
        clientName: 'فاطمة',
        fcmToken: 'fcm-token-abc',
        organizationId: 'org-1',
      }),
    );
  });

  it('handles a minimal payload (optional fields omitted) without dropping required ones', () => {
    // The optional context fields are NOT required — a producer that doesn't
    // have them in scope must still be able to publish the event.
    const event = new PaymentFailedEvent({
      paymentId: 'pay-2',
      invoiceId: 'inv-2',
      clientId: 'client-2',
      amount: 5000,
      currency: 'SAR',
    });
    expect(event.toEnvelope().payload).toEqual({
      paymentId: 'pay-2',
      invoiceId: 'inv-2',
      clientId: 'client-2',
      amount: 5000,
      currency: 'SAR',
      reason: undefined,
      clientEmail: undefined,
      clientName: undefined,
      fcmToken: undefined,
      organizationId: undefined,
    });
  });
});
