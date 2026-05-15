import 'reflect-metadata';
import { RefundPaymentDto } from './refund-payment.dto';

describe('RefundPaymentDto', () => {
  it('should be defined', () => {
    const dto = new RefundPaymentDto();
    expect(dto).toBeDefined();
  });
});
