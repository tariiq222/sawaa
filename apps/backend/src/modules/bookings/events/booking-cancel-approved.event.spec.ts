import { BookingCancelApprovedEvent } from './booking-cancel-approved.event';

const basePayload = {
  bookingId: 'book-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  autoRefund: true,
};

describe('BookingCancelApprovedEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingCancelApprovedEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.cancel_approved');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingCancelApprovedEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingCancelApprovedEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingCancelApprovedEvent(basePayload);
    const envelope = event.toEnvelope();

    expect(envelope).toEqual({
      eventId: event.eventId,
      correlationId: event.correlationId,
      source: 'bookings',
      version: 1,
      occurredAt: event.occurredAt,
      payload: basePayload,
    });
  });

  it('does not leak eventName into the transport envelope', () => {
    const event = new BookingCancelApprovedEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });

  it('preserves refund decision fields (refundType, refundAmount, paymentId, refundRequestId, idempotencyKey)', () => {
    const event = new BookingCancelApprovedEvent({
      ...basePayload,
      autoRefund: false,
      approverNotes: 'partial refund approved',
      refundType: 'PARTIAL' as never,
      refundAmount: 5000,
      paymentId: 'pay-1',
      refundRequestId: 'rr-1',
      idempotencyKey: 'idem-1',
    });
    expect(event.payload.autoRefund).toBe(false);
    expect(event.payload.approverNotes).toBe('partial refund approved');
    expect(event.payload.refundType).toBe('PARTIAL');
    expect(event.payload.refundAmount).toBe(5000);
    expect(event.payload.paymentId).toBe('pay-1');
    expect(event.payload.refundRequestId).toBe('rr-1');
    expect(event.payload.idempotencyKey).toBe('idem-1');
  });
});
