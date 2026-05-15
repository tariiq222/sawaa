import 'reflect-metadata';
import { VerifyPaymentDto } from './verify-payment.dto';

describe('VerifyPaymentDto', () => {
  it('should be defined', () => {
    const dto = new VerifyPaymentDto();
    expect(dto).toBeDefined();
  });
});
