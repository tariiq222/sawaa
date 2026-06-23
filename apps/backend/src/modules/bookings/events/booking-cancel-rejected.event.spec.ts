import { BookingCancelRejectedEvent } from './booking-cancel-rejected.event';

const basePayload = {
  bookingId: 'book-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  rejectReason: 'within policy window',
};

describe('BookingCancelRejectedEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingCancelRejectedEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.cancel_rejected');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingCancelRejectedEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingCancelRejectedEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingCancelRejectedEvent(basePayload);
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
    const event = new BookingCancelRejectedEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });
});
