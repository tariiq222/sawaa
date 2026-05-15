import 'reflect-metadata';
import { GuestClientInfoDto } from './create-guest-booking.dto';

describe('GuestClientInfoDto', () => {
  it('should be defined', () => {
    const dto = new GuestClientInfoDto();
    expect(dto).toBeDefined();
  });
});
