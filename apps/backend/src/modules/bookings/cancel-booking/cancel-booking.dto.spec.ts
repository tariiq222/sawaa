import 'reflect-metadata';
import { CancelBookingDto } from './cancel-booking.dto';

describe('CancelBookingDto', () => {
  it('should be defined', () => {
    const dto = new CancelBookingDto();
    expect(dto).toBeDefined();
  });
});
