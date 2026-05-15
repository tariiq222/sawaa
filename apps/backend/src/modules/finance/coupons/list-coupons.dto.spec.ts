import 'reflect-metadata';
import { ListCouponsDto } from './list-coupons.dto';

describe('ListCouponsDto', () => {
  it('should be defined', () => {
    const dto = new ListCouponsDto();
    expect(dto).toBeDefined();
  });
});
