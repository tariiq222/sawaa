import 'reflect-metadata';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';

describe('ClientCancelBookingDto', () => {
  it('should be defined', () => {
    const dto = new ClientCancelBookingDto();
    expect(dto).toBeDefined();
  });
});
