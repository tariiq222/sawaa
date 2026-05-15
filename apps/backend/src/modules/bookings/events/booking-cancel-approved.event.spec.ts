import { BookingCancelApprovedEvent } from './booking-cancel-approved.event';

describe('BookingCancelApprovedEvent', () => {
  it('should create an instance', () => {
    const event = new BookingCancelApprovedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
