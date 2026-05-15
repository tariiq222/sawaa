import { BookingCancelRequestedEvent } from './booking-cancel-requested.event';

describe('BookingCancelRequestedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelRequestedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
