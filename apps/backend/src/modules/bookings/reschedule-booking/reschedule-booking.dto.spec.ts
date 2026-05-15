import 'reflect-metadata';
import { RescheduleBookingDto } from './reschedule-booking.dto';

describe('RescheduleBookingDto', () => {
  it('should be defined', () => {
    const dto = new RescheduleBookingDto();
    expect(dto).toBeDefined();
  });
});
