import 'reflect-metadata';
import { CompleteBookingDto } from './complete-booking.dto';

describe('CompleteBookingDto', () => {
  it('should be defined', () => {
    const dto = new CompleteBookingDto();
    expect(dto).toBeDefined();
  });
});
