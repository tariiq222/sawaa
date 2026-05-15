import { BookingCancelledEvent } from './booking-cancelled.event';

describe('BookingCancelledEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelledEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
