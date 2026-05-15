import 'reflect-metadata';
import { InitGuestPaymentDto } from './init-guest-payment.dto';

describe('InitGuestPaymentDto', () => {
  it('should be defined', () => {
    const dto = new InitGuestPaymentDto();
    expect(dto).toBeDefined();
  });
});
