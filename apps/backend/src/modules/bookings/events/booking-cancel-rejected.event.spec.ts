import { BookingCancelRejectedEvent } from './booking-cancel-rejected.event';

describe('BookingCancelRejectedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelRejectedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
