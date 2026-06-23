import { CancellationReason } from '@prisma/client';
import { BookingCancelledEvent } from './booking-cancelled.event';

const basePayload = {
  organizationId: 'org-1',
  scheduledAt: new Date('2026-01-15T10:00:00Z'),
  bookingId: 'book-1',
  bookingNumber: 42,
  clientId: 'client-1',
  employeeId: 'emp-1',
  reason: CancellationReason.CLIENT_REQUESTED,
  refundType: 'FULL' as const,
  paymentId: 'pay-1',
};

describe('BookingCancelledEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingCancelledEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.cancelled');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingCancelledEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingCancelledEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingCancelledEvent(basePayload);
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
    const event = new BookingCancelledEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });

  it('preserves optional fields (cancelNotes, zoomMeetingId, refundRequestId, idempotencyKey)', () => {
    const event = new BookingCancelledEvent({
      ...basePayload,
      cancelNotes: 'client late',
      zoomMeetingId: 'zm-1',
      refundRequestId: 'rr-1',
      idempotencyKey: 'idem-1',
    });
    expect(event.payload.cancelNotes).toBe('client late');
    expect(event.payload.zoomMeetingId).toBe('zm-1');
    expect(event.payload.refundRequestId).toBe('rr-1');
    expect(event.payload.idempotencyKey).toBe('idem-1');
  });
});
