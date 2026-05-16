import { BookingCancelRequestedEvent } from './booking-cancel-requested.event';

describe('BookingCancelRequestedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelRequestedEvent({} as any);
    expect(event).toBeDefined();
  });
});
