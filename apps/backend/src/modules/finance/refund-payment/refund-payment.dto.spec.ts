import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefundPaymentDto } from './refund-payment.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RefundPaymentDto, plain);
  return validate(dto);
}

describe('RefundPaymentDto', () => {
  it('accepts a reason with no partial amount (full refund path)', async () => {
    const errors = await validateDto({ reason: 'Service not delivered' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a reason with a partial amount', async () => {
    const errors = await validateDto({ reason: 'Partial refund', amount: 5000 });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty reason (IsNotEmpty)', async () => {
    const errors = await validateDto({ reason: '' });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a missing reason', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ reason: { text: 'x' } });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  describe('amount (optional IsInt + Min(1))', () => {
    it('rejects amount = 0 (Min(1) — must be a real refund)', async () => {
      const errors = await validateDto({ reason: 'Zero refund', amount: 0 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('rejects a negative amount', async () => {
      const errors = await validateDto({ reason: 'Negative refund', amount: -1 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('rejects a non-integer amount (halalas are integer)', async () => {
      const errors = await validateDto({ reason: 'Float refund', amount: 100.5 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
    it('accepts 1 (Min(1) lower bound)', async () => {
      const errors = await validateDto({ reason: 'Minimum refund', amount: 1 });
      expect(errors).toHaveLength(0);
    });
  });
});
