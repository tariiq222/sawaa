import 'reflect-metadata';
import { CreateEmployeeBookingDto } from './create-employee-booking.dto';

describe('CreateEmployeeBookingDto', () => {
  it('should be defined', () => {
    const dto = new CreateEmployeeBookingDto();
    expect(dto).toBeDefined();
  });
});
