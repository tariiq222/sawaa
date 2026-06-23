import { BookingCreatedEvent } from './booking-created.event';

const basePayload = {
  bookingId: 'book-1',
  bookingNumber: 17,
  clientId: 'client-1',
  employeeId: 'emp-1',
  organizationId: 'org-1',
  scheduledAt: new Date('2026-03-10T11:30:00Z'),
  serviceId: 'svc-1',
};

describe('BookingCreatedEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingCreatedEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.created');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingCreatedEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingCreatedEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingCreatedEvent(basePayload);
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
    const event = new BookingCreatedEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });
});
