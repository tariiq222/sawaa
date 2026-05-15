import 'reflect-metadata';
import { CreateCouponDto } from './create-coupon.dto';

describe('CreateCouponDto', () => {
  it('should be defined', () => {
    const dto = new CreateCouponDto();
    expect(dto).toBeDefined();
  });
});
