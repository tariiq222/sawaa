import { BookingConfirmedEvent } from './booking-confirmed.event';

const basePayload = {
  bookingId: 'book-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  branchId: 'branch-1',
  serviceId: 'svc-1',
  scheduledAt: new Date('2026-02-01T09:00:00Z'),
  price: 25000,
  currency: 'SAR',
  bookingType: 'INDIVIDUAL',
};

describe('BookingConfirmedEvent', () => {
  it('exposes the stable eventName', () => {
    const event = new BookingConfirmedEvent(basePayload);
    expect(event.eventName).toBe('bookings.booking.confirmed');
  });

  it('sets source to bookings and version to 1', () => {
    const event = new BookingConfirmedEvent(basePayload);
    expect(event.source).toBe('bookings');
    expect(event.version).toBe(1);
  });

  it('passes the payload through unchanged on construction', () => {
    const event = new BookingConfirmedEvent(basePayload);
    expect(event.payload).toEqual(basePayload);
  });

  it('serialises the full envelope expected by EventBusService', () => {
    const event = new BookingConfirmedEvent(basePayload);
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
    const event = new BookingConfirmedEvent(basePayload);
    expect(event.toEnvelope()).not.toHaveProperty('eventName');
  });

  it('preserves couponCode and discountedPrice when present', () => {
    const event = new BookingConfirmedEvent({
      ...basePayload,
      couponCode: 'WELCOME10',
      discountedPrice: 22500,
    });
    expect(event.payload.couponCode).toBe('WELCOME10');
    expect(event.payload.discountedPrice).toBe(22500);
  });
});
