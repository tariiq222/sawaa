import 'reflect-metadata';
import { CreateInvoiceDto } from './create-invoice.dto';

describe('CreateInvoiceDto', () => {
  it('should be defined', () => {
    const dto = new CreateInvoiceDto();
    expect(dto).toBeDefined();
  });
});
