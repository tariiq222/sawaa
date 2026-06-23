import { CancellationReason } from '@prisma/client';
import { BookingCancelRequestedEvent } from './booking-cancel-requested.event';

const basePayload = {
  bookingId: 'book-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  reason: CancellationReason.CLIENT_REQUESTED,
};

describe('BookingCancelRequestedEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingCancelRequestedEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.cancel_requested');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingCancelRequestedEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingCancelRequestedEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingCancelRequestedEvent(basePayload);
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
    const event = new BookingCancelRequestedEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });

  it('preserves optional cancelNotes when provided', () => {
    const event = new BookingCancelRequestedEvent({
      ...basePayload,
      cancelNotes: 'running late',
    });
    expect(event.payload.cancelNotes).toBe('running late');
  });
});
