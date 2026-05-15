import 'reflect-metadata';
import { ApplyCouponDto } from './apply-coupon.dto';

describe('ApplyCouponDto', () => {
  it('should be defined', () => {
    const dto = new ApplyCouponDto();
    expect(dto).toBeDefined();
  });
});
