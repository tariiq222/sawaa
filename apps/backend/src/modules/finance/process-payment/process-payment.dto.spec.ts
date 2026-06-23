import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ProcessPaymentDto } from './process-payment.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ProcessPaymentDto, plain);
  return validate(dto);
}

describe('ProcessPaymentDto', () => {
  const valid: Record<string, unknown> = {
    invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    amount: 10000,
    method: PaymentMethod.MADA,
  };

  it('accepts a valid payload with the three required fields', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with optional gatewayRef and idempotencyKey', async () => {
    const errors = await validateDto({
      ...valid,
      gatewayRef: 'pay_abc123',
      idempotencyKey: 'idem-2026-xyz',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID invoiceId', async () => {
    const errors = await validateDto({ ...valid, invoiceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a missing invoiceId', async () => {
    const errors = await validateDto({ amount: valid.amount, method: valid.method });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  describe('amount (IsInt + Min(1))', () => {
    it('rejects amount = 0 (Min(1))', async () => {
      const errors = await validateDto({ ...valid, amount: 0 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('rejects a negative amount', async () => {
      const errors = await validateDto({ ...valid, amount: -100 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('rejects a non-integer amount (halalas are integer)', async () => {
      const errors = await validateDto({ ...valid, amount: 100.5 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('accepts 1 (Min(1) lower bound)', async () => {
      const errors = await validateDto({ ...valid, amount: 1 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('method (IsEnum(PaymentMethod))', () => {
    it('accepts every PaymentMethod value', async () => {
      for (const method of Object.values(PaymentMethod)) {
        const errors = await validateDto({ ...valid, method });
        expect(errors).toHaveLength(0);
      }
    });
    it('rejects an unknown method', async () => {
      const errors = await validateDto({ ...valid, method: 'BITCOIN' });
      expect(errors.some((e) => e.property === 'method')).toBe(true);
    });
    it('rejects a missing method', async () => {
      const errors = await validateDto({ invoiceId: valid.invoiceId, amount: valid.amount });
      expect(errors.some((e) => e.property === 'method')).toBe(true);
    });
  });

  describe('gatewayRef (optional IsString)', () => {
    it('rejects a non-string', async () => {
      const errors = await validateDto({ ...valid, gatewayRef: 12345 });
      expect(errors.some((e) => e.property === 'gatewayRef')).toBe(true);
    });
  });

  describe('idempotencyKey (optional IsString)', () => {
    it('rejects a non-string', async () => {
      const errors = await validateDto({ ...valid, idempotencyKey: { k: 'x' } });
      expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
    });
  });
});
