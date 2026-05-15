import 'reflect-metadata';
import { InitClientPaymentDto } from './init-client-payment.dto';

describe('InitClientPaymentDto', () => {
  it('should be defined', () => {
    const dto = new InitClientPaymentDto();
    expect(dto).toBeDefined();
  });
});
