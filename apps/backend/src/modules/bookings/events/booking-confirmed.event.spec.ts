import { BookingConfirmedEvent } from './booking-confirmed.event';

describe('BookingConfirmedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingConfirmedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
