import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApplyCouponDto } from './apply-coupon.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ApplyCouponDto, plain);
  return validate(dto);
}

describe('ApplyCouponDto', () => {
  const valid: Record<string, unknown> = {
    invoiceId: '00000000-0000-4000-8000-000000000000',
    code: 'WELCOME10',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID invoiceId', async () => {
    const errors = await validateDto({ ...valid, invoiceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a missing invoiceId', async () => {
    const errors = await validateDto({ code: valid.code });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a code shorter than 3 chars (MinLength(3))', async () => {
    const errors = await validateDto({ ...valid, code: 'AB' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a code longer than 64 chars (MaxLength(64))', async () => {
    const errors = await validateDto({ ...valid, code: 'X'.repeat(65) });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('accepts a code at the 3-char lower bound', async () => {
    const errors = await validateDto({ ...valid, code: 'ABC' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a code at the 64-char upper bound', async () => {
    const errors = await validateDto({ ...valid, code: 'X'.repeat(64) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string code', async () => {
    const errors = await validateDto({ ...valid, code: 12345 });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a missing code', async () => {
    const errors = await validateDto({ invoiceId: valid.invoiceId });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });
});
