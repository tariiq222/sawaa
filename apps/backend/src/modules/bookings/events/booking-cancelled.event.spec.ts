import { BookingCancelledEvent } from './booking-cancelled.event';

describe('BookingCancelledEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelledEvent({} as any);
    expect(event).toBeDefined();
  });
});
