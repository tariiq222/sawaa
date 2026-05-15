import 'reflect-metadata';
import { CreateRecurringBookingDto } from './create-recurring-booking.dto';

describe('CreateRecurringBookingDto', () => {
  it('should be defined', () => {
    const dto = new CreateRecurringBookingDto();
    expect(dto).toBeDefined();
  });
});
