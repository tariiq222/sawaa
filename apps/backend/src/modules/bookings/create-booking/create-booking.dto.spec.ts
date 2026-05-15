import { CreateBookingDto } from './create-booking.dto';

describe('CreateBookingDto', () => {
  it('should instantiate', () => {
    const dto = new CreateBookingDto();
    expect(dto).toBeDefined();
  });
});
