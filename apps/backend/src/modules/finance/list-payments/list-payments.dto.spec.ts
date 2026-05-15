import 'reflect-metadata';
import { ListPaymentsDto } from './list-payments.dto';

describe('ListPaymentsDto', () => {
  it('should be defined', () => {
    const dto = new ListPaymentsDto();
    expect(dto).toBeDefined();
  });
});
