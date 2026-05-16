import { BookingCreatedEvent } from './booking-created.event';

describe('BookingCreatedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCreatedEvent({} as any);
    expect(event).toBeDefined();
  });
});
