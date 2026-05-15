import { BookingCreatedEvent } from './booking-created.event';

describe('BookingCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCreatedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
