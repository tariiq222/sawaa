import 'reflect-metadata';
import { UpdateCouponDto } from './update-coupon.dto';

describe('UpdateCouponDto', () => {
  it('should be defined', () => {
    const dto = new UpdateCouponDto();
    expect(dto).toBeDefined();
  });
});
