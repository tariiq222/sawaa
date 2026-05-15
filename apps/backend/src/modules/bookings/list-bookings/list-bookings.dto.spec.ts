import { ListBookingsDto } from './list-bookings.dto';

describe('ListBookingsDto', () => {
  it('should instantiate', () => {
    const dto = new ListBookingsDto();
    expect(dto).toBeDefined();
  });
});
