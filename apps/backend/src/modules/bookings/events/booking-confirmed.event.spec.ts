import { BookingConfirmedEvent } from './booking-confirmed.event';

describe('BookingConfirmedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingConfirmedEvent({} as any);
    expect(event).toBeDefined();
  });
});
