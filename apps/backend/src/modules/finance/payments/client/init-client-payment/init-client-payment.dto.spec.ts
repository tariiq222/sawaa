import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InitClientPaymentDto } from './init-client-payment.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(InitClientPaymentDto, plain);
  return validate(dto);
}

describe('InitClientPaymentDto', () => {
  it('accepts just an invoiceId (method is optional)', async () => {
    const errors = await validateDto({ invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' });
    expect(errors).toHaveLength(0);
  });

  it('accepts ONLINE_CARD method', async () => {
    const errors = await validateDto({
      invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      method: 'ONLINE_CARD',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts APPLE_PAY method', async () => {
    const errors = await validateDto({
      invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      method: 'APPLE_PAY',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID invoiceId', async () => {
    const errors = await validateDto({ invoiceId: 'bad-id' });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a missing invoiceId', async () => {
    const errors = await validateDto({ method: 'ONLINE_CARD' });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a method outside ONLINE_CARD / APPLE_PAY', async () => {
    const errors = await validateDto({
      invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      method: 'CASH',
    });
    expect(errors.some((e) => e.property === 'method')).toBe(true);
  });
});
