import 'reflect-metadata';
import { ProcessPaymentDto } from './process-payment.dto';

describe('ProcessPaymentDto', () => {
  it('should be defined', () => {
    const dto = new ProcessPaymentDto();
    expect(dto).toBeDefined();
  });
});
