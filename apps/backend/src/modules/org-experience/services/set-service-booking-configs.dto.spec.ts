import 'reflect-metadata';
import { BookingConfigInputDto } from './set-service-booking-configs.dto';

describe('BookingConfigInputDto', () => {
  it('should be defined', () => {
    const dto = new BookingConfigInputDto();
    expect(dto).toBeDefined();
  });
});
