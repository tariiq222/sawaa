import 'reflect-metadata';
import { ClientRescheduleBookingDto } from './client-reschedule-booking.dto';

describe('ClientRescheduleBookingDto', () => {
  it('should be defined', () => {
    const dto = new ClientRescheduleBookingDto();
    expect(dto).toBeDefined();
  });
});
