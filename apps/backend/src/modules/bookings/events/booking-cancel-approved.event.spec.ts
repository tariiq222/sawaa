import { BookingCancelApprovedEvent } from './booking-cancel-approved.event';

describe('BookingCancelApprovedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelApprovedEvent({} as any);
    expect(event).toBeDefined();
  });
});
